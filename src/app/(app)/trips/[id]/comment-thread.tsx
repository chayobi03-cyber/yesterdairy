"use client";

import { useState } from "react";
import { MAX_COMMENT_LEN, canDeleteComment, formatCommentTime } from "@/lib/trip/comments";
import type { TripComment } from "@/lib/trip/types";

type Props = {
  title: string; // 접근성 라벨용 (장소 이름)
  comments: TripComment[];
  viewerId: string;
  isCreator: boolean;
  onPost: (body: string) => boolean;
  onRemove: (commentId: string) => void;
  // 댓글 기능 이전에 쓴 공용 메모 (작성자를 알 수 없다)
  legacyMemo?: string;
  onClearLegacy?: () => void;
};

export function CommentThread({ title, comments, viewerId, isCreator, onPost, onRemove, legacyMemo, onClearLegacy }: Props) {
  const [draft, setDraft] = useState("");
  const empty = draft.trim() === "";

  const send = () => {
    if (empty) return;
    if (onPost(draft)) setDraft("");
  };

  return (
    <section aria-label={`${title} 댓글`} className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-neutral-500">댓글 {comments.length > 0 && `(${comments.length})`} <span className="text-xs font-normal text-neutral-400">가족 모두에게 보여요</span></h3>

      {legacyMemo && (
        <div className="rounded-xl border border-dashed border-line bg-card px-3 py-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>이전 메모 (쓴 사람을 알 수 없어요)</span>
            {onClearLegacy && (
              <button type="button" className="min-h-8 px-1 text-neutral-500 underline" aria-label={`${title} 이전 메모 지우기`} onClick={() => window.confirm("이전 메모를 지울까요?") && onClearLegacy()}>
                지우기
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm">{legacyMemo}</p>
        </div>
      )}

      {comments.length > 0 && (
        <ol className="flex flex-col gap-1.5" aria-label={`${title} 댓글 목록`}>
          {comments.map((c) => (
            <li key={c.id} className={`rounded-xl px-3 py-2 ${c.createdBy === viewerId ? "bg-accent-50" : "bg-card border border-line"}`}>
              <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-400">
                <span>
                  <b data-testid="comment-author" className="font-semibold text-neutral-600">{c.authorName}</b>
                  {" · "}
                  {formatCommentTime(c.createdAt)}
                </span>
                {canDeleteComment(c, viewerId, isCreator) && (
                  <button
                    type="button"
                    className="min-h-8 px-1 text-neutral-500 underline"
                    aria-label={`${c.authorName}의 댓글 삭제`}
                    onClick={() => window.confirm("이 댓글을 삭제할까요?") && onRemove(c.id)}
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          maxLength={MAX_COMMENT_LEN}
          rows={2}
          aria-label={`${title} 댓글 쓰기`}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="예약번호, 주차 위치, 알려줄 것…"
          className="min-h-12 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-accent-300"
        />
        <button
          type="button"
          disabled={empty}
          onClick={send}
          aria-label={`${title} 댓글 등록`}
          className="min-h-12 shrink-0 rounded-xl bg-accent-400 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          등록
        </button>
      </div>
    </section>
  );
}
