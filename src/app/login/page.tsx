"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data: identity } = await supabase
      .from("login_identities")
      .select("email")
      .eq("display_name", name.trim())
      .maybeSingle();

    if (!identity) {
      setLoading(false);
      setError("그런 이름의 계정을 찾을 수 없어요.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: identity.email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError("이름 또는 비밀번호를 확인해주세요.");
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
          type="text"
          required
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        아직 계정이 없나요?{" "}
        <a href="/signup" className="underline">
          가입하기
        </a>
      </p>
    </main>
  );
}
