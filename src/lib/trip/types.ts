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
export type PlanItem = { id: string; p?: string; rest?: string; dur?: number; included?: boolean };

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
};
