"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTrip } from "../actions";

export function DeleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        disabled={pending}
        onClick={() => {
          if (!window.confirm("이 여행과 모든 진행 기록을 삭제할까요? 되돌릴 수 없어요.")) return;
          start(async () => {
            const r = await deleteTrip(tripId);
            if (!r.ok) return setError(r.error);
            router.push("/trips");
          });
        }}
        className="text-xs text-red-500 underline disabled:opacity-50"
      >
        이 여행 삭제
      </button>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
