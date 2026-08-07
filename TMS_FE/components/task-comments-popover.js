"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  SendHorizontal,
  Smile,
  SmilePlus,
  ThumbsUp,
  X,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import {
  COMMENT_EMOJIS,
  QUICK_REACTION_EMOJIS,
} from "@/lib/comment-emojis";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getAuthorName(comment) {
  return comment.author?.full_name || comment.author?.email || "Unknown user";
}

function formatCommentTime(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value)) {
    return "";
  }

  return new Date(value)
    .toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
}

function sortCommentTree(comments = []) {
  return [...comments]
    .sort((left, right) => Number(left.created_at) - Number(right.created_at))
    .map((comment) => ({
      ...comment,
      replies: sortCommentTree(comment.replies ?? []),
    }));
}

function countComments(comments = []) {
  let total = 0;

  function walk(nodes) {
    for (const comment of nodes) {
      total += 1;
      if (comment.replies?.length) {
        walk(comment.replies);
      }
    }
  }

  walk(comments);
  return total;
}

function addReplyToTree(comments, parentCommentId, reply) {
  return sortCommentTree(
    comments.map((comment) => {
      if (comment.comment_id === parentCommentId) {
        return {
          ...comment,
          replies: sortCommentTree([...(comment.replies ?? []), reply]),
        };
      }

      if (comment.replies?.length) {
        return {
          ...comment,
          replies: addReplyToTree(comment.replies, parentCommentId, reply),
        };
      }

      return comment;
    }),
  );
}

function updateReactionsInTree(comments, commentId, reactions) {
  return comments.map((comment) => {
    if (comment.comment_id === commentId) {
      return { ...comment, reactions };
    }

    if (comment.replies?.length) {
      return {
        ...comment,
        replies: updateReactionsInTree(comment.replies, commentId, reactions),
      };
    }

    return comment;
  });
}

function insertAtCursor(textarea, value, insertValue, onChange) {
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? value.length;
  const nextValue = value.slice(0, start) + insertValue + value.slice(end);
  onChange(nextValue);

  requestAnimationFrame(() => {
    textarea?.focus();
    const cursor = start + insertValue.length;
    textarea?.setSelectionRange(cursor, cursor);
  });
}

function EmojiGrid({ emojis, onSelect, className }) {
  return (
    <div className={cn("grid grid-cols-8 gap-0.5 p-2", className)}>
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="flex size-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-muted"
          aria-label={`Insert ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

function EmojiPickerPanel({ emojis, onSelect, className }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-popover shadow-md",
        className,
      )}
    >
      <EmojiGrid emojis={emojis} onSelect={onSelect} />
    </div>
  );
}

function CommentReactions({
  comment,
  currentUserId,
  onToggleReaction,
  togglingEmoji,
  onReply,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function handleReaction(emoji) {
    onToggleReaction(comment.comment_id, emoji);
    setPickerOpen(false);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {(comment.reactions ?? []).map((reaction) => {
        const reacted = reaction.user_ids?.includes(currentUserId);

        return (
          <button
            key={`${comment.comment_id}-${reaction.emoji}`}
            type="button"
            onClick={() => handleReaction(reaction.emoji)}
            disabled={togglingEmoji === reaction.emoji}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
              reacted
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            <span>{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => handleReaction("👍")}
        disabled={togglingEmoji === "👍"}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Like comment"
      >
        <ThumbsUp className="size-3.5" />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((current) => !current)}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Add reaction"
        >
          <SmilePlus className="size-3.5" />
        </button>

        {pickerOpen ? (
          <>
            <button
              type="button"
              aria-label="Close reaction picker"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setPickerOpen(false)}
            />
            <EmojiPickerPanel
              emojis={QUICK_REACTION_EMOJIS}
              onSelect={handleReaction}
              className="absolute bottom-full left-0 z-50 mb-1 w-44"
            />
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onReply(comment)}
        className="ml-auto text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Reply
      </button>
    </div>
  );
}

function CommentCard({
  comment,
  currentUserId,
  onToggleReaction,
  togglingReaction,
  onReply,
  depth = 0,
}) {
  const authorName = getAuthorName(comment);
  const togglingEmoji =
    togglingReaction?.commentId === comment.comment_id
      ? togglingReaction.emoji
      : null;

  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-border/70 pl-3")}>
      <article className="rounded-lg bg-muted/50 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Avatar size="sm" className="size-7">
            <AvatarFallback className="text-[10px] font-medium">
              {getInitials(authorName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-xs font-medium text-foreground">
                {authorName}
              </span>
              {formatCommentTime(comment.created_at) ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatCommentTime(comment.created_at)}
                </span>
              ) : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
              {comment.content}
            </p>

            <CommentReactions
              comment={comment}
              currentUserId={currentUserId}
              onToggleReaction={onToggleReaction}
              togglingEmoji={togglingEmoji}
              onReply={onReply}
            />
          </div>
        </div>
      </article>

      {comment.replies?.length ? (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.comment_id}
              comment={reply}
              currentUserId={currentUserId}
              onToggleReaction={onToggleReaction}
              togglingReaction={togglingReaction}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TaskCommentsPopover({
  projectId,
  taskId,
  token,
  commentCount = 0,
  onCommentCountChange,
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [error, setError] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [togglingReaction, setTogglingReaction] = useState(null);
  const textareaRef = useRef(null);
  const listRef = useRef(null);
  const currentUserId = user?.user_id;
  const displayCount = Number(commentCount) || 0;

  useEffect(() => {
    if (!open || !token) {
      return;
    }

    let cancelled = false;

    async function loadComments() {
      setLoading(true);
      setError("");

      try {
        const data = await apiGet(
          `/projects/${projectId}/tasks/${taskId}/comments`,
          { token },
        );

        if (cancelled) {
          return;
        }

        const sorted = sortCommentTree(data.comments || []);
        setComments(sorted);
        const total = countComments(sorted);
        if (total !== (Number(commentCount) || 0)) {
          onCommentCountChange?.(total);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "Failed to load comments.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, taskId, token]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, comments, loading]);

  function handleOpenChange(nextOpen) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setReplyTo(null);
      setDraft("");
      setEmojiPickerOpen(false);
      setError("");
    }
  }

  function handleReply(comment) {
    setReplyTo({
      commentId: comment.comment_id,
      authorName: getAuthorName(comment),
    });
    setEmojiPickerOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function clearReply() {
    setReplyTo(null);
    textareaRef.current?.focus();
  }

  function updateCommentReactions(commentId, reactions) {
    setComments((current) => updateReactionsInTree(current, commentId, reactions));
  }

  async function toggleReaction(commentId, emoji) {
    if (!token || togglingReaction) {
      return;
    }

    setTogglingReaction({ commentId, emoji });
    setError("");

    try {
      const data = await apiPost(
        `/projects/${projectId}/tasks/${taskId}/comments/${commentId}/reactions/toggle`,
        { emoji },
        { token },
      );
      updateCommentReactions(commentId, data.reactions || []);
    } catch (toggleError) {
      setError(toggleError.message || "Failed to update reaction.");
    } finally {
      setTogglingReaction(null);
    }
  }

  async function submitComment() {
    const content = draft.trim();
    if (!content || !token || sending) {
      return;
    }

    setSending(true);
    setError("");

    try {
      const payload = { content };
      if (replyTo?.commentId) {
        payload.parent_comment_id = replyTo.commentId;
      }

      const data = await apiPost(
        `/projects/${projectId}/tasks/${taskId}/comments`,
        payload,
        { token },
      );

      setComments((current) => {
        const nextComments = replyTo?.commentId
          ? addReplyToTree(current, replyTo.commentId, data.comment)
          : sortCommentTree([...current, data.comment]);
        onCommentCountChange?.((Number(commentCount) || 0) + 1);
        return nextComments;
      });

      setDraft("");
      setReplyTo(null);
      setEmojiPickerOpen(false);
      textareaRef.current?.focus();
    } catch (submitError) {
      setError(submitError.message || "Failed to post comment.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitComment();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      submitComment();
    }
  }

  function handleInsertEmoji(emoji) {
    insertAtCursor(textareaRef.current, draft, emoji, setDraft);
    setEmojiPickerOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex min-h-7 w-full items-center justify-center gap-1 rounded-md px-1 text-xs transition-colors outline-none hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring",
              displayCount > 0 ? "text-foreground" : "text-muted-foreground",
            )}
            aria-label="View comments"
          />
        }
      >
        <MessageSquare
          className={cn(
            "size-3.5",
            displayCount > 0 ? "text-muted-foreground" : "text-muted-foreground/50",
          )}
        />
        {displayCount > 0 ? <span>{displayCount}</span> : null}
      </PopoverTrigger>

      <PopoverContent
        align="center"
        side="bottom"
        className="flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        initialFocus={false}
      >
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-medium text-foreground">Comments</p>
        </div>

        <div
          ref={listRef}
          className="max-h-72 min-h-24 overflow-y-auto px-3 py-3"
        >
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Loading comments...
            </p>
          ) : null}

          {!loading && comments.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No comments yet. Start the conversation below.
            </p>
          ) : null}

          {!loading && comments.length > 0 ? (
            <div className="space-y-2">
              {comments.map((comment) => (
                <CommentCard
                  key={comment.comment_id}
                  comment={comment}
                  currentUserId={currentUserId}
                  onToggleReaction={toggleReaction}
                  togglingReaction={togglingReaction}
                  onReply={handleReply}
                />
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-border bg-muted/20 p-3"
        >
          <div className="rounded-xl border border-border bg-background">
            {replyTo ? (
              <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                <p className="truncate text-[11px] text-muted-foreground">
                  Replying to{" "}
                  <span className="font-medium text-foreground">
                    {replyTo.authorName}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={clearReply}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Cancel reply"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                replyTo ? "Write a reply..." : "Write a comment..."
              }
              rows={3}
              className="w-full resize-none rounded-t-xl bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />

            <div className="flex items-center justify-between border-t border-border/60 px-2 py-1.5">
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEmojiPickerOpen((current) => !current)}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Insert emoji"
                  >
                    <Smile className="size-3.5" />
                  </button>

                  {emojiPickerOpen ? (
                    <>
                      <button
                        type="button"
                        aria-label="Close emoji picker"
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setEmojiPickerOpen(false)}
                      />
                      <EmojiPickerPanel
                        emojis={COMMENT_EMOJIS}
                        onSelect={handleInsertEmoji}
                        className="absolute bottom-full left-0 z-50 mb-1 w-56"
                      />
                    </>
                  ) : null}
                </div>

                <span className="text-[10px] text-muted-foreground">
                  Enter to send
                </span>
              </div>

              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                disabled={!draft.trim() || sending}
              >
                <SendHorizontal className="size-3.5" />
                {replyTo ? "Reply" : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
