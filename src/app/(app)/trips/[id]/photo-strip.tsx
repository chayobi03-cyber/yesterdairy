"use client";

import { useRef, useState } from "react";
/* eslint-disable @next/next/no-img-element -- 서명 URL 이미지는 next/image 최적화 대상이 아니다 */
import { formatCommentTime } from "@/lib/trip/comments";
import type { TripPhoto } from "@/lib/trip/types";

type Props = {
  title: string; // 접근성 라벨용 (장소 이름 / "여행")
  photos: TripPhoto[];
  canDelete: (p: TripPhoto) => boolean;
  onAdd?: (files: File[]) => void; // 없으면 사진 추가 버튼을 숨긴다 (읽기 전용)
  onRemove: (photoId: string) => void;
};

export function PhotoStrip({ title, photos, canDelete, onAdd, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = photos.find((p) => p.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-500">사진 {photos.length > 0 && `(${photos.length})`}</h3>
        {onAdd && (
          <>
            <button
              type="button"
              aria-label={`${title} 사진 추가`}
              onClick={() => input.current?.click()}
              className="min-h-9 rounded-lg border border-line px-3 text-xs"
            >
              📷 사진 추가
            </button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-label={`${title} 사진 선택`}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = ""; // 같은 파일을 다시 고를 수 있게
                if (files.length) onAdd?.(files);
              }}
            />
          </>
        )}
      </div>
      {photos.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={`${title} 사진 목록`}>
          {photos.map((p, i) => (
            <li key={p.id} className="relative shrink-0">
              <button type="button" onClick={() => setOpenId(p.id)} aria-label={`${title} 사진 ${i + 1} 크게 보기`}>
                <img src={p.thumbUrl} alt={`${title} 사진 ${i + 1}`} loading="lazy" className="h-20 w-20 rounded-xl border border-line object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div role="dialog" aria-modal="true" aria-label={`${title} 사진 보기`} className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-end gap-2 p-3">
            <p className="mr-auto text-sm text-white/80" data-testid="photo-caption">
              {open.authorName} · {formatCommentTime(open.createdAt)}
            </p>
            {canDelete(open) && (
              <button
                type="button"
                className="min-h-10 rounded-xl border border-white/40 px-3 text-sm text-red-300"
                onClick={() => {
                  if (window.confirm("이 사진을 삭제할까요?")) {
                    onRemove(open.id);
                    setOpenId(null);
                  }
                }}
              >
                삭제
              </button>
            )}
            <button type="button" className="min-h-10 rounded-xl border border-white/40 px-3 text-sm text-white" onClick={() => setOpenId(null)} aria-label="사진 닫기">
              닫기 ✕
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3" onClick={() => setOpenId(null)}>
            <img src={open.url} alt={`${title} 사진`} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}
