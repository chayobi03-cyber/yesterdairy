"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFamily, joinFamily, signOut } from "@/app/actions";

export function OnboardingClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // createFamily/joinFamily deliberately don't call redirect() themselves:
  // this wrapper is a plain client function, not the action reference Next
  // instruments for automatic redirect handling, so we navigate here once
  // the server action has actually finished.
  async function run(action: (formData: FormData) => Promise<void>, formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await action(formData);
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제가 생겼어요. 다시 시도해주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <div className="text-4xl">👨‍👩‍👧</div>
        <h1 className="mt-2 text-xl font-semibold text-neutral-800">가족에 참여해볼까요?</h1>
      </div>

      {mode === "choose" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setMode("create")}
            className="rounded-2xl bg-accent-400 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-accent-200/60 transition active:scale-[0.98]"
          >
            새 가족 만들기
          </button>
          <button
            onClick={() => setMode("join")}
            className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-neutral-700"
          >
            초대 코드로 참여하기
          </button>
        </div>
      )}

      {mode === "create" && (
        <form action={(fd) => run(createFamily, fd)} className="flex flex-col gap-3">
          <input
            name="family_name"
            required
            placeholder="가족 이름 (예: 우리 가족)"
            className="rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:border-accent-300"
          />
          <RoleSelect />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-accent-400 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-accent-200/60 transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "만드는 중..." : "가족 만들기"}
          </button>
          <button type="button" onClick={() => setMode("choose")} className="text-xs text-neutral-400 underline">
            뒤로
          </button>
        </form>
      )}

      {mode === "join" && (
        <form action={(fd) => run(joinFamily, fd)} className="flex flex-col gap-3">
          <input
            name="invite_code"
            required
            placeholder="초대 코드 (6자리)"
            className="rounded-2xl border border-line px-4 py-3 text-center text-lg tracking-widest uppercase outline-none focus:border-accent-300"
            maxLength={6}
          />
          <RoleSelect />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-accent-400 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-accent-200/60 transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "참여하는 중..." : "참여하기"}
          </button>
          <button type="button" onClick={() => setMode("choose")} className="text-xs text-neutral-400 underline">
            뒤로
          </button>
        </form>
      )}

      <form action={signOut} className="text-center">
        <button type="submit" className="text-xs text-neutral-400 underline">
          로그아웃
        </button>
      </form>
    </main>
  );
}

function RoleSelect() {
  return (
    <div className="flex gap-2 rounded-2xl border border-line p-1 text-sm">
      <label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl py-2 has-[:checked]:bg-accent-50 has-[:checked]:font-medium">
        <input type="radio" name="role" value="parent" defaultChecked className="sr-only" />
        부모
      </label>
      <label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl py-2 has-[:checked]:bg-accent-50 has-[:checked]:font-medium">
        <input type="radio" name="role" value="child" className="sr-only" />
        아이
      </label>
    </div>
  );
}
