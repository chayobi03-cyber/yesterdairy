// 일차별 일정 편집의 순수 로직 (DB 비의존). 서버 액션은 "최신 데이터를 읽고 이 함수를
// 적용해 저장"을 충돌 시 다시 시도하므로, 이 함수는 항상 입력 배열을 바꾸지 않고
// 새 배열을 돌려준다.
import { move, uid, validCoord } from "./engine";
import type { Place, PlanItem } from "./types";

export type DayOp =
  | { type: "toggle"; itemId: string }
  | { type: "move"; index: number; dir: 1 | -1 }
  | { type: "dur"; itemId: string; delta: number }
  | { type: "add"; placeId: string }
  | { type: "addRest"; title: string }
  | { type: "remove"; itemId: string };

export type OpResult = { ok: true; items: PlanItem[] } | { ok: false; error: string };

export const MAX_ITEMS_PER_DAY = 60;

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
    case "dur": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      const base = it.dur ?? (it.p ? ctx.places.find((p) => p.id === it.p)?.dur : undefined) ?? 30;
      it.dur = Math.min(600, Math.max(5, base + Math.trunc(op.delta)));
      return { ok: true, items };
    }
    case "add": {
      if (!ctx.places.some((p) => p.id === op.placeId)) return { ok: false, error: "알 수 없는 장소예요." };
      if (items.length >= MAX_ITEMS_PER_DAY) return { ok: false, error: "하루에 넣을 수 있는 항목이 가득 찼어요." };
      items.push({ id: uid("it"), p: op.placeId });
      return { ok: true, items };
    }
    case "addRest": {
      const title = op.title.trim().slice(0, 60);
      if (!title) return { ok: false, error: "일정 이름을 입력해주세요." };
      if (items.length >= MAX_ITEMS_PER_DAY) return { ok: false, error: "하루에 넣을 수 있는 항목이 가득 찼어요." };
      items.push({ id: uid("it"), rest: title, dur: 30 });
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
