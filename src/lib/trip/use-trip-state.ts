"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { editDay, updateProgress, addPlace, type Result } from "@/app/(app)/trips/actions";
import { uid } from "./engine";
import type { NewPlaceInput } from "./day-ops";
import type { ProgressPatch } from "./progress";
import {
  applyNewPlace, applyOp, applyProgress, snapshotSignature,
  type DayOpOrReset, type TripSnapshot,
} from "./view-model";

type Computed = { ok: true; snapshot: TripSnapshot } | { ok: false; error: string };

const POLL_MS = 12_000;
const FOLLOW_UP_SYNC_MS = 1_000;

// 여행 화면 상태. 탭하면 서버 응답을 기다리지 않고 화면에 먼저 반영(낙관적 업데이트)하고,
// 저장은 뒤에서 한다. 저장이 실패하면 오류를 알리고 서버 상태로 되돌린다.
// 가족이 다른 폰에서 바꾼 내용은 주기적으로 받아오되, 내가 저장 중이거나 입력 중이면 건너뛴다.
export function useTripState(initial: TripSnapshot) {
  const router = useRouter();
  const [snap, setSnap] = useState(initial);
  const [seen, setSeen] = useState(initial);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(snap);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 서버가 새 스냅샷을 보냈을 때: 내가 저장 중이 아니고 내용이 다를 때만 받아들인다
  if (initial !== seen) {
    setSeen(initial);
    if (pending === 0 && snapshotSignature(initial) !== snapshotSignature(snap)) setSnap(initial);
  }

  useEffect(() => {
    latest.current = snap;
  }, [snap]);

  useEffect(() => () => clearTimeout(syncTimer.current), []);

  // 주기적 동기화: 화면이 보이고, 저장 중이 아니고, 입력 중이 아닐 때만
  useEffect(() => {
    if (pending > 0) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      router.refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, pending]);

  const mutate = useCallback(
    (compute: (s: TripSnapshot) => Computed, save: () => Promise<Result>): boolean => {
      const r = compute(latest.current);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      latest.current = r.snapshot;
      setSnap(r.snapshot);
      setPending((p) => p + 1);
      save()
        .then((res) => {
          if (!res.ok) {
            setError(res.error);
            router.refresh(); // 저장 실패: 서버 상태로 되돌린다
          }
        })
        .catch(() => {
          setError("저장하지 못했어요. 네트워크를 확인해주세요.");
          router.refresh();
        })
        .finally(() => {
          setPending((p) => p - 1);
          // 저장이 끝나면 잠시 뒤 한 번 맞춰본다 (서버가 정한 값으로 수렴)
          clearTimeout(syncTimer.current);
          syncTimer.current = setTimeout(() => router.refresh(), FOLLOW_UP_SYNC_MS);
        });
      return true;
    },
    [router],
  );

  const edit = useCallback(
    (plan: string, day: number, op: DayOpOrReset) => {
      const tripId = latest.current.tripId;
      return mutate(
        (s) => applyOp(s, plan, day, op),
        () => editDay(tripId, plan, day, op),
      );
    },
    [mutate],
  );

  const patchProgress = useCallback(
    (itemId: string, patch: ProgressPatch) => {
      const tripId = latest.current.tripId;
      return mutate(
        (s) => applyProgress(s, itemId, patch),
        () => updateProgress(tripId, itemId, patch),
      );
    },
    [mutate],
  );

  const createPlace = useCallback(
    (plan: string, day: number, input: NewPlaceInput, addNow: boolean) => {
      const tripId = latest.current.tripId;
      const placeId = uid("u");
      const itemId = uid("it");
      return mutate(
        (s) => {
          const r = applyNewPlace(s, input, placeId);
          if (!r.ok || !addNow) return r;
          return applyOp(r.snapshot, plan, day, { type: "add", placeId, id: itemId });
        },
        () => addPlace(tripId, { ...input, planId: plan, day, addNow, placeId, itemId }),
      );
    },
    [mutate],
  );

  const clearError = useCallback(() => setError(null), []);

  return { snap, pending, error, clearError, edit, patchProgress, createPlace };
}
