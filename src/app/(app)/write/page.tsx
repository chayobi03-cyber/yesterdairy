import { createEntry } from "@/app/actions";
import { EntryForm } from "./entry-form";

function todayISO() {
  return new Date().toLocaleDateString("sv-SE");
}

export default function WritePage() {
  async function action(formData: FormData) {
    "use server";
    formData.set("entry_date", todayISO());
    await createEntry(formData);
  }

  return <EntryForm action={action} />;
}
