"use client";

import { useState } from "react";
import type { NewPlaceInput } from "@/lib/trip/day-ops";

type Props = {
  places: { id: string; name: string }[];
  // 오늘 일정(제외 항목 포함)의 이름 목록과, 새 항목을 넣을 기본 위치(0=맨 앞, rows.length=맨 끝)
  slots: string[];
  defaultIndex: number;
  onAddPlace: (placeId: string, index: number) => void;
  onAddRest: (title: string, index: number) => boolean;
  onCreatePlace: (input: NewPlaceInput, addNow: boolean, index: number) => boolean;
  onReset: () => void;
};

const field = "min-h-10 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent-300";

// 편집 모드에서만 보이는 추가/되돌리기 도구
export function EditPanel({ places, slots, defaultIndex, onAddPlace, onAddRest, onCreatePlace, onReset }: Props) {
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "");
  const [rest, setRest] = useState("");
  const [creating, setCreating] = useState(false);
  // 넣을 위치: 사용자가 고르기 전까지는 기본 위치("지금 가야 할 곳" 다음)를 따라간다
  const [picked, setPicked] = useState<number | null>(null);
  const index = Math.min(picked ?? defaultIndex, slots.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
        <h3 className="text-sm font-medium">일정에 추가</h3>
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          넣을 위치
          <select value={index} onChange={(e) => setPicked(Number(e.target.value))} aria-label="넣을 위치" className={field}>
            <option value={0}>맨 처음</option>
            {slots.map((name, i) => <option key={i} value={i + 1}>{i + 1}. {name} 다음</option>)}
          </select>
        </label>
        {places.length > 0 && (
          <div className="flex gap-2">
            <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} aria-label="추가할 장소" className={field}>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" aria-label="선택한 장소를 일정에 추가" onClick={() => onAddPlace(placeId, index)} className="min-h-10 shrink-0 rounded-xl bg-accent-400 px-4 text-sm font-medium text-white">추가</button>
          </div>
        )}
        <div className="flex gap-2">
          <input value={rest} onChange={(e) => setRest(e.target.value)} placeholder="장소 없는 일정 (예: 휴식, 이동)" aria-label="일정 이름" maxLength={60} className={field} />
          <button
            type="button"
            aria-label="장소 없는 일정 추가"
            onClick={() => onAddRest(rest, index) && setRest("")}
            className="min-h-10 shrink-0 rounded-xl border border-line px-4 text-sm"
          >
            추가
          </button>
        </div>
      </div>

      {creating ? (
        <form
          className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3"
          aria-label="내 장소 만들기"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const g = (k: string) => String(fd.get(k) ?? "");
            const ok = onCreatePlace(
              { name: g("name"), cat: g("cat"), addr: g("addr"), lat: g("lat"), lon: g("lon"), dur: g("dur"), hours: g("hours"), desc: g("desc"), note: g("note") },
              fd.get("addNow") === "on",
              index,
            );
            if (ok) setCreating(false);
          }}
        >
          <input name="name" required placeholder="장소 이름" maxLength={80} aria-label="장소 이름" className={field} />
          <select name="cat" defaultValue="sight" aria-label="분류" className={field}>
            <option value="sight">관광</option><option value="food">먹거리</option><option value="activity">체험</option>
            <option value="show">공연</option><option value="parking">주차</option><option value="stay">숙소</option><option value="etc">기타</option>
          </select>
          <input name="addr" placeholder="주소 / 검색어 (길찾기에 사용)" maxLength={200} aria-label="주소" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <input name="lat" inputMode="decimal" placeholder="위도 (선택)" aria-label="위도" className={field} />
            <input name="lon" inputMode="decimal" placeholder="경도 (선택)" aria-label="경도" className={field} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="dur" type="number" min={5} max={600} defaultValue={45} aria-label="예상 체류(분)" className={field} />
            <input name="hours" placeholder="운영시간 (참고)" maxLength={100} aria-label="운영시간" className={field} />
          </div>
          <input name="desc" placeholder="추가한 이유" maxLength={300} aria-label="추가한 이유" className={field} />
          <textarea name="note" placeholder="메모" maxLength={500} aria-label="장소 메모" className={field} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="addNow" defaultChecked /> 저장 후 오늘 일정에 추가</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCreating(false)} className="min-h-10 rounded-xl border border-line px-3 text-sm text-neutral-500">취소</button>
            <button className="min-h-10 flex-1 rounded-xl bg-accent-400 px-3 text-sm font-medium text-white">저장</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="min-h-11 rounded-2xl border border-dashed border-neutral-300 px-4 text-sm text-neutral-500">
          + 내 장소 만들기
        </button>
      )}

      <button type="button" onClick={onReset} className="self-start text-xs text-neutral-400 underline">
        이 날짜를 기본 일정으로 되돌리기
      </button>
    </div>
  );
}
