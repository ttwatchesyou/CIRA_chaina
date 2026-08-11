"use client";

import Konva from "konva";
import {
  BoxSelect,
  Expand,
  Hand,
  MousePointer2,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cloneElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Label, Layer, Rect, Stage, Tag, Text, Transformer } from "react-konva";

import { ToolGuidePopover } from "@/components/ui/tool-guide-popover";
import type { AnnotationBox, AnnotationClassItem, AnnotationImageItem } from "@/types/annotation";

export type AnnotationTool = "select" | "box" | "pan";

type AnnotationCanvasProps = {
  image: AnnotationImageItem;
  boxes: AnnotationBox[];
  classes: AnnotationClassItem[];
  selectedBoxId: string | null;
  tool: AnnotationTool;
  activeClassId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  showBoxGuide: boolean;
  onGuideComplete: () => void;
  onGuideDismiss: () => void;
  onToolChange: (tool: AnnotationTool) => void;
  onSelectBox: (id: string | null) => void;
  onCommit: (boxes: AnnotationBox[], selectedId?: string | null) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onMissingClass: () => void;
};

type Viewport = { x: number; y: number; scale: number };
type Point = { x: number; y: number };

const MIN_BOX_SCREEN_SIZE = 5;

export function AnnotationCanvas({
  image,
  boxes,
  classes,
  selectedBoxId,
  tool,
  activeClassId,
  canUndo,
  canRedo,
  showBoxGuide,
  onGuideComplete,
  onGuideDismiss,
  onToolChange,
  onSelectBox,
  onCommit,
  onUndo,
  onRedo,
  onDelete,
  onMissingClass,
}: AnnotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedShapeRef = useRef<Konva.Rect | null>(null);
  const drawingStartRef = useRef<Point | null>(null);
  const panStartRef = useRef<{ pointer: Point; viewport: Viewport } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 720, height: 560 });
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [draft, setDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const imageWidth = imageElement?.naturalWidth || image.width;
  const imageHeight = imageElement?.naturalHeight || image.height;
  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);
  const selectedClassColor = selectedBoxId
    ? classMap.get(boxes.find((box) => box.id === selectedBoxId)?.classId ?? "")?.color ?? "#597A96"
    : "#597A96";

  const fitImage = useCallback(() => {
    if (!imageWidth || !imageHeight) return;
    const padding = stageSize.width < 640 ? 16 : 40;
    const availableWidth = Math.max(1, stageSize.width - padding * 2);
    const availableHeight = Math.max(1, stageSize.height - padding * 2);
    const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
    setViewport({
      scale,
      x: (stageSize.width - imageWidth * scale) / 2,
      y: (stageSize.height - imageHeight * scale) / 2,
    });
  }, [imageHeight, imageWidth, stageSize.height, stageSize.width]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const nextWidth = Math.max(1, Math.floor(entry.contentRect.width));
      const nextHeight = Math.max(420, Math.floor(entry.contentRect.height));
      setStageSize({ width: nextWidth, height: nextHeight });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setImageElement(null);
    setImageError(false);
    const nextImage = new window.Image();
    nextImage.onload = () => setImageElement(nextImage);
    nextImage.onerror = () => setImageError(true);
    nextImage.src = image.fileUrl;
    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [image.fileUrl]);

  useEffect(() => {
    if (imageElement) fitImage();
  }, [fitImage, imageElement]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    if (!selectedBoxId) selectedShapeRef.current = null;
    transformer.nodes(selectedBoxId && selectedShapeRef.current ? [selectedShapeRef.current] : []);
    transformer.getLayer()?.batchDraw();
  }, [boxes, selectedBoxId, tool]);

  function pointerInImage(): Point | null {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return null;
    return {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale,
    };
  }

  function handlePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;

    if (tool === "pan") {
      panStartRef.current = { pointer, viewport };
      return;
    }
    if (tool === "box") {
      if (!activeClassId) {
        onMissingClass();
        return;
      }
      const imagePoint = pointerInImage();
      if (!imagePoint || !isInsideImage(imagePoint, imageWidth, imageHeight)) return;
      drawingStartRef.current = imagePoint;
      setDraft({ x: imagePoint.x, y: imagePoint.y, width: 0, height: 0 });
      onSelectBox(null);
      return;
    }
    if (event.target === event.target.getStage()) onSelectBox(null);
  }

  function handlePointerMove() {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    if (panStartRef.current) {
      const start = panStartRef.current;
      setViewport({
        ...start.viewport,
        x: start.viewport.x + pointer.x - start.pointer.x,
        y: start.viewport.y + pointer.y - start.pointer.y,
      });
      return;
    }
    if (!drawingStartRef.current) return;
    const rawPoint = pointerInImage();
    if (!rawPoint) return;
    const point = { x: clamp(rawPoint.x, 0, imageWidth), y: clamp(rawPoint.y, 0, imageHeight) };
    const start = drawingStartRef.current;
    setDraft({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    });
  }

  function handlePointerUp() {
    panStartRef.current = null;
    if (!draft || !drawingStartRef.current || !activeClassId) {
      drawingStartRef.current = null;
      setDraft(null);
      return;
    }
    drawingStartRef.current = null;
    const largeEnough = draft.width * viewport.scale >= MIN_BOX_SCREEN_SIZE && draft.height * viewport.scale >= MIN_BOX_SCREEN_SIZE;
    if (largeEnough) {
      const id = createLocalId();
      const nextBox: AnnotationBox = {
        id,
        classId: activeClassId,
        x: clamp01(draft.x / imageWidth),
        y: clamp01(draft.y / imageHeight),
        width: clamp01(draft.width / imageWidth),
        height: clamp01(draft.height / imageHeight),
      };
      onCommit([...boxes, nextBox], id);
    }
    setDraft(null);
  }

  function zoomAt(point: Point, multiplier: number) {
    const minScale = Math.min(
      Math.max(1, stageSize.width - 40) / imageWidth,
      Math.max(1, stageSize.height - 40) / imageHeight,
    ) * 0.45;
    const maxScale = Math.max(minScale, minScale * 18);
    const nextScale = clamp(viewport.scale * multiplier, minScale, maxScale);
    const imagePoint = {
      x: (point.x - viewport.x) / viewport.scale,
      y: (point.y - viewport.y) / viewport.scale,
    };
    setViewport({
      scale: nextScale,
      x: point.x - imagePoint.x * nextScale,
      y: point.y - imagePoint.y * nextScale,
    });
  }

  function zoomFromCenter(multiplier: number) {
    zoomAt({ x: stageSize.width / 2, y: stageSize.height / 2 }, multiplier);
  }

  function updateBox(id: string, rect: { x: number; y: number; width: number; height: number }) {
    const x = clamp(rect.x, 0, imageWidth - 1);
    const y = clamp(rect.y, 0, imageHeight - 1);
    const width = clamp(rect.width, 1, imageWidth - x);
    const height = clamp(rect.height, 1, imageHeight - y);
    onCommit(boxes.map((box) => box.id === id ? {
      ...box,
      x: clamp01(x / imageWidth),
      y: clamp01(y / imageHeight),
      width: clamp01(width / imageWidth),
      height: clamp01(height / imageHeight),
    } : box), id);
  }

  const cursor = tool === "box" ? "crosshair" : tool === "pan" ? "grab" : "default";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-[#171425] shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#5a4c70] bg-[linear-gradient(90deg,#263d5a,#3a2b54)] px-3 py-2 text-slate-200">
        <div className="flex items-center gap-1">
          <ToolButton active={tool === "select"} title="เลือกกรอบ (V)" onClick={() => onToolChange("select")}><MousePointer2 /></ToolButton>
          <div className="relative">
            <ToolButton active={tool === "box"} title="วาด Bounding Box (B)" onClick={() => { onToolChange("box"); if (showBoxGuide) onGuideComplete(); }}><BoxSelect /></ToolButton>
            {showBoxGuide ? <ToolGuidePopover title="เลือกเครื่องมือตีกรอบ" description="กดปุ่มกรอบเส้นประนี้ แล้วลากเมาส์ครอบวัตถุในรูป เมื่อกดปุ่มนี้คำแนะนำจะหายไป" onDismiss={onGuideDismiss} placement="below-left" /> : null}
          </div>
          <ToolButton active={tool === "pan"} title="เลื่อนพื้นที่ (H)" onClick={() => onToolChange("pan")}><Hand /></ToolButton>
          <span className="mx-1 h-5 w-px bg-slate-600" />
          <ToolButton disabled={!selectedBoxId} title="ลบกรอบที่เลือก (Delete)" onClick={onDelete}><Trash2 /></ToolButton>
          <ToolButton disabled={!canUndo} title="ย้อนกลับ (Ctrl+Z)" onClick={onUndo}><Undo2 /></ToolButton>
          <ToolButton disabled={!canRedo} title="ทำซ้ำ (Ctrl+Shift+Z)" onClick={onRedo}><Redo2 /></ToolButton>
        </div>
        <div className="flex items-center gap-1">
          <ToolButton title="ซูมออก" onClick={() => zoomFromCenter(0.8)}><ZoomOut /></ToolButton>
          <span className="min-w-12 text-center text-[11px] font-medium text-slate-400">{Math.round(viewport.scale * 100)}%</span>
          <ToolButton title="ซูมเข้า" onClick={() => zoomFromCenter(1.25)}><ZoomIn /></ToolButton>
          <ToolButton title="พอดีกับพื้นที่" onClick={fitImage}><Expand /></ToolButton>
          <ToolButton title="รีเซ็ตมุมมอง" onClick={() => { fitImage(); onToolChange("select"); }}><RotateCcw /></ToolButton>
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-[420px] flex-1 overflow-hidden" style={{ cursor, touchAction: "none" }}>
        {!imageElement && !imageError ? <div className="absolute inset-0 z-10 grid place-items-center text-sm text-slate-400">กำลังโหลดรูป…</div> : null}
        {imageError ? <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center text-sm text-red-300">ไม่สามารถโหลดรูปต้นฉบับได้</div> : null}
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onWheel={(event) => {
            event.evt.preventDefault();
            const pointer = stageRef.current?.getPointerPosition();
            if (pointer) zoomAt(pointer, event.evt.deltaY > 0 ? 0.9 : 1.1);
          }}
        >
          <Layer>
            <Group x={viewport.x} y={viewport.y} scaleX={viewport.scale} scaleY={viewport.scale} clipWidth={imageWidth} clipHeight={imageHeight}>
              {imageElement ? <KonvaImage image={imageElement} width={imageWidth} height={imageHeight} listening={false} /> : null}
              {boxes.map((box) => {
                const visionClass = classMap.get(box.classId);
                const color = visionClass?.color ?? "#DCE3EA";
                const x = box.x * imageWidth;
                const y = box.y * imageHeight;
                const width = box.width * imageWidth;
                const height = box.height * imageHeight;
                const selected = box.id === selectedBoxId;
                return (
                  <Group key={box.id}>
                    <Rect
                      id={`annotation-${box.id}`}
                      ref={(node) => { if (selected) selectedShapeRef.current = node; }}
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={`${color}${selected ? "1F" : "0D"}`}
                      stroke={color}
                      strokeWidth={(selected ? 2.25 : 1.5) / viewport.scale}
                      hitStrokeWidth={10 / viewport.scale}
                      shadowColor="#0f172a"
                      shadowBlur={selected ? 4 / viewport.scale : 0}
                      shadowOpacity={selected ? 0.18 : 0}
                      perfectDrawEnabled={false}
                      draggable={tool === "select"}
                      onMouseDown={(event) => { event.cancelBubble = true; onSelectBox(box.id); }}
                      onTap={(event) => { event.cancelBubble = true; onSelectBox(box.id); }}
                      onDragStart={() => onSelectBox(box.id)}
                      onDragEnd={(event) => updateBox(box.id, { x: event.target.x(), y: event.target.y(), width, height })}
                      onTransformEnd={(event) => {
                        const node = event.target;
                        const next = {
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(1, node.width() * node.scaleX()),
                          height: Math.max(1, node.height() * node.scaleY()),
                        };
                        node.scaleX(1);
                        node.scaleY(1);
                        updateBox(box.id, next);
                      }}
                    />
                    <Label x={x + 8 / viewport.scale} y={y >= 27 / viewport.scale ? y - 24 / viewport.scale : y + 5 / viewport.scale} listening={false}>
                      <Tag fill={color} cornerRadius={5 / viewport.scale} shadowColor="#0f172a" shadowBlur={3 / viewport.scale} shadowOpacity={0.2} />
                      <Text text={visionClass?.name ?? "ไม่ทราบคลาส"} fontSize={10.5 / viewport.scale} fontStyle="bold" fill="#ffffff" padding={4.5 / viewport.scale} />
                    </Label>
                  </Group>
                );
              })}
              {draft ? <Rect {...draft} fill="#6D63A933" stroke="#89b9e8" strokeWidth={2 / viewport.scale} dash={[6 / viewport.scale, 4 / viewport.scale]} listening={false} /> : null}
            </Group>
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              flipEnabled={false}
              enabledAnchors={["top-left", "top-center", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-center", "bottom-right"]}
              anchorSize={7}
              anchorCornerRadius={4}
              anchorStroke={selectedClassColor}
              anchorStrokeWidth={1.5}
              anchorFill="#ffffff"
              borderStroke={selectedClassColor}
              borderStrokeWidth={1.5}
              boundBoxFunc={(oldBox, newBox) => Math.abs(newBox.width) < MIN_BOX_SCREEN_SIZE || Math.abs(newBox.height) < MIN_BOX_SCREEN_SIZE ? oldBox : newBox}
            />
          </Layer>
        </Stage>
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/55 px-2 py-1 text-[11px] text-slate-300">เลื่อน Scroll เพื่อซูม · ใช้เครื่องมือรูปมือเพื่อเลื่อนภาพ</div>
      </div>
    </div>
  );
}

function ToolButton({ children, active = false, disabled = false, title, onClick }: {
  children: React.ReactElement<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${active ? "bg-[#e8d99f] text-[#324f72]" : "text-[#a9d2f5] hover:bg-white/10 hover:text-white"}`}
    >
      {cloneElement(children, { className: "size-4" })}
    </button>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function isInsideImage(point: Point, width: number, height: number) {
  return point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height;
}

function createLocalId() {
  if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
  return `box-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
