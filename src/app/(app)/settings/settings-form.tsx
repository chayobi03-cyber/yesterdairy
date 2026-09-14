"use client";

import { useState } from "react";
import { updateName } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

export function SettingsForm({ currentName }: { currentName: string }) {
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [namePending, setNamePending] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  async function handleNameSubmit(formData: FormData) {
    setNamePending(true);
    setNameError(null);
    setNameSaved(false);
    try {
      await updateName(formData);
      setNameSaved(true);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "이름 변경에 실패했어요.");
    } finally {
      setNamePending(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordPending(true);
    setPasswordError(null);
    setPasswordSaved(false);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setPasswordPending(false);
    if (error) {
      setPasswordError("비밀번호 변경에 실패했어요. 6자 이상으로 입력해주세요.");
      return;
    }
    setPassword("");
    setPasswordSaved(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">닉네임 변경</h2>
        <p className="text-xs text-neutral-400">가족 피드 등에 보이는 이름이에요. 로그인 아이디와는 별개라 자유롭게 바꿔도 돼요.</p>
        <form action={handleNameSubmit} className="flex gap-2">
          <input
            name="name"
            defaultValue={currentName}
            required
            className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
          />
          <button
            type="submit"
            disabled={namePending}
            className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            저장
          </button>
        </form>
        {nameError && <p className="text-sm text-rose-500">{nameError}</p>}
        {nameSaved && <p className="text-sm text-emerald-600">닉네임이 바뀌었어요.</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">비밀번호 변경</h2>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            placeholder="새 비밀번호 (6자 이상)"
            className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
          />
          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {passwordPending ? "변경 중..." : "비밀번호 저장"}
          </button>
        </form>
        {passwordError && <p className="text-sm text-rose-500">{passwordError}</p>}
        {passwordSaved && <p className="text-sm text-emerald-600">비밀번호가 바뀌었어요.</p>}
      </section>
    </div>
  );
}
