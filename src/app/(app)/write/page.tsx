import { createEntry } from "@/app/actions";
import { EntryForm } from "./entry-form";

function todayISO() {
  return new Date().toLocaleDateString("sv-SE");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = todayISO();
  const entryDate = date && DATE_RE.test(date) ? date : today;
  const isToday = entryDate === today;

  async function action(formData: FormData) {
    "use server";
    formData.set("entry_date", entryDate);
    await createEntry(formData);
  }

  return (
    <EntryForm
      action={action}
      title={isToday ? undefined : `${entryDate} 기록`}
      subtitle={isToday ? undefined : "지난 날짜의 기록도 남겨볼까요?"}
    />
  );
}
