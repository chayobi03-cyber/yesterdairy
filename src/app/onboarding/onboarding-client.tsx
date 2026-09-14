"use client";

import { useState } from "react";
import { createFamily, joinFamily, signOut } from "@/app/actions";

// redirect() throws internally (digest starts with "NEXT_REDIRECT") to
// signal navigation to the framework — let it propagate instead of
// treating it as an application error, or the redirect never happens.
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function OnboardingClient() {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: (formData: FormData) => Promise<void>, formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await action(formData);
    } catch (e) {
      if (isRedirectError(e)) throw e;
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
            className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-white"
          >
            새 가족 만들기
          </button>
          <button
            onClick={() => setMode("join")}
            className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700"
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
            className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
          />
          <RoleSelect />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
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
            className="rounded-2xl border border-neutral-200 px-4 py-3 text-center text-lg tracking-widest uppercase outline-none focus:border-amber-300"
            maxLength={6}
          />
          <RoleSelect />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
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
    <div className="flex gap-2 rounded-2xl border border-neutral-200 p-1 text-sm">
      <label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl py-2 has-[:checked]:bg-amber-50 has-[:checked]:font-medium">
        <input type="radio" name="role" value="parent" defaultChecked className="sr-only" />
        부모
      </label>
      <label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl py-2 has-[:checked]:bg-amber-50 has-[:checked]:font-medium">
        <input type="radio" name="role" value="child" className="sr-only" />
        아이
      </label>
    </div>
  );
}
