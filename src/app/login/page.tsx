"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError("이메일 또는 비밀번호를 확인해주세요.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <div className="text-4xl">⭐</div>
        <h1 className="mt-2 text-xl font-semibold text-neutral-800">하루별</h1>
        <p className="mt-1 text-sm text-neutral-500">우리 가족의 성장 다이어리</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
        />
        <input
          type="password"
          required
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-amber-300"
        />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="text-center text-xs text-neutral-400">
        가족 전용 앱이라 별도 가입은 없어요. 계정이 없다면 부모님께 문의하세요.
      </p>
    </main>
  );
}
