'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, SmilePlus, ThumbsUp } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, fmtTime, toast } from '@/lib/util';
import { cn } from '@/lib/utils';

type Reaction = { emoji: string; count: number; mine: boolean };
type Comment = {
  id: number;
  task_id: number;
  author_id: number;
  parent_comment_id: number | null;
  content: string;
  author_name: string;
  created_at: number;
  reactions: Reaction[];
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉'];

const initials = (n?: string | null) =>
  (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function buildTree(comments: Comment[]) {
  const byParent = new Map<number | null, Comment[]>();
  for (const c of comments) {
    const key = c.parent_comment_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  return byParent;
}

function CommentItem({
  comment,
  depth,
  pickerFor,
  onReply,
  onToggleReaction,
  onOpenPicker,
  onPickEmoji,
}: {
  comment: Comment;
  depth: number;
  pickerFor: number | null;
  onReply: (c: Comment) => void;
  onToggleReaction: (commentId: number, emoji: string) => void;
  onOpenPicker: (commentId: number | null) => void;
  onPickEmoji: (commentId: number, emoji: string) => void;
}) {
  return (
    <div className={cn('rounded-xl bg-muted/40 p-3', depth > 0 && 'ml-4 mt-2')}>
      <div className="flex gap-2.5">
        <Avatar className="size-8 shrink-0 bg-primary/10">
          <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
            {initials(comment.author_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{comment.author_name.split(' (')[0]}</span>
            <span className="text-xs text-muted-foreground">{fmtTime(comment.created_at)}</span>
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {comment.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction(comment.id, r.emoji)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition',
                  r.mine ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted'
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-semibold tabular-nums">{r.count}</span>
              </button>
            ))}
            <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => onToggleReaction(comment.id, '👍')}>
              <ThumbsUp className="size-3.5" />
            </Button>
            <div className="relative">
              <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => onOpenPicker(pickerFor === comment.id ? null : comment.id)}>
                <SmilePlus className="size-3.5" />
              </Button>
              {pickerFor === comment.id && (
                <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border bg-popover p-1 shadow-md">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button key={emoji} type="button" className="rounded-md px-2 py-1 text-lg hover:bg-muted" onClick={() => onPickEmoji(comment.id, emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="button" variant="ghost" size="xs" className="ml-auto text-muted-foreground" onClick={() => onReply(comment)}>
              Reply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentThread({
  comment,
  byParent,
  depth,
  pickerFor,
  onReply,
  onToggleReaction,
  onOpenPicker,
  onPickEmoji,
}: {
  comment: Comment;
  byParent: Map<number | null, Comment[]>;
  depth: number;
  pickerFor: number | null;
  onReply: (c: Comment) => void;
  onToggleReaction: (commentId: number, emoji: string) => void;
  onOpenPicker: (commentId: number | null) => void;
  onPickEmoji: (commentId: number, emoji: string) => void;
}) {
  const replies = byParent.get(comment.id) || [];
  return (
    <div>
      <CommentItem
        comment={comment}
        depth={depth}
        pickerFor={pickerFor}
        onReply={onReply}
        onToggleReaction={onToggleReaction}
        onOpenPicker={onOpenPicker}
        onPickEmoji={onPickEmoji}
      />
      {replies.map((reply) => (
        <CommentThread
          key={reply.id}
          comment={reply}
          byParent={byParent}
          depth={depth + 1}
          pickerFor={pickerFor}
          onReply={onReply}
          onToggleReaction={onToggleReaction}
          onOpenPicker={onOpenPicker}
          onPickEmoji={onPickEmoji}
        />
      ))}
    </div>
  );
}

export default function CommentsPanel({
  taskId,
  onChanged,
  className,
}: {
  taskId: number;
  onChanged?: () => void;
  className?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api(`/api/tasks/${taskId}/comments`);
      setComments(d.comments);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
    setText('');
    setReplyTo(null);
    setPickerFor(null);
  }, [load]);

  const byParent = useMemo(() => buildTree(comments), [comments]);
  const roots = byParent.get(null) || [];

  const toggleReaction = async (commentId: number, emoji: string) => {
    try {
      await api(`/api/tasks/${taskId}/comments/${commentId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      await load();
    } catch (e) {
      toast.errorFrom(e);
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: text.trim(),
          parentCommentId: replyTo?.id ?? null,
        }),
      });
      setText('');
      setReplyTo(null);
      await load();
      onChanged?.();
      toast.success(replyTo ? 'Reply posted' : 'Comment posted');
    } catch (e) {
      toast.errorFrom(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : roots.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No comments yet.</div>
        ) : (
          <div className="space-y-2 pb-1">
            {roots.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                byParent={byParent}
                depth={0}
                pickerFor={pickerFor}
                onReply={setReplyTo}
                onToggleReaction={toggleReaction}
                onOpenPicker={setPickerFor}
                onPickEmoji={(commentId, emoji) => {
                  toggleReaction(commentId, emoji);
                  setPickerFor(null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-background p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
            <span>
              Replying to <strong>{replyTo.author_name.split(' (')[0]}</strong>
            </span>
            <Button type="button" variant="ghost" size="xs" onClick={() => setReplyTo(null)}>
              Cancel
            </Button>
          </div>
        )}
        <div className="rounded-lg border bg-muted/20 p-2.5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            className="min-h-[56px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Enter to send</span>
            <Button type="button" size="sm" disabled={busy || !text.trim()} onClick={send}>
              <Send className="size-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
