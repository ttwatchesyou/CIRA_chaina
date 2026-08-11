"use client";

import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ImageIcon,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnnotationCanvas, type AnnotationTool } from "@/components/annotation/annotation-canvas";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPrompt } from "@/components/ui/next-step-prompt";
import { ToolGuidePopover } from "@/components/ui/tool-guide-popover";
import { useToast } from "@/components/ui/toast-provider";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import { useStepGuide } from "@/lib/use-step-guide";
import type {
  AnnotationBox,
  AnnotationClassItem,
  AnnotationImageItem,
  AnnotationSaveResult,
  AnnotationWorkspaceData,
} from "@/types/annotation";

type SaveState = "idle" | "saving" | "saved" | "error";
type ImageFilter = "ALL" | "ANNOTATED" | "UNANNOTATED";

export function AnnotationWorkspace({ projectId }: { projectId: string }) {
  const { showToast } = useToast();
  const { activeGuide, flowActive, dismissGuide, completeGuide, showGuide } = useStepGuide();
  const [images, setImages] = useState<AnnotationImageItem[]>([]);
  const [classes, setClasses] = useState<AnnotationClassItem[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<AnnotationBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [tool, setTool] = useState<AnnotationTool>("select");
  const [past, setPast] = useState<AnnotationBox[][]>([]);
  const [future, setFuture] = useState<AnnotationBox[][]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingImage, setLoadingImage] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(false);
  const [search, setSearch] = useState("");
  const [imageFilter, setImageFilter] = useState<ImageFilter>("ALL");
  const [newClassName, setNewClassName] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState("");
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);

  const imagesRef = useRef<AnnotationImageItem[]>([]);
  const boxesRef = useRef<AnnotationBox[]>([]);
  const activeImageIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const editVersionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const loadVersionRef = useRef(0);

  const activeImage = images.find((image) => image.id === activeImageId) ?? null;
  const selectedBox = boxes.find((box) => box.id === selectedBoxId) ?? null;
  const activeIndex = activeImageId ? images.findIndex((image) => image.id === activeImageId) : -1;
  const filteredImages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return images.filter((image) => {
      if (imageFilter !== "ALL" && image.status !== imageFilter) return false;
      return !query || image.filename.toLowerCase().includes(query);
    });
  }, [imageFilter, images, search]);

  const fetchWorkspace = useCallback(async (initial = false) => {
    if (initial) setLoadingWorkspace(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/annotation-workspace`, { cache: "no-store" });
      const payload = await response.json() as ApiSuccess<AnnotationWorkspaceData> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถโหลดพื้นที่ Annotation ได้"));
      imagesRef.current = payload.data.images;
      setImages(payload.data.images);
      setClasses(payload.data.classes);
      setWorkspaceError(false);
      setActiveClassId((current) => current && payload.data.classes.some((item) => item.id === current) ? current : payload.data.classes[0]?.id ?? null);
      setActiveImageId((current) => {
        if (current && payload.data.images.some((image) => image.id === current)) return current;
        return payload.data.images.find((image) => image.status === "UNANNOTATED")?.id ?? payload.data.images[0]?.id ?? null;
      });
    } catch (error) {
      setWorkspaceError(true);
      if (!initial) showToast("error", error instanceof Error ? error.message : "ไม่สามารถรีเฟรชข้อมูล Annotation ได้");
    } finally {
      if (initial) setLoadingWorkspace(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    void fetchWorkspace(true);
  }, [fetchWorkspace]);

  const persistAnnotations = useCallback((imageId: string, snapshot: AnnotationBox[], version: number) => {
    const run = async () => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/images/${imageId}/annotations`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            annotations: snapshot.map((box) => ({
              classId: box.classId,
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            })),
          }),
          keepalive: true,
        });
        const payload = await response.json() as ApiSuccess<AnnotationSaveResult> | ApiFailure;
        if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถบันทึก Annotation ได้"));

        const nextImages = imagesRef.current.map((image) => image.id === imageId ? {
          ...image,
          status: payload.data.status,
          annotationCount: payload.data.annotationCount,
        } : image);
        imagesRef.current = nextImages;
        setImages(nextImages);
        setClasses((current) => current.map((visionClass) => ({
          ...visionClass,
          annotationCount: payload.data.classCounts[visionClass.id] ?? 0,
        })));
        if (activeImageIdRef.current === imageId && editVersionRef.current === version) {
          dirtyRef.current = false;
          setSavedAt(payload.data.savedAt);
          setSaveState("saved");
        }
        if (flowActive && nextImages.length > 0 && nextImages.every((image) => image.status === "ANNOTATED") && activeGuide !== "dataset-next") {
          showGuide("dataset-next");
        }
        return true;
      } catch (error) {
        if (activeImageIdRef.current === imageId) {
          dirtyRef.current = true;
          setSaveState("error");
        }
        showToast("error", error instanceof Error ? error.message : "บันทึกอัตโนมัติไม่สำเร็จ");
        return false;
      }
    };
    const queued = saveQueueRef.current.then(run, run);
    saveQueueRef.current = queued;
    return queued;
  }, [activeGuide, flowActive, showGuide, showToast]);

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const imageId = activeImageIdRef.current;
    if (!imageId || !dirtyRef.current) return true;
    return persistAnnotations(imageId, boxesRef.current, editVersionRef.current);
  }, [persistAnnotations]);

  useEffect(() => {
    activeImageIdRef.current = activeImageId;
    if (!activeImageId) {
      boxesRef.current = [];
      setBoxes([]);
      return;
    }
    const loadVersion = ++loadVersionRef.current;
    setLoadingImage(true);
    setSelectedBoxId(null);
    setPast([]);
    setFuture([]);
    setSaveState("idle");
    dirtyRef.current = false;
    editVersionRef.current = 0;

    void (async () => {
      try {
        const response = await fetch(`/api/images/${activeImageId}/annotations`, { cache: "no-store" });
        const payload = await response.json() as ApiSuccess<AnnotationBox[]> | ApiFailure;
        if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถโหลด Annotation ได้"));
        if (loadVersionRef.current !== loadVersion) return;
        boxesRef.current = payload.data;
        setBoxes(payload.data);
        setSaveState("saved");
        setSavedAt(null);
      } catch (error) {
        if (loadVersionRef.current !== loadVersion) return;
        boxesRef.current = [];
        setBoxes([]);
        setSaveState("error");
        showToast("error", error instanceof Error ? error.message : "ไม่สามารถโหลด Annotation ได้");
      } finally {
        if (loadVersionRef.current === loadVersion) setLoadingImage(false);
      }
    })();
  }, [activeImageId, showToast]);

  useEffect(() => {
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => window.removeEventListener("beforeunload", warnBeforeClose);
  }, []);

  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
  }, []);

  const scheduleSave = useCallback((previous: AnnotationBox[], next: AnnotationBox[]) => {
    boxesRef.current = next;
    setBoxes(next);
    dirtyRef.current = true;
    const version = ++editVersionRef.current;
    setSaveState("saving");
    const nextImages: AnnotationImageItem[] = imagesRef.current.map((image) => image.id === activeImageIdRef.current ? {
      ...image,
      status: next.length > 0 ? "ANNOTATED" : "UNANNOTATED",
      annotationCount: next.length,
    } : image);
    imagesRef.current = nextImages;
    setImages(nextImages);
    const previousCounts = countByClass(previous);
    const nextCounts = countByClass(next);
    setClasses((current) => current.map((visionClass) => ({
      ...visionClass,
      annotationCount: Math.max(0, visionClass.annotationCount + (nextCounts[visionClass.id] ?? 0) - (previousCounts[visionClass.id] ?? 0)),
    })));
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const imageId = activeImageIdRef.current;
      if (imageId) void persistAnnotations(imageId, boxesRef.current, version);
    }, 650);
  }, [persistAnnotations]);

  const commitBoxes = useCallback((next: AnnotationBox[], nextSelectedId?: string | null) => {
    const previous = boxesRef.current;
    if (sameBoxes(previous, next)) return;
    setPast((current) => [...current.slice(-49), previous]);
    setFuture([]);
    setSelectedBoxId(nextSelectedId === undefined ? selectedBoxId : nextSelectedId);
    scheduleSave(previous, next);
  }, [scheduleSave, selectedBoxId]);

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    const current = boxesRef.current;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [current, ...items].slice(0, 50));
    setSelectedBoxId(null);
    scheduleSave(current, previous);
  }, [past, scheduleSave]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    const current = boxesRef.current;
    setPast((items) => [...items.slice(-49), current]);
    setFuture((items) => items.slice(1));
    setSelectedBoxId(null);
    scheduleSave(current, next);
  }, [future, scheduleSave]);

  const deleteSelected = useCallback(() => {
    if (!selectedBoxId) return;
    commitBoxes(boxesRef.current.filter((box) => box.id !== selectedBoxId), null);
  }, [commitBoxes, selectedBoxId]);

  const selectImage = useCallback(async (imageId: string) => {
    if (imageId === activeImageIdRef.current || loadingImage) return;
    const saved = await flushSave();
    if (!saved) return;
    setActiveImageId(imageId);
  }, [flushSave, loadingImage]);

  const goToImage = useCallback((direction: -1 | 1) => {
    const currentIndex = images.findIndex((image) => image.id === activeImageIdRef.current);
    const next = images[currentIndex + direction];
    if (next) void selectImage(next.id);
  }, [images, selectImage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select") || target?.isContentEditable) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (event.key.toLowerCase() === "b") {
        setTool("box");
      } else if (event.key.toLowerCase() === "v") {
        setTool("select");
      } else if (event.key.toLowerCase() === "h") {
        setTool("pan");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToImage(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToImage(-1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, goToImage, redo, undo]);

  async function createClass(event: React.FormEvent) {
    event.preventDefault();
    const name = newClassName.trim();
    if (!name || creatingClass) return;
    setCreatingClass(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json() as ApiSuccess<AnnotationClassItem> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถสร้างคลาสได้"));
      setClasses((current) => [...current, payload.data]);
      setActiveClassId(payload.data.id);
      setNewClassName("");
      setTool("box");
      showToast("success", `สร้างคลาส “${payload.data.name}” แล้ว`);
      if (flowActive) showGuide("box");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "ไม่สามารถสร้างคลาสได้");
    } finally {
      setCreatingClass(false);
    }
  }

  async function renameClass(classId: string) {
    const name = editingClassName.trim();
    if (!name) return;
    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json() as ApiSuccess<AnnotationClassItem> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถเปลี่ยนชื่อคลาสได้"));
      setClasses((current) => current.map((item) => item.id === classId ? payload.data : item));
      setEditingClassId(null);
      showToast("success", "เปลี่ยนชื่อคลาสแล้ว");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนชื่อคลาสได้");
    }
  }

  async function deleteClass(visionClass: AnnotationClassItem, force = false) {
    if (deletingClassId) return;
    if (visionClass.annotationCount > 0 && !force) {
      setConfirmDeleteClassId(visionClass.id);
      return;
    }
    setDeletingClassId(visionClass.id);
    try {
      const saved = await flushSave();
      if (!saved) return;
      const response = await fetch(`/api/classes/${visionClass.id}${force ? "?force=true" : ""}`, { method: "DELETE" });
      const payload = await response.json() as ApiSuccess<{ deleted: true }> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error(apiMessage(payload, "ไม่สามารถลบคลาสได้"));
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      dirtyRef.current = false;
      const filtered = boxesRef.current.filter((box) => box.classId !== visionClass.id);
      boxesRef.current = filtered;
      setBoxes(filtered);
      setPast([]);
      setFuture([]);
      setSelectedBoxId(null);
      setSaveState("saved");
      setConfirmDeleteClassId(null);
      setActiveClassId((current) => current === visionClass.id ? classes.find((item) => item.id !== visionClass.id)?.id ?? null : current);
      await fetchWorkspace(false);
      showToast("success", `ลบคลาส “${visionClass.name}” แล้ว`);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "ไม่สามารถลบคลาสได้");
    } finally {
      setDeletingClassId(null);
    }
  }

  function selectClass(classId: string) {
    setActiveClassId(classId);
    if (selectedBoxId) {
      commitBoxes(boxesRef.current.map((box) => box.id === selectedBoxId ? { ...box, classId } : box), selectedBoxId);
    }
  }

  if (loadingWorkspace) return <div className="h-[70vh] animate-pulse rounded-xl border bg-white shadow-card" />;
  if (workspaceError && images.length === 0) {
    return <EmptyState icon={CircleAlert} title="โหลดพื้นที่ Annotation ไม่สำเร็จ" description="ตรวจการเชื่อมต่อ Server แล้วลองอีกครั้ง" action={<button type="button" onClick={() => void fetchWorkspace(true)} className="action-primary guide-action inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"><RotateCcw className="size-4" />ลองอีกครั้ง</button>} />;
  }
  if (images.length === 0) {
    return (
      <div>
        <AnnotationHeader images={images} saveState="idle" savedAt={null} />
        <EmptyState icon={ImageIcon} title="ยังไม่มีรูปสำหรับทำ Annotation" description="อัปโหลดรูป JPG, PNG หรือ WebP ก่อน แล้วกลับมาวาด Bounding Box ที่หน้านี้" action={<Link href={`/projects/${projectId}/upload`} className="action-highlight guide-action rounded-lg px-4 py-2 text-sm font-semibold">อัปโหลดรูป</Link>} />
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <AnnotationHeader images={images} saveState={saveState} savedAt={savedAt} onRetry={() => void flushSave()} />
      <div className="mt-4 grid min-h-0 gap-4 xl:grid-cols-[240px_minmax(0,1fr)_260px]">
        <aside className="order-2 overflow-hidden rounded-xl border bg-white shadow-card xl:order-1 xl:flex xl:h-[calc(100vh-9.5rem)] xl:min-h-[620px] xl:flex-col">
          <div className="border-b p-3">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted">รูปภาพ</p>
            <label className="relative mt-2 block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหารูป" className="h-9 w-full rounded-lg border bg-white pl-8 pr-3 text-xs text-ink" />
            </label>
            <div className="mt-2 flex rounded-lg bg-slate-100 p-1">
              {(["ALL", "UNANNOTATED", "ANNOTATED"] as const).map((filter) => (
                <button key={filter} type="button" onClick={() => setImageFilter(filter)} className={`min-w-0 flex-1 rounded-md px-1.5 py-1 text-[10px] font-semibold ${imageFilter === filter ? "bg-white text-primary shadow-sm" : "text-muted"}`}>{filter === "ALL" ? "ทั้งหมด" : filter === "ANNOTATED" ? "เสร็จแล้ว" : "ยังไม่ทำ"}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto p-2 xl:flex-1 xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden">
            {filteredImages.map((image) => {
              const active = image.id === activeImageId;
              return (
                <button key={image.id} type="button" onClick={() => void selectImage(image.id)} className={`flex w-52 shrink-0 items-center gap-2 rounded-lg border p-2 text-left transition-colors xl:w-full ${active ? "border-primary bg-[#f0ecfa]" : "border-transparent hover:border-line hover:bg-slate-50"}`}>
                  <span className="relative block size-11 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    <Image src={image.thumbnailUrl} alt="" fill unoptimized sizes="44px" className="object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink" title={image.filename}>{image.filename}</span>
                    <span className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${image.status === "ANNOTATED" ? "text-success" : "text-muted"}`}>
                      <span className={`size-1.5 rounded-full ${image.status === "ANNOTATED" ? "bg-success" : "bg-slate-300"}`} />
                      {image.status === "ANNOTATED" ? `${image.annotationCount} กรอบ` : "ยังไม่ทำ Annotation"}
                    </span>
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-400">{images.findIndex((item) => item.id === image.id) + 1}</span>
                </button>
              );
            })}
            {filteredImages.length === 0 ? <p className="p-4 text-center text-xs text-muted">ไม่พบรูปที่ตรงกับการค้นหา</p> : null}
          </div>
        </aside>

        <section className="order-1 flex min-w-0 flex-col xl:order-2 xl:h-[calc(100vh-9.5rem)] xl:min-h-[620px]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{activeImage?.filename}</p>
              <p className="mt-0.5 text-xs text-muted">{activeImage ? `${activeImage.width} × ${activeImage.height}` : "เลือกรูปภาพ"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" disabled={activeIndex <= 0} onClick={() => goToImage(-1)} className="guide-action grid size-8 place-items-center rounded-lg border bg-white text-muted hover:text-ink disabled:opacity-40" aria-label="รูปก่อนหน้า"><ChevronLeft className="size-4" /></button>
              <span className="min-w-14 text-center text-xs tabular-nums text-muted">{activeIndex + 1} / {images.length}</span>
              <button type="button" disabled={activeIndex < 0 || activeIndex >= images.length - 1} onClick={() => goToImage(1)} className="guide-action grid size-8 place-items-center rounded-lg border bg-white text-muted hover:text-ink disabled:opacity-40" aria-label="รูปถัดไป"><ChevronRight className="size-4" /></button>
            </div>
          </div>
          <div className="relative flex min-h-[480px] flex-1">
            {activeImage ? <AnnotationCanvas image={activeImage} boxes={boxes} classes={classes} selectedBoxId={selectedBoxId} tool={tool} activeClassId={activeClassId} canUndo={past.length > 0} canRedo={future.length > 0} showBoxGuide={activeGuide === "box"} onGuideComplete={completeGuide} onGuideDismiss={dismissGuide} onToolChange={setTool} onSelectBox={setSelectedBoxId} onCommit={commitBoxes} onUndo={undo} onRedo={redo} onDelete={deleteSelected} onMissingClass={() => showToast("error", "กรุณาสร้างและเลือกคลาสก่อนวาดกรอบ")} /> : null}
            {loadingImage ? <div className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-[#211a35]/75 text-sm text-slate-300"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />กำลังโหลด Annotation…</span></div> : null}
          </div>
        </section>

        <aside className="order-3 overflow-hidden rounded-xl border bg-white shadow-card xl:flex xl:h-[calc(100vh-9.5rem)] xl:min-h-[620px] xl:flex-col">
          <div className="border-b p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-ink">คลาส</p><p className="mt-0.5 text-xs text-muted">เลือก Label ก่อนเริ่มวาดกรอบ</p></div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-muted">{classes.length}</span>
            </div>
            <form onSubmit={createClass} className="relative mt-3 flex gap-2">
              <input value={newClassName} onFocus={() => { if (activeGuide === "class") completeGuide(); }} onChange={(event) => setNewClassName(event.target.value)} maxLength={50} placeholder="เช่น bottle" className="h-9 min-w-0 flex-1 rounded-lg border bg-white px-3 text-xs text-ink" />
              <button type="submit" onClick={() => { if (activeGuide === "class") completeGuide(); }} disabled={!newClassName.trim() || creatingClass} className="action-highlight guide-action grid size-9 shrink-0 place-items-center rounded-lg disabled:opacity-50" aria-label="สร้างคลาส">{creatingClass ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}</button>
              {activeGuide === "class" ? <ToolGuidePopover title="สร้าง Class ตรงนี้" description="กดช่องนี้แล้วพิมพ์ชื่อวัตถุ เช่น คน รถ หรือขวด จากนั้นกดปุ่ม + เพื่อบันทึก" onDismiss={dismissGuide} placement="below-right" className="w-56" /> : null}
            </form>
          </div>
          <div className="max-h-80 overflow-y-auto p-2 xl:max-h-none xl:flex-1">
            {classes.length === 0 ? <div className="m-2 rounded-lg border border-dashed p-4 text-center text-xs leading-5 text-muted">สร้างคลาสแรก แล้วเลือกเครื่องมือ Bounding Box เพื่อเริ่มตีกรอบ</div> : null}
            {classes.map((visionClass) => {
              const active = visionClass.id === activeClassId;
              const editing = visionClass.id === editingClassId;
              const confirming = visionClass.id === confirmDeleteClassId;
              return (
                <div key={visionClass.id} className={`mb-1 rounded-lg border ${active ? "border-primary bg-[#f0ecfa]" : "border-transparent hover:bg-slate-50"}`}>
                  {editing ? (
                    <div className="flex items-center gap-1.5 p-2">
                      <input autoFocus value={editingClassName} onChange={(event) => setEditingClassName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameClass(visionClass.id); if (event.key === "Escape") setEditingClassId(null); }} className="h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-xs text-ink" />
                      <button type="button" onClick={() => void renameClass(visionClass.id)} className="grid size-7 place-items-center rounded text-success hover:bg-white" aria-label="บันทึกชื่อคลาส"><Check className="size-3.5" /></button>
                      <button type="button" onClick={() => setEditingClassId(null)} className="grid size-7 place-items-center rounded text-muted hover:bg-white" aria-label="ยกเลิกการเปลี่ยนชื่อ"><X className="size-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 p-1.5">
                      <button type="button" onClick={() => selectClass(visionClass.id)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-left">
                        <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: visionClass.color }} />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{visionClass.name}</span>
                        <span className="text-[10px] tabular-nums text-muted">{visionClass.annotationCount}</span>
                      </button>
                      <button type="button" onClick={() => { setEditingClassId(visionClass.id); setEditingClassName(visionClass.name); }} className="grid size-7 place-items-center rounded text-muted hover:bg-white hover:text-ink" aria-label={`เปลี่ยนชื่อ ${visionClass.name}`}><Pencil className="size-3.5" /></button>
                      <button type="button" onClick={() => void deleteClass(visionClass)} className="grid size-7 place-items-center rounded text-muted hover:bg-white hover:text-danger" aria-label={`ลบ ${visionClass.name}`}><Trash2 className="size-3.5" /></button>
                    </div>
                  )}
                  {confirming ? (
                    <div className="border-t border-[#ead3d3] bg-[#fff7f7] p-2.5">
                      <p className="text-[11px] leading-4 text-danger">ลบ Annotation {visionClass.annotationCount} รายการที่ใช้คลาสนี้หรือไม่?</p>
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={() => setConfirmDeleteClassId(null)} className="rounded-md border bg-white px-2 py-1 text-[11px] font-medium text-ink">ยกเลิก</button>
                        <button type="button" disabled={deletingClassId === visionClass.id} onClick={() => void deleteClass(visionClass, true)} className="rounded-md bg-danger px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">ลบทั้งหมด</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="border-t bg-slate-50 p-3 text-[11px] leading-5 text-muted">
            {selectedBox ? <p>กรอบที่เลือก: <span className="font-semibold text-ink">{classes.find((item) => item.id === selectedBox.classId)?.name ?? "ไม่ทราบคลาส"}</span> เลือกคลาสอื่นเพื่อเปลี่ยน Label</p> : <p><span className="font-semibold text-ink">คีย์ลัด:</span> B วาด · V เลือก · H เลื่อน · Del ลบ · Ctrl+Z ย้อนกลับ · ← → เปลี่ยนรูป</p>}
          </div>
        </aside>
      </div>
      {activeGuide === "dataset-next" ? <NextStepPrompt title="ตีกรอบครบแล้ว ไปสร้าง Dataset ต่อ" description="รูปทุกภาพมี Annotation แล้ว ขั้นถัดไปคือรวมรูปและ Label เป็น Dataset สำหรับ Train" href={`/projects/${projectId}/dataset?guide=dataset&tour=1`} actionLabel="ไปสร้าง Dataset" onDismiss={dismissGuide} /> : null}
    </div>
  );
}

function AnnotationHeader({ images, saveState, savedAt, onRetry }: { images: AnnotationImageItem[]; saveState: SaveState; savedAt: string | null; onRetry?: () => void }) {
  const annotated = images.filter((image) => image.status === "ANNOTATED").length;
  const percent = images.length > 0 ? Math.round(annotated / images.length * 100) : 0;
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-[0.1em] text-primary">พื้นที่ทำ Annotation</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">ตีกรอบวัตถุในรูป</h1>
        <p className="mt-1 text-sm text-muted">วาด Bounding Box สำหรับ Object Detection ระบบบันทึกการเปลี่ยนแปลงให้อัตโนมัติ</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-40">
          <div className="flex justify-between text-[11px] font-medium text-muted"><span>ทำแล้ว {annotated} / {images.length} รูป</span><span>{percent}%</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-[#4f83b9] to-[#8069b5]" style={{ width: `${percent}%` }} /></div>
        </div>
        <SaveIndicator state={saveState} savedAt={savedAt} onRetry={onRetry} />
      </div>
    </header>
  );
}

function SaveIndicator({ state, savedAt, onRetry }: { state: SaveState; savedAt: string | null; onRetry?: () => void }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0ecfa] px-2.5 py-1 text-xs font-medium text-primary"><LoaderCircle className="size-3.5 animate-spin" />กำลังบันทึก…</span>;
  if (state === "error") return <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-[#faecec] px-2.5 py-1 text-xs font-medium text-danger"><CircleAlert className="size-3.5" />บันทึกไม่สำเร็จ · ลองใหม่</button>;
  if (state === "saved") return <span title={savedAt ? new Date(savedAt).toLocaleString("th-TH") : undefined} className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f1eb] px-2.5 py-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" />บันทึกแล้ว</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-muted"><RotateCcw className="size-3.5" />พร้อมใช้งาน</span>;
}

function countByClass(boxes: AnnotationBox[]) {
  return boxes.reduce<Record<string, number>>((counts, box) => {
    counts[box.classId] = (counts[box.classId] ?? 0) + 1;
    return counts;
  }, {});
}

function sameBoxes(left: AnnotationBox[], right: AnnotationBox[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function apiMessage(payload: ApiSuccess<unknown> | ApiFailure, fallback: string) {
  return "error" in payload ? payload.error.message : fallback;
}
