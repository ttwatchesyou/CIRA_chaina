"use client";

import { ChevronLeft, ChevronRight, Filter, ImageIcon, LoaderCircle, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { formatRelativeTime } from "@/lib/format";
import { formatByteSize } from "@/lib/image-validation";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import type { ImageLibraryPage } from "@/types/image";

type ImageLibraryProps = {
  projectId: string;
  refreshToken: number;
};

type FilterStatus = "ALL" | "ANNOTATED" | "UNANNOTATED";

export function ImageLibrary({ projectId, refreshToken }: ImageLibraryProps) {
  const { showToast } = useToast();
  const [library, setLibrary] = useState<ImageLibraryPage | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("ALL");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const parameters = new URLSearchParams({ page: page.toString(), pageSize: "24", sort });
      if (search.trim()) parameters.set("query", search.trim());
      if (status !== "ALL") parameters.set("status", status);

      const response = await fetch(`/api/projects/${projectId}/images?${parameters.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as ApiSuccess<ImageLibraryPage> | ApiFailure;
      if (!response.ok || !("data" in payload)) throw new Error("ไม่สามารถโหลดรูปภาพได้");
      setLibrary(payload.data);
    } catch {
      setLibrary(null);
      showToast("error", "ไม่สามารถโหลดคลังรูปภาพได้");
    } finally {
      setLoading(false);
    }
  }, [page, projectId, search, showToast, sort, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadImages(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadImages, refreshToken, search]);

  function updateStatus(nextStatus: FilterStatus) {
    setStatus(nextStatus);
    setPage(1);
  }

  function updateSort(nextSort: "newest" | "oldest" | "name") {
    setSort(nextSort);
    setPage(1);
  }

  async function handleDelete(imageId: string, filename: string) {
    if (!window.confirm(`ลบ “${filename}” หรือไม่? Annotation ของรูปนี้จะถูกลบด้วยและย้อนกลับไม่ได้`)) return;
    setDeletingId(imageId);

    try {
      const response = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("ลบรูปไม่สำเร็จ");
      showToast("success", `ลบ “${filename}” แล้ว`);
      await loadImages();
    } catch {
      showToast("error", "ไม่สามารถลบรูปภาพได้");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">คลังรูปภาพ</h2>
          <p className="mt-1 text-sm text-muted">ค้นหาและตรวจรูปที่เก็บไว้ในโปรเจกต์นี้</p>
        </div>
        {library ? <p className="text-sm text-muted">ทั้งหมด <span className="font-semibold text-ink">{library.total}</span> รูป</p> : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="ค้นหาชื่อไฟล์" className="h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-sm text-ink placeholder:text-slate-400" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg border bg-white p-1">
            <Filter className="ml-1 size-3.5 text-muted" />
            {(["ALL", "UNANNOTATED", "ANNOTATED"] as const).map((filter) => (
              <button key={filter} type="button" onClick={() => updateStatus(filter)} className={`rounded-md px-2 py-1 text-xs font-medium ${status === filter ? "bg-[#eaf0f4] text-primary" : "text-muted hover:bg-slate-50 hover:text-ink"}`}>
                {filter === "ALL" ? "ทั้งหมด" : filter === "ANNOTATED" ? "ทำแล้ว" : "ยังไม่ทำ"}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(event) => updateSort(event.target.value as typeof sort)} aria-label="เรียงรูปภาพ" className="h-9 rounded-lg border bg-white px-2 text-xs text-ink">
            <option value="newest">ใหม่ที่สุดก่อน</option>
            <option value="oldest">เก่าที่สุดก่อน</option>
            <option value="name">ชื่อไฟล์ A–Z</option>
          </select>
        </div>
      </div>

      {loading ? <LibraryLoading /> : null}
      {!loading && library?.images.length === 0 ? <EmptyState icon={ImageIcon} title="ไม่พบรูปภาพ" description={search || status !== "ALL" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "อัปโหลดรูปแรกด้านบนเพื่อเริ่มทำ Annotation"} /> : null}
      {!loading && library && library.images.length > 0 ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {library.images.map((image) => (
              <article key={image.id} className="group overflow-hidden rounded-xl border bg-white shadow-card">
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <Image src={image.fileUrl} alt={image.filename} fill unoptimized sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-semibold ${image.status === "ANNOTATED" ? "bg-[#e7f0e9] text-success" : "bg-white/90 text-muted"}`}>{image.status === "ANNOTATED" ? "ทำ Annotation แล้ว" : "ยังไม่ทำ"}</span>
                  <button type="button" disabled={deletingId === image.id} onClick={() => void handleDelete(image.id, image.filename)} className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-white/90 text-danger opacity-0 shadow-sm transition-opacity hover:bg-white disabled:cursor-wait group-hover:opacity-100 focus:opacity-100" aria-label={`ลบ ${image.filename}`}>
                    {deletingId === image.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </button>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-ink" title={image.filename}>{image.filename}</p>
                  <div className="mt-1 flex justify-between gap-2 text-xs text-muted"><span>{formatByteSize(image.byteSize)}</span><span>{formatRelativeTime(image.uploadedAt)}</span></div>
                </div>
              </article>
            ))}
          </div>
          {library.totalPages > 1 ? (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm text-muted">หน้า {library.page} จาก {library.totalPages}</p>
              <div className="flex gap-2">
                <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="guide-action inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft className="size-4" />ก่อนหน้า</button>
                <button type="button" disabled={page >= library.totalPages} onClick={() => setPage((current) => current + 1)} className="guide-action inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">ถัดไป<ChevronRight className="size-4" /></button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function LibraryLoading() {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[0, 1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-xl border bg-white" />)}
    </div>
  );
}
