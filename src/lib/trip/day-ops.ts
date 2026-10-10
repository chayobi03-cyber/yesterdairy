// 일차별 일정 편집의 순수 로직 (DB 비의존). 서버 액션은 "최신 데이터를 읽고 이 함수를
// 적용해 저장"을 충돌 시 다시 시도하므로, 이 함수는 항상 입력 배열을 바꾸지 않고
// 새 배열을 돌려준다.
import { move, uid, validAt, validCoord } from "./engine";
import type { Place, PlanItem } from "./types";

export type DayOp =
  | { type: "toggle"; itemId: string }
  | { type: "move"; index: number; dir: 1 | -1 }
  // 드래그로 한 번에 옮기기. 한 칸씩 옮기는 move를 반복하므로 필수 방문지끼리 추월하지 못한다.
  | { type: "moveTo"; from: number; to: number }
  | { type: "dur"; itemId: string; delta: number }
  // 고정 시작 시각 지정/해제 (null이면 해제)
  | { type: "setAt"; itemId: string; at: string | null }
  // 체류시간을 분 단위로 직접 지정 (5~600)
  | { type: "setDur"; itemId: string; dur: number }
  // 일정 블록의 장소를 다른 장소로 바꾸기 (필수 방문지 블록은 불가)
  | { type: "setPlace"; itemId: string; placeId: string }
  // 장소 없는 일정(이동·휴식 등)의 이름 바꾸기
  | { type: "rename"; itemId: string; title: string }
  // id: 화면이 먼저 반영(낙관적 업데이트)할 때 서버와 같은 항목 id를 쓰도록 호출자가 정한다
  // index: 넣을 위치(0=맨 앞). 없으면 맨 끝. 범위를 벗어나면 맨 끝으로 맞춘다 (동시 편집으로 길이가 달라져도 실패하지 않게)
  | { type: "add"; placeId: string; id?: string; index?: number }
  | { type: "addRest"; title: string; id?: string; index?: number }
  | { type: "remove"; itemId: string };

export type OpResult = { ok: true; items: PlanItem[] } | { ok: false; error: string };

export const MAX_ITEMS_PER_DAY = 60;
export const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

// 호출자가 정한 id는 형식과 중복을 검사하고, 없으면 새로 만든다
function newItemId(requested: string | undefined, existing: PlanItem[]): { ok: true; id: string } | { ok: false; error: string } {
  if (requested == null) return { ok: true, id: uid("it") };
  if (!ID_RE.test(requested) || existing.some((i) => i.id === requested)) return { ok: false, error: "잘못된 항목 id예요." };
  return { ok: true, id: requested };
}

function insertAt(items: PlanItem[], item: PlanItem, index: number | undefined): void {
  const at = index == null || !Number.isInteger(index) ? items.length : Math.min(Math.max(index, 0), items.length);
  items.splice(at, 0, item);
}

export function applyDayOp(
  current: PlanItem[],
  op: DayOp,
  ctx: { places: Place[]; mandatory: string[] },
): OpResult {
  const items: PlanItem[] = structuredClone(current);

  switch (op.type) {
    case "toggle": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      it.included = it.included === false;
      return { ok: true, items };
    }
    case "move": {
      const r = move(items, op.index, op.dir, ctx.mandatory);
      return r.ok ? { ok: true, items: r.items } : { ok: false, error: r.reason };
    }
    case "moveTo": {
      if (![op.from, op.to].every((n) => Number.isInteger(n) && n >= 0 && n < items.length)) return { ok: false, error: "더 이상 이동할 수 없어요." };
      let cur = items;
      let at = op.from;
      const dir: 1 | -1 = op.to > op.from ? 1 : -1;
      while (at !== op.to) {
        const r = move(cur, at, dir, ctx.mandatory);
        if (!r.ok) return { ok: false, error: r.reason };
        cur = r.items;
        at += dir;
      }
      return { ok: true, items: cur };
    }
    case "dur": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      const base = it.dur ?? (it.p ? ctx.places.find((p) => p.id === it.p)?.dur : undefined) ?? 30;
      it.dur = Math.min(600, Math.max(5, base + Math.trunc(op.delta)));
      return { ok: true, items };
    }
    case "setAt": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      if (op.at == null || op.at === "") {
        delete it.at;
      } else if (validAt(op.at)) {
        it.at = op.at;
      } else {
        return { ok: false, error: "시각은 HH:MM 형식으로 입력해주세요." };
      }
      return { ok: true, items };
    }
    case "setDur": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      if (!Number.isFinite(op.dur) || op.dur < 5 || op.dur > 600) return { ok: false, error: "체류시간은 5~600분으로 입력해주세요." };
      it.dur = Math.round(op.dur);
      return { ok: true, items };
    }
    case "setPlace": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      if (!it.p) return { ok: false, error: "장소가 없는 일정은 장소를 바꿀 수 없어요." };
      if (ctx.mandatory.includes(it.p)) return { ok: false, error: "필수 방문지는 다른 장소로 바꿀 수 없어요." };
      if (!ctx.places.some((p) => p.id === op.placeId)) return { ok: false, error: "알 수 없는 장소예요." };
      it.p = op.placeId;
      delete it.dur; // 이전 장소에 맞춘 체류시간은 버리고 새 장소의 기본값을 쓴다
      return { ok: true, items };
    }
    case "rename": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      if (it.rest == null) return { ok: false, error: "장소가 있는 일정은 이름을 바꿀 수 없어요. 장소를 바꿔주세요." };
      const title = op.title.trim().slice(0, 60);
      if (!title) return { ok: false, error: "일정 이름을 입력해주세요." };
      it.rest = title;
      return { ok: true, items };
    }
    case "add": {
      if (!ctx.places.some((p) => p.id === op.placeId)) return { ok: false, error: "알 수 없는 장소예요." };
      if (items.length >= MAX_ITEMS_PER_DAY) return { ok: false, error: "하루에 넣을 수 있는 항목이 가득 찼어요." };
      const nid = newItemId(op.id, items);
      if (!nid.ok) return nid;
      insertAt(items, { id: nid.id, p: op.placeId }, op.index);
      return { ok: true, items };
    }
    case "addRest": {
      const title = op.title.trim().slice(0, 60);
      if (!title) return { ok: false, error: "일정 이름을 입력해주세요." };
      if (items.length >= MAX_ITEMS_PER_DAY) return { ok: false, error: "하루에 넣을 수 있는 항목이 가득 찼어요." };
      const nid = newItemId(op.id, items);
      if (!nid.ok) return nid;
      insertAt(items, { id: nid.id, rest: title, dur: 30 }, op.index);
      return { ok: true, items };
    }
    case "remove": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      if (it.p && ctx.mandatory.includes(it.p)) return { ok: false, error: "필수 방문지는 삭제할 수 없어요. 제외로 바꿔주세요." };
      return { ok: true, items: items.filter((i) => i.id !== op.itemId) };
    }
  }
}

export type NewPlaceInput = {
  name: string; cat: string; addr: string; lat: string; lon: string; dur: string; hours: string; desc: string; note: string;
};

const CATEGORIES = ["sight", "food", "activity", "show", "parking", "stay", "etc"];
export const MAX_PLACES = 300;

// 내 장소 입력 검증 + Place 생성. id는 호출자가 정할 수 있게 받는다 (테스트 용이).
export function buildPlace(input: NewPlaceInput, id: string = uid("u")): { ok: true; place: Place } | { ok: false; error: string } {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "이름은 필수예요." };
  const hasLat = input.lat.trim() !== "";
  const hasLon = input.lon.trim() !== "";
  if (hasLat !== hasLon) return { ok: false, error: "위도와 경도를 함께 입력하거나 둘 다 비워주세요." };
  const lat = hasLat ? Number(input.lat) : undefined;
  const lon = hasLon ? Number(input.lon) : undefined;
  if (hasLat && !validCoord(lat, lon)) return { ok: false, error: "좌표가 올바르지 않아요 (위도 -90~90, 경도 -180~180)." };
  const dur = Number(input.dur);
  if (!(dur >= 5 && dur <= 600)) return { ok: false, error: "체류시간은 5~600분으로 입력해주세요." };

  const place: Place = {
    id,
    name,
    cat: CATEGORIES.includes(input.cat) ? input.cat : "etc",
    dur,
    addr: input.addr.trim().slice(0, 200) || undefined,
    hours: input.hours.trim().slice(0, 100) || undefined,
    desc: input.desc.trim().slice(0, 300) || undefined,
    note: input.note.trim().slice(0, 500) || undefined,
    ...(lat != null && lon != null ? { lat, lon } : {}),
  };
  return { ok: true, place };
}

export type Coord = { lat: number; lon: number };

// 장소 하나의 지도 위치를 바꾼다 (coord=null이면 위치 지우기). 직접 정한 위치이므로 "근사" 표시는 뗀다.
// 소수 5자리(약 1m)로 반올림해 저장한다.
export function setPlaceCoord(places: Place[], placeId: string, coord: Coord | null): { ok: true; places: Place[] } | { ok: false; error: string } {
  const idx = places.findIndex((pl) => pl.id === placeId);
  if (idx < 0) return { ok: false, error: "없는 장소예요." };
  const next = structuredClone(places);
  const target = next[idx];
  delete target.approx;
  if (coord === null) {
    delete target.lat;
    delete target.lon;
    return { ok: true, places: next };
  }
  if (!validCoord(coord.lat, coord.lon)) return { ok: false, error: "좌표가 올바르지 않아요 (위도 -90~90, 경도 -180~180)." };
  target.lat = Math.round(coord.lat * 1e5) / 1e5;
  target.lon = Math.round(coord.lon * 1e5) / 1e5;
  return { ok: true, places: next };
}
