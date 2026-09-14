"use client";

import { useRef } from "react";
import { addComment } from "@/app/actions";

export function CommentForm({ entryId }: { entryId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addComment(entryId, formData);
        formRef.current?.reset();
      }}
      className="flex items-center gap-1.5"
    >
      <input
        name="content"
        required
        placeholder="댓글 달기..."
        className="flex-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-accent-300"
      />
      <button type="submit" className="shrink-0 rounded-full bg-accent-400 px-3 py-1.5 text-xs font-medium text-white">
        등록
      </button>
    </form>
  );
}
