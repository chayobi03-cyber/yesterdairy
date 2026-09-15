import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getTodayISO } from "@/lib/today";
import { todayMission } from "@/lib/color-names";
import { ColorHuntCamera } from "./camera";

export default async function ColorCapturePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = await getTodayISO();
  const mission = todayMission(today);

  return <ColorHuntCamera missionHex={mission.hex} missionName={mission.name} colorDate={today} />;
}
