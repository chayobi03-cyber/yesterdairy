"use client";

// 여행 화면: 지도(고정) + 순서대로 장소 목록을 한 화면에서. 지도 핀 <-> 목록이 서로 연동된다.
// 탭하면 서버 응답을 기다리지 않고 바로 반영되고(useTripState), 저장은 뒤에서 한다.
import dynamic from "next/dynamic";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { LEGEND, fmt, formatDistance, haversineKm, hasCoord, kakaoMapUrl, routeUrl, uid } from "@/lib/trip/engine";
import type { DayOp } from "@/lib/trip/day-ops";
import { useDragReorder } from "@/lib/trip/use-drag-reorder";
import { useTripState } from "@/lib/trip/use-trip-state";
import {
  buildRows, candidatePins, currentStopId, dayLabel, daySummary, dayStats, excludedMandatory, nextStopId, routeStops, totalCost, unmappedStops,
  type TripSnapshot,
} from "@/lib/trip/view-model";
import { DeleteTripButton } from "./delete-trip-button";
import { EditPanel } from "./edit-panel";
import { StopCard } from "./stop-card";

const TripMap = dynamic(() => import("./trip-map"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-neutral-400">지도 불러오는 중…</div>,
});

const NO_CANDIDATES: never[] = [];
const FALLBACK_CENTER: [number, number] = [37.5665, 126.978];

type Props = { initial: TripSnapshot; isCreator: boolean; userId: string; userName: string; initialPlan: string; initialDay: number };

const chip = (active: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-sm ${active ? "border-accent-400 bg-accent-50 font-medium text-accent-700" : "border-line text-neutral-500"}`;
const mini = (active = false) =>
  `min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium ${active ? "border-accent-400 bg-accent-400 text-white" : "border-line bg-card text-neutral-600"}`;

export function TripView({ initial, isCreator, userId, userName, initialPlan, initialDay }: Props) {
  const { snap, pending, uploading, error, clearError, edit, changeDayStart, changePlaceCoord, patchProgress, createPlace, addPhotos, removePhoto, postComment, removeComment } = useTripState(initial, { id: userId, name: userName });
  const def = snap.def;
  const planIds = Object.keys(def.plans);

  const [planState, setPlan] = useState(initialPlan);
  // 보고 있던 일정이 사라졌으면(다른 가족이 정리했거나 일정을 하나로 합쳤을 때) 기본 일정으로 돌아간다
  const fallbackPlan = def.defaultPlan && def.plans[def.defaultPlan] ? def.defaultPlan : planIds[0];
  const plan = def.plans[planState] ? planState : fallbackPlan;
  const [day, setDay] = useState(initialDay);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => currentStopId(initial, initialPlan, initialDay));
  const [mapOpen, setMapOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [legendFilter, setLegendFilter] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  // 지도 크게 보기(전체 화면)와 내 위치(파란 점)
  const [mapFull, setMapFull] = useState(false);
  const [myPos, setMyPos] = useState<[number, number] | null>(null);
  const [mapNote, setMapNote] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  // 위치 지정 모드: 지도를 눌러 장소의 좌표를 정한다
  const [picking, setPicking] = useState<{ placeId: string; name: string } | null>(null);
  const [pickPoint, setPickPoint] = useState<[number, number] | null>(null);
  const [pickMsg, setPickMsg] = useState<string | null>(null);
  const [scrollReq, setScrollReq] = useState<{ id: string; n: number } | null>(null);

  const rows = useMemo(() => buildRows(snap, plan, day), [snap, plan, day]);
  const stats = dayStats(rows);
  const summary = daySummary(rows);
  const visibleRows = editMode ? rows : rows.filter((r) => r.included);
  const mandatory = useMemo(() => new Set(def.mandatory ?? []), [def.mandatory]);
  const excluded = excludedMandatory(snap, plan);
  const currentId = currentStopId(snap, plan, day);
  const current = rows.find((r) => r.id === currentId) ?? null;
  const selected = selectedId && rows.some((r) => r.id === selectedId && r.included) ? selectedId : null;

  // 지도에 넘기는 배열은 내용이 바뀔 때만 새로 만든다 (바뀌면 지도가 핀을 다시 그려 팝업이 닫힘)
  const routePins = useMemo(() => routeStops(rows), [rows]);
  const mapStops = useMemo(() => {
    if (!legendFilter) return routePins;
    const cats = LEGEND.find((l) => l.label === legendFilter)?.cats ?? [];
    return routePins.filter((s) => cats.includes(s.cat ?? "etc"));
  }, [routePins, legendFilter]);
  const candidates = useMemo(() => (showAll ? candidatePins(snap, rows) : NO_CANDIDATES), [showAll, snap, rows]);
  const legend = useMemo(() => {
    const present = new Set([...routePins.map((s) => s.cat ?? "etc"), ...candidates.map((c) => c.cat ?? "etc")]);
    return LEGEND.filter((l) => l.cats.some((c) => present.has(c)));
  }, [routePins, candidates]);
  const center = useMemo<[number, number]>(() => {
    if (def.center) return def.center;
    const p = def.places.find(hasCoord);
    return p && hasCoord(p) ? [p.lat, p.lon] : FALLBACK_CENTER;
  }, [def.center, def.places]);
  const route = useMemo(() => routeUrl(rows.filter((r) => r.included && r.place).map((r) => r.place!), "walk"), [rows]);

  const { listRef, drag, handleProps } = useDragReorder((from, to) => edit(plan, day, { type: "moveTo", from, to }));

  // 주소창에 보고 있는 대안/날짜를 남긴다 (새로고침/공유해도 같은 화면). 화면 이동은 일으키지 않는다.
  useEffect(() => {
    window.history.replaceState(null, "", `?plan=${encodeURIComponent(plan)}&day=${day}`);
  }, [plan, day]);

  useEffect(() => {
    if (!scrollReq) return;
    document.getElementById(`stop-${scrollReq.id}`)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [scrollReq]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 6000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  const goTo = (nextPlan: string, nextDay: number) => {
    setPlan(nextPlan);
    setDay(nextDay);
    setSelectedId(currentStopId(snap, nextPlan, nextDay));
    setLegendFilter(null);
    setFitNonce((n) => n + 1);
  };
  const selectFromList = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
    setFocusNonce((n) => n + 1);
  };
  const selectFromMap = (id: string) => {
    setSelectedId(id);
    setScrollReq((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  };
  const quickDone = (id: string) => {
    const wasDone = snap.progress[id]?.status === "done";
    patchProgress(id, { status: wasDone ? null : "done" });
    if (wasDone) return;
    const next = nextStopId(rows, id);
    if (next) {
      setSelectedId(next);
      setFocusNonce((n) => n + 1);
      setScrollReq((r) => ({ id: next, n: (r?.n ?? 0) + 1 }));
    }
  };
  const stopLocate = () => {
    if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    setMyPos(null);
    setMapNote(null);
  };
  const toggleLocate = () => {
    if (watchId.current != null) return stopLocate();
    if (!navigator.geolocation) {
      setMapNote("이 기기에서는 현재 위치를 쓸 수 없어요.");
      return;
    }
    setMapNote("현재 위치를 찾는 중…");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setMyPos([pos.coords.latitude, pos.coords.longitude]);
        setMapNote(null);
      },
      () => {
        stopLocate();
        setMapNote("현재 위치를 가져오지 못했어요. 브라우저의 위치 권한을 확인해주세요.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };
  useEffect(
    () => () => {
      if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    },
    [],
  );
  // 크게 보기 동안은 뒤 화면이 스크롤되지 않게 하고, Esc로 닫는다
  useEffect(() => {
    if (!mapFull) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMapFull(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mapFull]);
  const openFull = () => {
    setMapOpen(true);
    setMapFull(true);
  };
  // 크게 보기 아래 카드: 선택한 장소(없으면 지금 장소), 이전/다음 장소로 넘기기
  const included = rows.filter((r) => r.included);
  const sheetRow = included.find((r) => r.id === (selected ?? current?.id)) ?? null;
  const sheetPos = sheetRow ? included.findIndex((r) => r.id === sheetRow.id) : -1;
  const focusStop = (id: string) => {
    setSelectedId(id);
    setFocusNonce((n) => n + 1);
  };
  const distanceTo = (place?: { lat?: number; lon?: number } | null) =>
    myPos && place && hasCoord(place as never) ? formatDistance(haversineKm({ lat: myPos[0], lon: myPos[1] }, place as { lat: number; lon: number })) : null;

  const startPick = (placeId: string) => {
    const place = def.places.find((p) => p.id === placeId);
    if (!place) return;
    setPicking({ placeId, name: place.name });
    setPickPoint(hasCoord(place) ? [place.lat, place.lon] : null);
    setPickMsg(null);
    setMapOpen(true);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const cancelPick = () => {
    setPicking(null);
    setPickPoint(null);
    setPickMsg(null);
  };
  const savePick = () => {
    if (!picking || !pickPoint) return;
    if (changePlaceCoord(picking.placeId, { lat: pickPoint[0], lon: pickPoint[1] })) {
      cancelPick();
      setFitNonce((n) => n + 1);
    }
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setPickMsg("이 기기에서는 현재 위치를 쓸 수 없어요. 지도를 직접 눌러주세요.");
      return;
    }
    setPickMsg("현재 위치를 찾는 중…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickPoint([pos.coords.latitude, pos.coords.longitude]);
        setPickMsg(null);
      },
      () => setPickMsg("현재 위치를 가져오지 못했어요. 위치 권한을 확인하거나 지도를 직접 눌러주세요."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };
  // 새 항목은 기본적으로 "지금 가야 할 곳" 바로 다음에 들어간다 (맨 끝까지 끌어올리지 않아도 되게).
  // 지금 가야 할 곳이 없으면(모두 끝났거나 일정이 비어 있으면) 맨 끝.
  const currentIndex = current ? rows.findIndex((r) => r.id === current.id) : -1;
  const defaultIndex = currentIndex >= 0 ? currentIndex + 1 : rows.length;
  const slots = useMemo(() => rows.map((r) => r.place?.name ?? r.item.rest ?? "일정"), [rows]);
  // 방금 추가·이동한 항목이 화면에서 보이도록 열고/스크롤한다
  const reveal = (id: string, open: boolean) => {
    if (open) setSelectedId(id);
    setScrollReq((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  };
  const addPlaceAt = (placeId: string, index: number) => {
    const id = uid("it");
    if (edit(plan, day, { type: "add", placeId, id, index })) reveal(id, true);
  };
  const addRestAt = (title: string, index: number) => {
    const id = uid("it");
    const ok = edit(plan, day, { type: "addRest", title, id, index });
    if (ok) reveal(id, true);
    return ok;
  };
  const moveItem = (from: number, to: number) => {
    const id = rows[from]?.id;
    if (edit(plan, day, { type: "moveTo", from, to }) && id) reveal(id, false);
  };
  const onEdit = (op: DayOp, confirmMessage?: string) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const movedId = op.type === "move" ? rows[op.index]?.id : undefined;
    if (edit(plan, day, op) && movedId) reveal(movedId, false);
  };

  const placeOptions = useMemo(() => def.places.map((p) => ({ id: p.id, name: p.name })), [def.places]);
  const dayStart = def.days.find((d) => d.n === day)?.start ?? "09:00";
  const cost = totalCost(snap);
  const hasMap = routePins.length > 0 || showAll || !!picking;
  const unmapped = useMemo(() => unmappedStops(rows), [rows]);

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex items-center gap-2">
        <Link href="/trips" aria-label="여행 목록으로" className="shrink-0 px-1 text-xl leading-none text-neutral-400">‹</Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{snap.title}</h1>
          <p className="truncate text-xs text-neutral-400" aria-live="polite">
            {[def.dest, def.party, snap.startDate ? `${snap.startDate} 출발` : ""].filter(Boolean).join(" · ")}
            {pending > 0 && <span role="status"> · {uploading > 0 ? `사진 올리는 중… (${uploading}장 남음)` : "저장 중…"}</span>}
          </p>
        </div>
        <Link href={`/trips/${snap.tripId}/summary?plan=${plan}`} className={mini()}>여행 요약</Link>
        <button type="button" aria-pressed={editMode} onClick={() => setEditMode((v) => !v)} className={mini(editMode)}>
          {editMode ? "편집 끝내기" : "일정 편집"}
        </button>
      </div>

      <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5" role="group" aria-label="날짜">
        {def.days.map((d) => (
          <button key={d.n} type="button" aria-pressed={d.n === day} onClick={() => goTo(plan, d.n)} className={chip(d.n === day)}>{dayLabel(snap, d.n)}</button>
        ))}
        {planIds.length > 1 && (
          <select
            aria-label="여행 대안"
            value={plan}
            onChange={(e) => goTo(e.target.value, day)}
            title={def.plans[plan]?.desc}
            className="ml-auto min-h-9 shrink-0 rounded-full border border-line bg-card px-3 text-sm text-neutral-600"
          >
            {planIds.map((k) => <option key={k} value={k}>{def.plans[k].label}</option>)}
          </select>
        )}
      </div>

      {excluded.length > 0 && (
        <p role="alert" className="rounded-xl bg-accent-50 px-3 py-2 text-xs text-accent-700">⚠️ 필수 방문지가 일정에서 제외돼 있어요: {excluded.join(", ")}</p>
      )}

      <section
        aria-label={mapFull ? "지도 크게 보기" : "지도와 지금 장소"}
        className={mapFull ? "fixed inset-0 z-[70] flex h-dvh flex-col gap-2 bg-paper p-3" : "sticky top-0 z-30 -mx-5 flex flex-col gap-2 bg-paper/95 px-5 pb-2 pt-1 backdrop-blur"}
      >
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5" role="toolbar" aria-label="지도 도구">
          <button type="button" className={mini(!showAll)} onClick={() => { setShowAll(false); setFitNonce((n) => n + 1); }}>오늘 동선</button>
          <button type="button" className={mini(showAll)} aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>전체 장소</button>
          {route && (
            <a href={route.url} target="_blank" rel="noopener noreferrer" className={`${mini()} flex items-center`} aria-label="Google 지도에서 경로 열기" title={route.truncated ? "Google 지도 경로 (정류장이 많아 앞쪽 11곳만 열려요)" : "Google 지도에서 경로 열기"}>
              경로 ↗
            </a>
          )}
          <button type="button" className={mini(myPos != null)} aria-pressed={myPos != null} onClick={toggleLocate}>📍 내 위치</button>
          {mapFull ? (
            <button type="button" className={mini(true)} onClick={() => setMapFull(false)} aria-label="지도 크게 보기 닫기">✕ 닫기</button>
          ) : (
            <>
              <button type="button" className={mini()} onClick={openFull} aria-label="지도 크게 보기">⛶ 크게 보기</button>
              <button type="button" className={mini()} aria-expanded={mapOpen} aria-label={mapOpen ? "지도 접기" : "지도 펼치기"} onClick={() => setMapOpen((v) => !v)}>{mapOpen ? "접기" : "펼치기"}</button>
            </>
          )}
        </div>
        {mapNote && <p role="status" className="text-xs text-neutral-500">{mapNote}</p>}

        {picking && (
          <div role="region" aria-label="위치 지정" className="flex flex-col gap-1.5 rounded-2xl border border-accent-300 bg-accent-50 px-3 py-2">
            <p className="text-sm font-medium">📍 「{picking.name}」 위치를 지도에서 눌러 정하세요</p>
            <p className="text-xs text-neutral-500" aria-live="polite">
              {pickMsg ?? (pickPoint ? "핀을 옮기려면 지도를 다시 누르세요. 마음에 들면 「여기로 저장」을 눌러주세요." : "지도를 확대한 뒤 정확한 위치를 눌러주세요. 현장이라면 「내 위치」도 쓸 수 있어요.")}
            </p>
            <div className="flex gap-1.5">
              <button type="button" onClick={useMyLocation} className="min-h-9 rounded-xl border border-line bg-card px-3 text-xs">내 위치</button>
              <button type="button" onClick={cancelPick} className="min-h-9 rounded-xl border border-line bg-card px-3 text-xs text-neutral-500">취소</button>
              <button type="button" disabled={!pickPoint} onClick={savePick} className="min-h-9 flex-1 rounded-xl bg-accent-400 px-3 text-xs font-medium text-white disabled:opacity-40">여기로 저장</button>
            </div>
          </div>
        )}

        <div className={mapOpen ? (mapFull ? "flex min-h-0 flex-1 flex-col gap-1.5" : "") : "hidden"}>
          <div className={`${mapFull ? "min-h-0 flex-1" : picking ? "h-64" : "h-40"} overflow-hidden rounded-2xl border border-line bg-neutral-100`}>
            {hasMap ? (
              <TripMap
                stops={mapStops}
                candidates={candidates}
                selectedId={selected}
                focusNonce={focusNonce}
                fitNonce={fitNonce}
                center={center}
                visible={mapOpen}
                onSelect={selectFromMap}
                onAdd={(placeId) => addPlaceAt(placeId, defaultIndex)}
                myPos={myPos}
                fullscreen={mapFull}
                picking={!!picking}
                pickPoint={pickPoint}
                onPickPoint={(lat, lon) => {
                  setPickPoint([lat, lon]);
                  setPickMsg(null);
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-400">
                지도에 표시할 장소가 아직 없어요. 좌표가 있는 장소를 추가하면 여기에 순서대로 나타나요.
              </div>
            )}
          </div>
          {legend.length > 0 && (
            <div className="-mx-5 mt-1.5 flex items-center gap-1.5 overflow-x-auto px-5" role="group" aria-label="지도 범례(누르면 해당 분류만 표시)">
              {legend.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  aria-pressed={legendFilter === l.label}
                  onClick={() => setLegendFilter((cur) => (cur === l.label ? null : l.label))}
                  className={`flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[11px] ${legendFilter === l.label ? "border-accent-400 bg-accent-50" : "border-line"}`}
                >
                  <i className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {mapFull ? (
          sheetRow && (
            <div className="flex flex-col gap-2 rounded-2xl border border-accent-200 bg-accent-50 px-3 py-2" data-testid="map-sheet">
              <div className="flex items-center gap-2">
                <button type="button" aria-label="이전 장소" disabled={sheetPos <= 0} onClick={() => focusStop(included[sheetPos - 1].id)} className="min-h-10 w-10 shrink-0 rounded-xl border border-line bg-card disabled:opacity-40">‹</button>
                <div className="min-w-0 flex-1 text-center">
                  <span className="block truncate text-sm font-semibold">{sheetRow.number}. {sheetRow.place?.name ?? sheetRow.item.rest}</span>
                  <span className="block truncate text-xs text-neutral-500">
                    {sheetRow.start != null && sheetRow.end != null ? `${fmt(sheetRow.start)}–${fmt(sheetRow.end)} · ` : ""}{sheetRow.dur}분
                    {distanceTo(sheetRow.place) && ` · 내 위치에서 약 ${distanceTo(sheetRow.place)} (직선)`}
                  </span>
                </div>
                <button type="button" aria-label="다음 장소" disabled={sheetPos >= included.length - 1} onClick={() => focusStop(included[sheetPos + 1].id)} className="min-h-10 w-10 shrink-0 rounded-xl border border-line bg-card disabled:opacity-40">›</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {sheetRow.place && (hasCoord(sheetRow.place) || sheetRow.place.addr) && (
                  <a href={kakaoMapUrl(sheetRow.place)} target="_blank" rel="noopener noreferrer" className="flex min-h-9 items-center rounded-xl border border-accent-300 px-3 text-xs font-medium text-accent-700">카카오맵 길찾기 ↗</a>
                )}
                {sheetRow.place && !hasCoord(sheetRow.place) && (
                  <button type="button" onClick={() => startPick(sheetRow.place!.id)} className="min-h-9 rounded-xl border border-line bg-card px-3 text-xs">📍 지도에서 위치 지정</button>
                )}
                <button type="button" onClick={() => quickDone(sheetRow.id)} aria-label="이 장소 완료" className="ml-auto min-h-9 rounded-xl bg-accent-400 px-3 text-xs font-medium text-white">
                  {sheetRow.status === "done" ? "완료 취소" : "완료 ✓"}
                </button>
              </div>
            </div>
          )
        ) : current ? (
          <div className="flex items-center gap-2 rounded-2xl border border-accent-200 bg-accent-50 px-3 py-1.5" data-testid="now-bar">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => selectFromMap(current.id)} aria-label={`지금 장소로 이동: ${current.place?.name ?? current.item.rest}`}>
              <span className="block text-[11px] text-accent-700">지금 가야 할 곳{distanceTo(current.place) && ` · 내 위치에서 약 ${distanceTo(current.place)}`}</span>
              <span className="block truncate text-sm font-semibold">{current.number}. {current.place?.name ?? current.item.rest}</span>
            </button>
            {current.place && (hasCoord(current.place) || current.place.addr) && (
              <a href={kakaoMapUrl(current.place)} target="_blank" rel="noopener noreferrer" className="flex min-h-9 shrink-0 items-center rounded-xl border border-accent-300 px-3 text-xs font-medium text-accent-700">길찾기 ↗</a>
            )}
            <button type="button" onClick={() => quickDone(current.id)} aria-label="지금 장소 완료" className="min-h-9 shrink-0 rounded-xl bg-accent-400 px-3 text-xs font-medium text-white">완료 ✓</button>
          </div>
        ) : (
          stats.total > 0 && <p className="rounded-2xl border border-line bg-card px-3 py-2 text-sm">🎉 오늘 일정 끝! 모든 장소를 완료하거나 건너뛰었어요.</p>
        )}
      </section>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{dayLabel(snap, day)} 진행</span>
            <span>{stats.done}완료 · {stats.skipped}건너뜀 / {stats.total}곳</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-label="오늘 진행률" aria-valuenow={stats.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent-400 transition-all" style={{ width: `${stats.percent}%` }} />
          </div>
        </div>
      </div>
      {summary.endMin != null && (
        <p className="-mt-1 text-xs text-neutral-400" data-testid="day-summary">
          {fmt(summary.startMin!)} 시작 → 예상 {fmt(summary.endMin)} 종료
          {summary.walkKm > 0 && ` · 도보 ${summary.walkKm.toFixed(1)}km(${summary.walkMin}분)`}
          {summary.carKm > 0 && ` · 차량 ${summary.carKm.toFixed(1)}km(${summary.carMin}분)`}
          {summary.waitMin > 0 && ` · 대기 ${summary.waitMin}분`}
          {summary.lateCount > 0 && ` · 늦는 일정 ${summary.lateCount}곳`}
        </p>
      )}
      {cost > 0 && <p className="-mt-1 text-xs text-neutral-400">누적 지출 기록 {cost.toLocaleString("ko-KR")}원</p>}

      {unmapped.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500" role="group" aria-label="지도에 없는 장소">
          <span>지도에 없는 장소</span>
          {unmapped.map((u) => (
            <button key={u.placeId} type="button" onClick={() => startPick(u.placeId)} aria-label={`${u.name} 위치 지정`} className="min-h-8 max-w-full truncate rounded-full border border-line bg-card px-2.5">
              📍 {u.name}
            </button>
          ))}
        </div>
      )}

      {editMode && (
        <label className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-card px-3 py-2 text-sm">
          <span>{dayLabel(snap, day)} 출발(시작) 시각 <span className="block text-xs text-neutral-400">모든 대안에 같은 시각이 적용돼요</span></span>
          <input
            type="time"
            aria-label={`${dayLabel(snap, day)} 출발 시각`}
            value={dayStart}
            onChange={(e) => e.target.value && changeDayStart(day, e.target.value)}
            className="min-h-10 rounded-lg border border-line bg-card px-2 text-sm"
          />
        </label>
      )}

      {visibleRows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-neutral-500">이 날짜에는 일정이 없어요. 「일정 편집」에서 장소를 추가해보세요.</p>
      ) : (
        <ol ref={listRef} aria-label="일정 목록" className="relative flex flex-col gap-2">
          <span aria-hidden className="absolute bottom-8 left-4 top-8 w-px bg-line" />
          {visibleRows.map((r, vi) => {
            const full = rows.indexOf(r);
            const dropBefore = !!drag && drag.over === vi && drag.over < drag.from;
            const dropAfter = !!drag && drag.over === vi && drag.over > drag.from;
            return (
              <Fragment key={r.id}>
                {dropBefore && <li aria-hidden className="ml-11 h-1 rounded bg-accent-400" />}
                {r.included && (r.travel || r.wait > 0) && (
                  <li aria-hidden className="pl-11 text-xs text-neutral-400">
                    {r.travel && <>{r.travel.mode === "car" ? "🚗 차량" : "🚶 도보"} 약 {r.travel.min}분 · {r.travel.km.toFixed(1)}km (추정)</>}
                    {r.travel && r.wait > 0 && " · "}
                    {r.wait > 0 && <>⏳ {r.item.at}까지 {r.wait}분 대기</>}
                  </li>
                )}
                <StopCard
                  row={r}
                  index={full}
                  count={rows.length}
                  selected={selected === r.id}
                  editMode={editMode}
                  mandatory={!!r.item.p && mandatory.has(r.item.p)}
                  progress={snap.progress[r.id]}
                  dragging={drag?.from === vi}
                  dragHandle={handleProps(vi)}
                  onSelect={selectFromList}
                  onQuickDone={quickDone}
                  onPatch={patchProgress}
                  onEdit={onEdit}
                  onPickLocation={startPick}
                  onMoveTo={moveItem}
                  placeOptions={placeOptions}
                  comments={snap.comments.filter((c) => c.itemId === r.id)}
                  viewerId={userId}
                  isCreator={isCreator}
                  onPostComment={postComment}
                  onRemoveComment={removeComment}
                  photos={snap.photos.filter((ph) => ph.itemId === r.id)}
                  canDeletePhoto={(ph) => isCreator || ph.createdBy === userId}
                  onAddPhotos={(itemId, files) => void addPhotos(itemId, files)}
                  onRemovePhoto={removePhoto}
                />
                {dropAfter && <li aria-hidden className="ml-11 h-1 rounded bg-accent-400" />}
              </Fragment>
            );
          })}
        </ol>
      )}

      {editMode && (
        <EditPanel
          places={def.places.map((p) => ({ id: p.id, name: p.name }))}
          slots={slots}
          defaultIndex={defaultIndex}
          onAddPlace={addPlaceAt}
          onAddRest={addRestAt}
          onCreatePlace={(input, addNow, index) => {
            const itemId = uid("it");
            const ok = createPlace(plan, day, input, addNow, { index, itemId });
            if (ok && addNow) reveal(itemId, true);
            return ok;
          }}
          onReset={() => {
            if (window.confirm("이 날짜의 수정 내용을 지우고 기본 일정으로 되돌릴까요? (진행 기록은 유지돼요)")) edit(plan, day, { type: "reset" });
          }}
        />
      )}

      <p className="text-xs text-neutral-400">
        운영시간·예약·공연·주차요금·좌표는 실시간 확인 결과가 아닌 참고 정보예요. 방문 전 공식 채널에서 확인하세요. 이동·체류시간은 계획용 추정치예요. 사진은 가족 구성원에게만 보여요.
        지도 © OpenStreetMap contributors.
      </p>
      {isCreator && <DeleteTripButton tripId={snap.tripId} />}

      {error && (
        <div role="alert" className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-[calc(100%-2.5rem)] max-w-md items-center justify-between gap-3 rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-white shadow-lg">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="오류 닫기" className="shrink-0 text-lg leading-none">✕</button>
        </div>
      )}
    </div>
  );
}
