"use client";

import { CATS, catColor, directionsUrl, fmt, hasCoord } from "@/lib/trip/engine";
import type { DayOp } from "@/lib/trip/day-ops";
import type { ProgressPatch } from "@/lib/trip/progress";
import { useSyncedField } from "@/lib/trip/use-synced-field";
import type { StopRow } from "@/lib/trip/view-model";
import type { ProgressRow, ProgressStatus, TripComment, TripPhoto } from "@/lib/trip/types";
import { CommentThread } from "./comment-thread";
import { PhotoStrip } from "./photo-strip";

const STATUS_LABEL: Record<ProgressStatus, string> = { arrived: "📍 도착", done: "✅ 완료", skipped: "⏭ 건너뜀" };
const BADGE: Record<ProgressStatus, string> = { arrived: "도착", done: "완료", skipped: "건너뜀" };

export type StopCardProps = {
  row: StopRow;
  index: number; // 하루 전체 목록(제외 항목 포함)에서의 위치
  count: number;
  selected: boolean;
  editMode: boolean;
  mandatory: boolean;
  progress: ProgressRow | undefined;
  dragging: boolean;
  dragHandle: { onPointerDown: (e: React.PointerEvent<HTMLElement>) => void; style: React.CSSProperties };
  onSelect: (id: string) => void;
  onQuickDone: (id: string) => void;
  onPatch: (id: string, patch: ProgressPatch) => void;
  onEdit: (op: DayOp, confirmMessage?: string) => void;
  onPickLocation: (placeId: string) => void;
  placeOptions: { id: string; name: string }[];
  comments: TripComment[];
  viewerId: string;
  isCreator: boolean;
  onPostComment: (itemId: string, body: string) => boolean;
  onRemoveComment: (commentId: string) => void;
  photos: TripPhoto[];
  canDeletePhoto: (p: TripPhoto) => boolean;
  onAddPhotos: (itemId: string, files: File[]) => void;
  onRemovePhoto: (photoId: string) => void;
};

export function StopCard(p: StopCardProps) {
  const { row, selected, editMode, mandatory } = p;
  const place = row.place;
  const title = place?.name ?? row.item.rest ?? "일정";
  const status = row.status;
  const done = status === "done";
  const badgeText = !row.included ? "–" : done ? "✓" : status === "skipped" ? "–" : String(row.number);

  return (
    <li
      id={`stop-${row.id}`}
      data-stop-li
      data-testid={`stop-${row.id}`}
      className={`relative scroll-mt-80 pl-11 ${p.dragging ? "opacity-40" : ""} ${row.included ? "" : "opacity-55"}`}
    >
      <span
        aria-hidden
        className="absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow"
        style={{ background: catColor(place?.cat), opacity: done || status === "skipped" ? 0.6 : 1 }}
      >
        {badgeText}
      </span>

      <div className={`rounded-2xl border bg-card ${selected ? "border-accent-400 shadow-sm shadow-accent-200/60" : "border-line"}`}>
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => p.onSelect(row.id)}
            aria-expanded={selected}
            aria-label={`${row.number ?? "-"}. ${title}${selected ? " 상세 닫기" : " 상세 열기"}`}
            className="flex min-h-14 flex-1 flex-col items-start justify-center gap-0.5 rounded-2xl px-3 py-2 text-left"
          >
            <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              {title}
              {mandatory && <span className="rounded-full border border-accent-400 px-1.5 text-[10px] font-medium text-accent-700">필수</span>}
              {status && <span className="rounded-full border border-line px-1.5 text-[10px] font-medium text-neutral-500">{BADGE[status]}</span>}
              {place?.approx && <span className="rounded-full border border-line px-1.5 text-[10px] font-normal text-neutral-400">좌표 근사</span>}
            </span>
            <span className="text-xs text-neutral-400">
              {row.included && row.start != null && row.end != null ? `${row.item.at ? "⏰ " : ""}${fmt(row.start)}–${fmt(row.end)} · ` : "제외됨 · "}
              {place?.cat ? `${CATS[place.cat] ?? ""} · ` : ""}
              {row.dur}분
              {p.photos.length > 0 && ` · 📷 ${p.photos.length}`}
              {p.comments.length > 0 && ` · 💬 ${p.comments.length}`}
              {p.progress?.rating ? ` · ${"★".repeat(p.progress.rating)}` : ""}
              {row.included && row.late > 0 && <span className="ml-1 text-red-500">· 예정 {row.item.at}보다 {row.late}분 늦음</span>}
            </span>
          </button>

          {!editMode && row.included && (
            <button
              type="button"
              onClick={() => p.onQuickDone(row.id)}
              aria-pressed={done}
              aria-label={done ? `${title} 완료 취소` : `${title} 완료 처리`}
              className={`m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-lg ${done ? "border-accent-400 bg-accent-400 text-white" : "border-line text-neutral-300"}`}
            >
              ✓
            </button>
          )}
          {editMode && (
            <button
              type="button"
              aria-label={`${title} 순서 끌어서 바꾸기`}
              className="m-2 flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-full border border-line text-lg text-neutral-400 active:cursor-grabbing"
              onPointerDown={p.dragHandle.onPointerDown}
              style={p.dragHandle.style}
            >
              ⠿
            </button>
          )}
        </div>

        {editMode && (
          <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
            <Tool label={row.included ? "제외" : "포함"} onClick={() => p.onEdit({ type: "toggle", itemId: row.id }, mandatory && row.included ? `${title}은(는) 필수 방문지예요. 정말 일정에서 제외할까요?` : undefined)} />
            <Tool label="↑" aria="위로" disabled={p.index === 0} onClick={() => p.onEdit({ type: "move", index: p.index, dir: -1 })} />
            <Tool label="↓" aria="아래로" disabled={p.index === p.count - 1} onClick={() => p.onEdit({ type: "move", index: p.index, dir: 1 })} />
            <Tool label="−10분" aria="체류시간 10분 감소" onClick={() => p.onEdit({ type: "dur", itemId: row.id, delta: -10 })} />
            <Tool label="+10분" aria="체류시간 10분 증가" onClick={() => p.onEdit({ type: "dur", itemId: row.id, delta: 10 })} />
            <label className="flex min-h-9 items-center gap-1 rounded-lg border border-line px-2 text-xs">
              시작 시각
              <input
                type="time"
                aria-label={`${title} 고정 시작 시각`}
                value={row.item.at ?? ""}
                onChange={(e) => p.onEdit({ type: "setAt", itemId: row.id, at: e.target.value || null })}
                className="bg-transparent text-xs"
              />
            </label>
            {row.item.at && <Tool label="시각 해제" aria={`${title} 고정 시각 해제`} onClick={() => p.onEdit({ type: "setAt", itemId: row.id, at: null })} />}
            {place && <Tool label={hasCoord(place) ? "📍 위치 수정" : "📍 위치 지정"} aria={`${title} 지도 위치 ${hasCoord(place) ? "수정" : "지정"}`} onClick={() => p.onPickLocation(place.id)} />}
            {!mandatory && <Tool label="삭제" danger onClick={() => p.onEdit({ type: "remove", itemId: row.id }, "이 일정을 삭제할까요?")} />}
          </div>
        )}

        {editMode && <EditFields {...p} title={title} />}

        {selected && row.included && <StopDetail {...p} />}
      </div>
    </li>
  );
}

// 편집 모드에서 한 블록(일정 항목)을 바로 고치는 입력칸: 체류시간(분), 이름(장소 없는 일정), 장소 바꾸기
function EditFields({ row, title, mandatory, placeOptions, onEdit }: StopCardProps & { title: string }) {
  const dur = useSyncedField(String(row.dur));
  const name = useSyncedField(row.item.rest ?? "");
  const isRest = row.item.rest != null;
  const input = "min-h-9 rounded-lg border border-line bg-card px-2 text-xs text-ink";

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2 text-xs text-neutral-500">
      <label className="flex items-center gap-1">
        체류
        <input
          type="number"
          inputMode="numeric"
          min={5}
          max={600}
          step={5}
          aria-label={`${title} 체류시간(분)`}
          value={dur.value}
          onChange={(e) => dur.setValue(e.target.value)}
          onBlur={() => dur.dirty && onEdit({ type: "setDur", itemId: row.id, dur: Number(dur.commit()) })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={`${input} w-16`}
        />
        분
      </label>
      {isRest ? (
        <label className="flex min-w-0 flex-1 items-center gap-1">
          이름
          <input
            type="text"
            maxLength={60}
            aria-label={`${title} 이름`}
            value={name.value}
            onChange={(e) => name.setValue(e.target.value)}
            onBlur={() => name.dirty && onEdit({ type: "rename", itemId: row.id, title: name.commit() })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className={`${input} min-w-0 flex-1`}
          />
        </label>
      ) : (
        <label className="flex min-w-0 flex-1 items-center gap-1">
          장소
          <select
            aria-label={`${title} 장소 바꾸기`}
            value={row.item.p ?? ""}
            disabled={mandatory}
            title={mandatory ? "필수 방문지는 다른 장소로 바꿀 수 없어요" : undefined}
            onChange={(e) => e.target.value !== row.item.p && onEdit({ type: "setPlace", itemId: row.id, placeId: e.target.value })}
            className={`${input} min-w-0 flex-1 disabled:opacity-50`}
          >
            {placeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function Tool({ label, aria, onClick, disabled, danger }: { label: string; aria?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={aria}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded-lg border border-line px-2.5 text-xs disabled:opacity-40 ${danger ? "text-red-500" : ""}`}
    >
      {label}
    </button>
  );
}

function StopDetail({ row, onPickLocation, progress, onPatch, photos, canDeletePhoto, onAddPhotos, onRemovePhoto, comments, viewerId, isCreator, onPostComment, onRemoveComment }: StopCardProps) {
  const place = row.place;
  const cost = useSyncedField(progress?.cost == null ? "" : String(progress.cost));
  const review = useSyncedField(progress?.review ?? "");
  const status = row.status;
  const checks = progress?.checks ?? {};
  const title = place?.name ?? row.item.rest ?? "일정";
  const canRoute = !!place && (hasCoord(place) || !!place.addr);

  return (
    <section aria-label={`${title} 상세`} className="flex flex-col gap-3 border-t border-line px-3 py-3">
      {row.travel && (
        <p className="text-xs text-neutral-400">
          이전 장소에서 {row.travel.mode === "car" ? "🚗 차량" : "🚶 도보"} 약 {row.travel.min}분 · {row.travel.km.toFixed(1)}km (추정)
        </p>
      )}
      {place?.desc && <p className="text-sm">{place.desc}</p>}
      {place?.note && <p className="text-xs text-neutral-500">메모: {place.note}</p>}
      {place?.hours && (
        <p className="rounded-xl bg-accent-50 px-3 py-2 text-xs text-accent-700">🕒 {place.hours} — 참고 정보이며 실시간 확인 결과가 아니에요.</p>
      )}
      {place && canRoute && (
        <div className="flex gap-4 text-sm">
          <a href={directionsUrl(place, "walk")} target="_blank" rel="noopener noreferrer" className="text-accent-600 underline">🚶 도보 길찾기 ↗</a>
          <a href={directionsUrl(place, "car")} target="_blank" rel="noopener noreferrer" className="text-accent-600 underline">🚗 차량 길찾기 ↗</a>
        </div>
      )}
      {place?.approx && <p className="text-xs text-neutral-400">※ 지도 좌표는 근사치예요. 길찾기 전에 위치를 확인하세요.</p>}
      {place && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          {!hasCoord(place) && <span>지도에 표시되지 않는 장소예요.</span>}
          <button type="button" onClick={() => onPickLocation(place.id)} className="min-h-9 rounded-lg border border-line px-2.5">
            {hasCoord(place) ? "📍 지도 위치 수정" : "📍 지도에서 위치 지정"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="진행 상태">
        {(Object.keys(STATUS_LABEL) as ProgressStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => onPatch(row.id, { status: s })}
            className={`min-h-10 rounded-xl border px-3 text-sm ${status === s ? "border-accent-400 bg-accent-400 text-white" : "border-line"}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
        {status && (
          <button type="button" onClick={() => onPatch(row.id, { status: null })} className="min-h-10 rounded-xl px-3 text-sm text-neutral-400">
            되돌리기
          </button>
        )}
      </div>

      {place?.checks && place.checks.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-500">방문 전 확인</h3>
          {place.checks.map((c, i) => (
            <label key={i} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent-500)]"
                checked={!!checks[String(i)]}
                onChange={(e) => onPatch(row.id, { checkIndex: i, checked: e.target.checked })}
              />
              {c}
            </label>
          ))}
          <p className="text-xs text-neutral-400">체크는 직접 확인했다는 표시예요. 앱이 검증한 결과가 아니에요.</p>
        </div>
      )}
      {place?.tips && place.tips.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-neutral-500">{place.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
      )}
      {place?.food && place.food.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {place.food.map((f, i) => <span key={i} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-neutral-500">{f}</span>)}
        </div>
      )}

      <CommentThread
        title={title}
        comments={comments}
        viewerId={viewerId}
        isCreator={isCreator}
        onPost={(body) => onPostComment(row.id, body)}
        onRemove={onRemoveComment}
        legacyMemo={progress?.memo || undefined}
        onClearLegacy={() => onPatch(row.id, { memo: "" })}
      />
      {(status === "arrived" || status === "done") && (
        <section aria-label={`${title} 소감`} className="flex flex-col gap-2 rounded-xl bg-accent-50/60 p-3">
          <h3 className="text-sm font-medium text-neutral-600">다녀온 소감</h3>
          <div className="flex items-center gap-1" role="group" aria-label="별점">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`별점 ${n}점`}
                aria-pressed={progress?.rating === n}
                onClick={() => onPatch(row.id, { rating: progress?.rating === n ? null : n })}
                className={`h-10 w-10 rounded-full text-xl ${(progress?.rating ?? 0) >= n ? "text-amber-400" : "text-neutral-300"}`}
              >
                ★
              </button>
            ))}
          </div>
          {progress?.authorName && (progress.review || progress.rating) && (
            <p className="text-[11px] text-neutral-400">마지막 기록: {progress.authorName}</p>
          )}
          <label className="text-xs text-neutral-500">
            소감 (가족 모두에게 보여요)
            <textarea
              value={review.value}
              maxLength={1000}
              onChange={(e) => review.setValue(e.target.value)}
              onBlur={() => review.dirty && onPatch(row.id, { review: review.commit() })}
              placeholder="무엇이 좋았는지, 아이 반응은 어땠는지…"
              className="mt-1 min-h-20 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent-300"
            />
          </label>
        </section>
      )}

      <PhotoStrip title={title} photos={photos} canDelete={canDeletePhoto} onAdd={(files) => onAddPhotos(row.id, files)} onRemove={onRemovePhoto} />

      <label className="text-xs text-neutral-500">
        지출 (원)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          value={cost.value}
          onChange={(e) => cost.setValue(e.target.value)}
          onBlur={() => {
            if (!cost.dirty) return;
            const v = cost.commit();
            onPatch(row.id, { cost: v === "" ? null : Number(v) });
          }}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent-300"
        />
      </label>
    </section>
  );
}
