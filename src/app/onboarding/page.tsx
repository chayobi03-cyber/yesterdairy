import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) redirect("/");

  // Safety net: if signUp() ran without an active session (e.g. email
  // confirmation is required), createProfile() never ran. family_members
  // has an FK to profiles, so create/join would otherwise fail here.
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    await supabase.from("profiles").insert({ id: user.id, name: user.email?.split("@")[0] ?? "가족" });
  }

  return <OnboardingClient />;
}
