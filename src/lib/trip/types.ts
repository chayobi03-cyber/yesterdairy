export type Place = {
  id: string;
  name: string;
  cat?: string;
  lat?: number;
  lon?: number;
  approx?: boolean;
  dur?: number;
  desc?: string;
  hours?: string;
  addr?: string;
  note?: string;
  tips?: string[];
  checks?: string[];
  food?: string[];
  opt?: boolean;
};

// 일정 항목: p = 장소 id, rest = 장소 없는 일정 이름
// at = 고정 시작 시각 "HH:MM" (이보다 일찍 도착하면 기다리고, 늦으면 "N분 늦음"으로 표시)
export type PlanItem = { id: string; p?: string; rest?: string; dur?: number; included?: boolean; at?: string };

export type TripDay = { n: number; label?: string; start: string };

export type Plan = { label: string; desc?: string; days: Record<string, PlanItem[]> };

export type TripDef = {
  id?: string;
  title?: string;
  dest?: string;
  party?: string;
  center?: [number, number];
  days: TripDay[];
  mandatory?: string[];
  defaultPlan?: string;
  places: Place[];
  plans: Record<string, Plan>;
};

export type ProgressStatus = "arrived" | "done" | "skipped";

export type ProgressRow = {
  item_id: string;
  status: ProgressStatus | null;
  checks: Record<string, boolean>;
  memo: string;
  cost: number | null;
  // 다녀온 뒤의 소감(글, 최대 1000자)과 별점(1~5)
  review: string;
  rating: number | null;
  updated_at: string;
  // 마지막으로 이 기록을 고친 사람의 이름 (서버가 채움)
  authorName?: string | null;
};

// 여행 사진. url/thumbUrl은 서버가 발급한 서명 URL이라 시간이 지나면 만료된다.
export type TripPhoto = {
  id: string;
  itemId: string | null;
  createdBy: string;
  authorName: string;
  createdAt: string;
  url: string;
  thumbUrl: string;
};

// 장소별 댓글 (작성자 이름 포함)
export type TripComment = {
  id: string;
  itemId: string;
  body: string;
  createdBy: string;
  authorName: string;
  createdAt: string;
};

// 여행 전체 소감을 담는 예약 항목 id (장소별 진행 기록과 같은 테이블을 쓴다)
export const TRIP_NOTE_ID = "trip-summary";
