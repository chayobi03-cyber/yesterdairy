import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { SettingsForm } from "./settings-form";
import { ThemeSection } from "./theme-section";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user!.id).single();

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h1 className="text-lg font-semibold">설정</h1>

      <SettingsForm currentName={profile?.name ?? ""} />

      <ThemeSection />

      <form action={signOut} className="pt-2 text-center">
        <button type="submit" className="text-xs text-neutral-400 underline">
          로그아웃
        </button>
      </form>
    </div>
  );
}
