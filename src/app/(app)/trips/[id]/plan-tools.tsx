"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPlace, editDay } from "../actions";
import type { DayOp } from "@/lib/trip/day-ops";

type Ctx = { tripId: string; planId: string; day: number };

export function ItemTools({ ctx, itemId, index, count, included, mandatory, placeName }: {
  ctx: Ctx; itemId: string; index: number; count: number; included: boolean; mandatory: boolean; placeName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function run(op: DayOp, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError("");
    start(async () => {
      const r = await editDay(ctx.tripId, ctx.planId, ctx.day, op);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const b = "min-h-9 rounded-lg border border-line px-2.5 text-xs disabled:opacity-40";
  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className={b} disabled={pending} onClick={() => run({ type: "toggle", itemId }, mandatory && included ? `${placeName}은(는) 필수 방문지예요. 정말 일정에서 제외할까요?` : undefined)}>
          {included ? "제외" : "포함"}
        </button>
        <button className={b} disabled={pending || index === 0} aria-label="위로" onClick={() => run({ type: "move", index, dir: -1 })}>↑</button>
        <button className={b} disabled={pending || index === count - 1} aria-label="아래로" onClick={() => run({ type: "move", index, dir: 1 })}>↓</button>
        <button className={b} disabled={pending} aria-label="체류시간 10분 감소" onClick={() => run({ type: "dur", itemId, delta: -10 })}>−10분</button>
        <button className={b} disabled={pending} aria-label="체류시간 10분 증가" onClick={() => run({ type: "dur", itemId, delta: 10 })}>+10분</button>
        {!mandatory && (
          <button className={`${b} text-red-500`} disabled={pending} onClick={() => run({ type: "remove", itemId }, "이 일정을 삭제할까요?")}>삭제</button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function AddItemForm({ ctx, places }: { ctx: Ctx; places: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "");
  const [rest, setRest] = useState("");
  const [error, setError] = useState("");

  function run(op: DayOp, done?: () => void) {
    setError("");
    start(async () => {
      const r = await editDay(ctx.tripId, ctx.planId, ctx.day, op);
      if (!r.ok) return setError(r.error);
      done?.();
      router.refresh();
    });
  }

  const field = "min-h-10 flex-1 rounded-xl border border-line px-3 text-sm outline-none focus:border-accent-300";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
      <h3 className="text-sm font-medium">일정에 추가</h3>
      {places.length > 0 && (
        <div className="flex gap-2">
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} aria-label="추가할 장소" className={field}>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button disabled={pending} onClick={() => run({ type: "add", placeId })} className="rounded-xl bg-accent-400 px-4 text-sm text-white disabled:opacity-50">추가</button>
        </div>
      )}
      <div className="flex gap-2">
        <input value={rest} onChange={(e) => setRest(e.target.value)} placeholder="장소 없는 일정 (예: 휴식, 이동)" aria-label="일정 이름" maxLength={60} className={field} />
        <button disabled={pending} onClick={() => run({ type: "addRest", title: rest }, () => setRest(""))} className="rounded-xl border border-line px-4 text-sm disabled:opacity-50">추가</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function ResetDayButton({ ctx }: { ctx: Ctx }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!window.confirm("이 날짜의 수정 내용을 지우고 기본 일정으로 되돌릴까요? (진행 기록은 유지돼요)")) return;
        start(async () => {
          await editDay(ctx.tripId, ctx.planId, ctx.day, { type: "reset" });
          router.refresh();
        });
      }}
      className="text-xs text-neutral-400 underline disabled:opacity-50"
    >
      이 날짜를 기본 일정으로 되돌리기
    </button>
  );
}

export function AddPlaceForm({ ctx }: { ctx: Ctx }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-2xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm text-neutral-500">
        + 내 장소 만들기
      </button>
    );
  }

  const field = "w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-accent-300";
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3"
      action={(fd) => {
        setError("");
        const g = (k: string) => String(fd.get(k) ?? "");
        start(async () => {
          const r = await addPlace(ctx.tripId, {
            name: g("name"), cat: g("cat"), addr: g("addr"), lat: g("lat"), lon: g("lon"), dur: g("dur"),
            hours: g("hours"), desc: g("desc"), note: g("note"), planId: ctx.planId, day: ctx.day, addNow: fd.get("addNow") === "on",
          });
          if (!r.ok) return setError(r.error);
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <input name="name" required placeholder="장소 이름" maxLength={80} className={field} />
      <select name="cat" defaultValue="sight" aria-label="분류" className={field}>
        <option value="sight">관광</option><option value="food">먹거리</option><option value="activity">체험</option>
        <option value="show">공연</option><option value="parking">주차</option><option value="stay">숙소</option><option value="etc">기타</option>
      </select>
      <input name="addr" placeholder="주소 / 검색어 (길찾기에 사용)" maxLength={200} className={field} />
      <div className="grid grid-cols-2 gap-2">
        <input name="lat" inputMode="decimal" placeholder="위도 (선택)" className={field} />
        <input name="lon" inputMode="decimal" placeholder="경도 (선택)" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="dur" type="number" min={5} max={600} defaultValue={45} aria-label="예상 체류(분)" className={field} />
        <input name="hours" placeholder="운영시간 (참고)" maxLength={100} className={field} />
      </div>
      <input name="desc" placeholder="추가한 이유" maxLength={300} className={field} />
      <textarea name="note" placeholder="메모" maxLength={500} className={field} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="addNow" defaultChecked /> 저장 후 현재 일정에 추가</label>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-3 py-2 text-sm text-neutral-500">취소</button>
        <button disabled={pending} className="flex-1 rounded-xl bg-accent-400 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "저장 중…" : "저장"}</button>
      </div>
    </form>
  );
}
