#!/usr/bin/env python3
"""Run one Internal Vision Platform training job with Ultralytics."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

import torch
import yaml
from ultralytics import YOLO


EVENT_PREFIX = "IVP_EVENT "


def emit_event(payload: dict[str, Any]) -> None:
    print(EVENT_PREFIX + json.dumps(payload, ensure_ascii=False), flush=True)


def safe_number(value: Any) -> float | None:
    try:
        if hasattr(value, "item"):
            value = value.item()
        number = float(value)
        return round(number, 6) if math.isfinite(number) else None
    except (TypeError, ValueError, RuntimeError):
        return None


def extract_dataset(archive_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    destination_root = destination.resolve()

    with zipfile.ZipFile(archive_path) as archive:
        for member in archive.infolist():
            member_path = PurePosixPath(member.filename.replace("\\", "/"))
            if member_path.is_absolute() or ".." in member_path.parts:
                raise ValueError(f"Dataset ZIP มี path ที่ไม่ปลอดภัย: {member.filename}")

            unix_mode = member.external_attr >> 16
            if stat.S_ISLNK(unix_mode):
                raise ValueError(f"Dataset ZIP มี symbolic link ซึ่งไม่อนุญาต: {member.filename}")

            target = destination.joinpath(*member_path.parts).resolve()
            if target != destination_root and destination_root not in target.parents:
                raise ValueError(f"Dataset ZIP เขียนไฟล์ออกนอกพื้นที่งาน: {member.filename}")

            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue

            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)


def prepare_data_yaml(dataset_root: Path, work_dir: Path) -> Path:
    candidates = sorted(dataset_root.rglob("data.yaml")) + sorted(dataset_root.rglob("data.yml"))
    if not candidates:
        raise FileNotFoundError("ไม่พบ data.yaml ใน Dataset ที่ดาวน์โหลดมา")

    source = candidates[0]
    payload = yaml.safe_load(source.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("data.yaml มีรูปแบบไม่ถูกต้อง")

    configured_root = Path(str(payload.get("path", ".")))
    if not configured_root.is_absolute():
        configured_root = (source.parent / configured_root).resolve()
    payload["path"] = str(configured_root)

    prepared = work_dir / "data.ivp.yaml"
    prepared.write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    return prepared


def metric_value(metrics: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = safe_number(metrics.get(key))
        if value is not None:
            return value
    return None


def trainer_metrics(trainer: Any) -> dict[str, float]:
    raw_metrics = trainer.metrics if isinstance(getattr(trainer, "metrics", None), dict) else {}
    result: dict[str, float] = {}

    map50 = metric_value(raw_metrics, "metrics/mAP50(B)", "metrics/mAP50(M)", "metrics/mAP50")
    map50_95 = metric_value(raw_metrics, "metrics/mAP50-95(B)", "metrics/mAP50-95(M)", "metrics/mAP50-95")
    if map50 is not None:
        result["map50"] = map50
    if map50_95 is not None:
        result["map50_95"] = map50_95

    loss_values = getattr(trainer, "tloss", None)
    if loss_values is None:
        loss_values = getattr(trainer, "loss_items", None)
    loss_names = list(getattr(trainer, "loss_names", []) or [])
    if loss_values is not None:
        values = loss_values.tolist() if hasattr(loss_values, "tolist") else list(loss_values)
        numeric_values = [number for value in values if (number := safe_number(value)) is not None]
        if numeric_values:
            result["loss"] = round(sum(numeric_values), 6)
        for name, value in zip(loss_names, values):
            number = safe_number(value)
            if number is None:
                continue
            normalized_name = str(name).lower()
            if "box" in normalized_name:
                result["boxLoss"] = number
            elif "cls" in normalized_name or "class" in normalized_name:
                result["classLoss"] = number

    return result


def resolve_artifact(value: Any, fallback: Path) -> Path:
    if value:
        candidate = Path(str(value)).resolve()
        if candidate.is_file():
            return candidate
    return fallback.resolve()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Internal Vision Platform Ultralytics trainer")
    parser.add_argument("--dataset-zip", required=True, type=Path)
    parser.add_argument("--work-dir", required=True, type=Path)
    parser.add_argument("--model", required=True)
    parser.add_argument("--epochs", required=True, type=int)
    parser.add_argument("--imgsz", required=True, type=int)
    parser.add_argument("--batch", required=True, type=int)
    parser.add_argument("--device", default="auto")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    work_dir = args.work_dir.resolve()
    dataset_root = work_dir / "dataset"
    output_root = work_dir / "training-output"
    work_dir.mkdir(parents=True, exist_ok=True)

    emit_event(
        {
            "type": "runtime",
            "python": sys.version.split()[0],
            "torch": torch.__version__,
            "cudaAvailable": torch.cuda.is_available(),
            "device": args.device,
        }
    )

    extract_dataset(args.dataset_zip.resolve(), dataset_root)
    data_yaml = prepare_data_yaml(dataset_root, work_dir)
    emit_event({"type": "dataset_ready", "dataYaml": str(data_yaml)})

    model = YOLO(args.model)
    last_reported_epoch = 0

    def on_fit_epoch_end(trainer: Any) -> None:
        nonlocal last_reported_epoch
        epoch = int(getattr(trainer, "epoch", -1)) + 1
        if epoch <= last_reported_epoch or epoch > args.epochs:
            return
        last_reported_epoch = epoch
        emit_event(
            {
                "type": "epoch",
                "epoch": epoch,
                "epochs": args.epochs,
                "metrics": trainer_metrics(trainer),
            }
        )

    model.add_callback("on_fit_epoch_end", on_fit_epoch_end)
    train_options: dict[str, Any] = {
        "data": str(data_yaml),
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "project": str(output_root),
        "name": "run",
        "exist_ok": True,
        "workers": 0,
        "cache": False,
        "save": True,
        "plots": True,
        "verbose": True,
    }
    if args.device.lower() != "auto":
        train_options["device"] = args.device

    model.train(**train_options)
    trainer = model.trainer
    if trainer is None:
        raise RuntimeError("Ultralytics ไม่คืนค่า trainer หลังจบงาน")

    save_dir = Path(str(trainer.save_dir)).resolve()
    best = resolve_artifact(getattr(trainer, "best", None), save_dir / "weights" / "best.pt")
    last = resolve_artifact(getattr(trainer, "last", None), save_dir / "weights" / "last.pt")
    results_csv = save_dir / "results.csv"
    if not best.is_file():
        raise FileNotFoundError(f"เทรนจบแต่ไม่พบ best.pt ที่ {best}")

    emit_event(
        {
            "type": "complete",
            "saveDir": str(save_dir),
            "best": str(best),
            "last": str(last) if last.is_file() else None,
            "results": str(results_csv) if results_csv.is_file() else None,
            "metrics": trainer_metrics(trainer),
        }
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        emit_event({"type": "cancelled"})
        raise SystemExit(130)
    except Exception as error:
        emit_event({"type": "error", "message": str(error)})
        raise
