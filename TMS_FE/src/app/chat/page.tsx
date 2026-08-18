'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell, { useMe } from '@/components/Shell';
import { useChatUnread } from '@/components/ChatUnreadProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, apiUpload, deleteUpload, fmtTime, toast } from '@/lib/util';
import { onChatUpdate, onPresenceUpdate, type ChatUpdatePayload } from '@/lib/socket';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import AttachmentMedia, { type AttachmentLike } from '@/components/AttachmentMedia';
import VoiceRecordingBar from '@/components/VoiceRecordingBar';
import { formatDuration } from '@/lib/formatDuration';
import { cn } from '@/lib/utils';
import Modal from '@/components/Modal';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  MessageCircle,
  Menu,
  MoreVertical,
  Paperclip,
  Pencil,
  Reply,
  Search,
  Send,
  SmilePlus,
  Square,
  ThumbsUp,
  Trash2,
  X,
  Mic,
  Users,
  Plus,
  Settings,
} from 'lucide-react';

type Reaction = { emoji: string; count: number; mine: boolean };
type ChatAttachment = AttachmentLike;

type ChatMessage = {
  id: number;
  conversation_id: number;
  author_id: number;
  author_name: string;
  parent_message_id: number | null;
  body: string | null;
  edited: boolean;
  edited_at: number | null;
  deleted_at: number | null;
  created_at: number;
  reactions: Reaction[];
  attachments?: ChatAttachment[];
};

type Conversation = {
  id: number;
  kind?: 'direct' | 'group';
  name?: string | null;
  member_user_id: number | null;
  member_name: string;
  member_email?: string;
  member_role?: string;
  member_count?: number | null;
  last_message_at: number | null;
  last_message_preview?: string | null;
};

type Target = {
  id: number;
  name: string;
  email: string;
  role: string;
  team_name?: string | null;
  conversation_id: number | null;
  last_message_at: number | null;
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉'];

const initials = (n?: string | null) =>
  (n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const displayName = (n?: string | null) => n?.split(' (')[0] || 'User';

function sortMessages(list: ChatMessage[]) {
  return [...list].sort((a, b) => a.created_at - b.created_at || a.id - b.id);
}

function mergeMessage(list: ChatMessage[], incoming: ChatMessage) {
  const idx = list.findIndex((m) => m.id === incoming.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = incoming;
    return sortMessages(next);
  }
  return sortMessages([...list, incoming]);
}

function upsertConversation(list: Conversation[], incoming: Conversation) {
  const next = list.filter((c) => c.id !== incoming.id);
  next.unshift(incoming);
  return next.sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
}

function applyChatPayload(
  payload: ChatUpdatePayload,
  activeConvId: number | null,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>,
  setActiveConversation: React.Dispatch<React.SetStateAction<Conversation | null>>
) {
  const conv = payload.conversation as Conversation | undefined;
  const msg = payload.message as ChatMessage | undefined;
  if (!conv?.id) return;

  setConversations((prev) => upsertConversation(prev, conv));
  setActiveConversation((prev) => (prev?.id === conv.id ? { ...prev, ...conv } : prev));

  if (msg && activeConvId === conv.id) {
    setMessages((prev) => mergeMessage(prev, msg));
  }
}

function MessageBubble({
  message,
  parent,
  meId,
  canModerate,
  pickerFor,
  editingId,
  editText,
  onEditText,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
  onToggleReaction,
  onOpenPicker,
  onPickEmoji,
  showAuthorNames = false,
}: {
  message: ChatMessage;
  parent: ChatMessage | null;
  meId: number;
  canModerate: boolean;
  pickerFor: number | null;
  editingId: number | null;
  editText: string;
  onEditText: (v: string) => void;
  onStartEdit: (m: ChatMessage) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onReply: (m: ChatMessage) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
  onOpenPicker: (messageId: number | null) => void;
  onPickEmoji: (messageId: number, emoji: string) => void;
  showAuthorNames?: boolean;
}) {
  const mine = message.author_id === meId;
  const isDeleted = Boolean(message.deleted_at);
  const isEditing = editingId === message.id;
  const canEdit = !isDeleted && Boolean(message.body) && (mine || canModerate);
  const attachments = message.attachments || [];

  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('group max-w-[88%] sm:max-w-[72%]', mine ? 'items-end' : 'items-start')}>
        {(showAuthorNames || !mine) && (
          <div
            className={cn(
              'mb-1 px-1 text-[11px] font-medium text-muted-foreground',
              mine && showAuthorNames && 'text-right'
            )}
          >
            {mine && showAuthorNames ? 'You' : displayName(message.author_name)}
          </div>
        )}

        <div
          className={cn(
            'relative rounded-2xl px-3 py-2 shadow-sm',
            mine
              ? 'rounded-br-sm bg-primary text-primary-foreground'
              : 'rounded-bl-sm border bg-muted/80 text-foreground',
            isDeleted && 'opacity-70'
          )}
        >
          {parent && !isDeleted && (
            <div
              className={cn(
                'mb-1.5 rounded-md border-l-2 px-2 py-1 text-xs',
                mine ? 'border-primary-foreground/40 bg-black/10' : 'border-primary/40 bg-background/60'
              )}
            >
              <span className="font-semibold">{displayName(parent.author_name)}</span>
              <p className="truncate opacity-80">{parent.deleted_at ? '[Message deleted]' : parent.body}</p>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editText}
                onChange={(e) => onEditText(e.target.value)}
                className={cn('min-h-[64px] text-sm', mine && 'bg-background text-foreground')}
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={mine ? 'secondary' : 'default'} onClick={() => onSaveEdit(message.id)} disabled={!editText.trim()}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" className={mine ? 'text-primary-foreground hover:bg-white/10' : ''} onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.body && (
                <p className={cn('text-sm whitespace-pre-wrap break-words', isDeleted && 'italic')}>
                  {isDeleted ? '[Message deleted]' : message.body}
                </p>
              )}
              {!isDeleted && attachments.length > 0 && (
                <div className={cn('space-y-2', message.body && 'mt-2')}>
                  {attachments.map((attachment) => (
                    <AttachmentMedia
                      key={attachment.id}
                      attachment={attachment}
                      compact
                      variant={mine ? 'inverted' : 'default'}
                    />
                  ))}
                </div>
              )}
              {!message.body && !isDeleted && attachments.length === 0 && (
                <p className="text-sm italic opacity-70">Empty message</p>
              )}
            </>
          )}

          <div className={cn('mt-1 flex items-center justify-end gap-1.5 text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {message.edited && !isDeleted && <span>edited</span>}
            <span>{fmtTime(message.created_at)}</span>
          </div>
        </div>

        {!isEditing && !isDeleted && (
          <div className={cn('mt-1 flex flex-wrap items-center gap-1', mine ? 'justify-end' : 'justify-start')}>
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction(message.id, r.emoji)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition',
                  r.mine ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted'
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-semibold tabular-nums">{r.count}</span>
              </button>
            ))}

            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => onToggleReaction(message.id, '👍')}>
                <ThumbsUp className="size-3.5" />
              </Button>
              <div className="relative">
                <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => onOpenPicker(pickerFor === message.id ? null : message.id)}>
                  <SmilePlus className="size-3.5" />
                </Button>
                {pickerFor === message.id && (
                  <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border bg-popover p-1 shadow-md">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" className="rounded-md px-2 py-1 text-lg hover:bg-muted" onClick={() => onPickEmoji(message.id, emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-xs" className="text-muted-foreground">
                    <MoreVertical className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={mine ? 'end' : 'start'}>
                  <DropdownMenuItem onClick={() => onReply(message)}>
                    <Reply className="size-4" />
                    Reply
                  </DropdownMenuItem>
                  {canEdit && (
                    <>
                      <DropdownMenuItem onClick={() => onStartEdit(message)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => onDelete(message.id)}>
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UserListSidebar({
  loading,
  search,
  onSearch,
  targets,
  conversations,
  groups,
  directConversations,
  activeId,
  onlineUserIds,
  isBoss,
  onCreateGroup,
  onSelectTarget,
  onSelectConversation,
}: {
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  targets: Target[];
  conversations: Conversation[];
  groups: Conversation[];
  directConversations: Conversation[];
  activeId: number | null;
  onlineUserIds: Set<number>;
  isBoss: boolean;
  onCreateGroup: () => void;
  onSelectTarget: (t: Target) => void;
  onSelectConversation: (c: Conversation) => void;
}) {
  const recentConversations = conversations.filter((c) => c.last_message_preview);
  const q = search.trim().toLowerCase();
  const filteredGroups = q
    ? groups.filter((g) => g.member_name.toLowerCase().includes(q))
    : groups;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Messages</h2>
          {isBoss && (
            <Button type="button" variant="outline" size="xs" onClick={onCreateGroup}>
              <Plus className="size-3.5" />
              Group
            </Button>
          )}
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search users or groups…" className="pl-8" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-1">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <>
              {recentConversations.length > 0 && !q && (
                <div className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Recent</div>
                  <div className="space-y-0.5">
                    {recentConversations.map((conv) => (
                      <SidebarRow
                        key={`conv-${conv.id}`}
                        active={activeId === conv.id}
                        name={displayName(conv.member_name)}
                        subtitle={conv.last_message_preview || ''}
                        online={conv.kind !== 'group' && conv.member_user_id != null && onlineUserIds.has(conv.member_user_id)}
                        isGroup={conv.kind === 'group'}
                        onClick={() => onSelectConversation(conv)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {filteredGroups.length > 0 && (
                <div className="mb-3">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Groups</div>
                  <div className="space-y-0.5">
                    {filteredGroups.map((group) => (
                      <SidebarRow
                        key={`group-${group.id}`}
                        active={activeId === group.id}
                        name={displayName(group.member_name)}
                        subtitle={
                          group.last_message_preview ||
                          `${group.member_count || 0} member${group.member_count === 1 ? '' : 's'}`
                        }
                        isGroup
                        onClick={() => onSelectConversation(group)}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {q ? 'Users' : 'All users'}
              </div>
              <div className="space-y-0.5">
                {targets.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">No users found.</p>
                ) : (
                  targets.map((target) => (
                    <SidebarRow
                      key={target.id}
                      active={
                        activeId !== null &&
                        directConversations.some(
                          (c) => c.id === activeId && c.member_user_id === target.id
                        )
                      }
                      name={displayName(target.name)}
                      subtitle={target.team_name || target.role}
                      online={onlineUserIds.has(target.id)}
                      onClick={() => onSelectTarget(target)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_MEMBER_IDS: number[] = [];

function GroupFormModal({
  open,
  onClose,
  title,
  initialName = '',
  initialMemberIds = EMPTY_MEMBER_IDS,
  users,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initialName?: string;
  initialMemberIds?: number[];
  users: { id: number; name: string; team_name?: string | null }[];
  busy: boolean;
  onSubmit: (name: string, memberIds: number[]) => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [memberIds, setMemberIds] = useState<number[]>(initialMemberIds);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setName(initialName);
      setMemberIds([...initialMemberIds]);
    }
    wasOpenRef.current = open;
  }, [open, initialName, initialMemberIds]);

  const toggleMember = (id: number) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales team"
            maxLength={140}
          />
        </div>
        <div className="space-y-2">
          <Label>Members</Label>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-2">
            {users.map((user) => (
              <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                <Checkbox checked={memberIds.includes(user.id)} onCheckedChange={() => toggleMember(user.id)} />
                <span className="min-w-0 truncate">
                  {user.name}
                  {user.team_name ? <span className="text-muted-foreground"> · {user.team_name}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !name.trim() || memberIds.length === 0}
            onClick={() => void onSubmit(name.trim(), memberIds)}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SidebarRow({
  active,
  name,
  subtitle,
  online = false,
  isGroup = false,
  onClick,
}: {
  active: boolean;
  name: string;
  subtitle: string;
  online?: boolean;
  isGroup?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
        active ? 'bg-muted font-medium' : 'hover:bg-muted/60'
      )}
    >
      <div className="relative shrink-0">
        <Avatar className={cn('size-9', isGroup ? 'bg-violet-500/10' : 'bg-primary/10')}>
          <AvatarFallback
            className={cn(
              'text-[10px] font-semibold',
              isGroup ? 'bg-violet-500/10 text-violet-700' : 'bg-primary/10 text-primary'
            )}
          >
            {isGroup ? <Users className="size-4" /> : initials(name)}
          </AvatarFallback>
        </Avatar>
        {!isGroup && online && (
          <span
            className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card bg-emerald-500"
            title="Online"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}

type PendingFile = {
  attachmentId: number;
  fileName: string;
  mimeType: string;
  durationSec?: number;
};

function ChatInner() {
  const me = useMe();
  const { setActiveConversation: setActiveChatConv, markConversationRead } = useChatUnread();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBoss = me && ['ADMIN', 'CEO'].includes(me.role);
  const canModerate = Boolean(isBoss);

  const [targets, setTargets] = useState<Target[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [mobileUsersOpen, setMobileUsersOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: number; name: string; team_name?: string | null }[]>([]);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [manageGroupOpen, setManageGroupOpen] = useState(false);
  const [groupFormBusy, setGroupFormBusy] = useState(false);
  const [manageMemberIds, setManageMemberIds] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeConvIdRef = useRef<number | null>(null);
  const initForUserRef = useRef<number | null>(null);

  const groups = useMemo(
    () => conversations.filter((c) => c.kind === 'group'),
    [conversations]
  );
  const directConversations = useMemo(
    () => conversations.filter((c) => c.kind !== 'group'),
    [conversations]
  );
  const isGroupChat = activeConversation?.kind === 'group';

  const loadAllUsers = useCallback(async (excludeSelf = true) => {
    try {
      const d = await api('/api/users');
      setAllUsers(
        (d.users || [])
          .filter((u: any) => u.is_active && (!excludeSelf || u.id !== me?.id))
          .map((u: any) => ({ id: u.id, name: u.name, team_name: u.team_name }))
      );
    } catch {
      /* optional */
    }
  }, [me?.id]);

  activeConvIdRef.current = activeConversation?.id ?? null;
  setActiveChatConv(activeConversation?.id ?? null);

  const pendingFilesRef = useRef<PendingFile[]>([]);
  pendingFilesRef.current = pendingFiles;

  const discardPendingUploads = useCallback(async (items: PendingFile[]) => {
    await Promise.all(
      items.map((item) =>
        deleteUpload(item.attachmentId).catch(() => {
          /* best effort cleanup */
        })
      )
    );
  }, []);

  const uploadPendingFile = useCallback(async (file: File, durationSec?: number) => {
    const fd = new FormData();
    fd.append('file', file);
    const uploaded = await apiUpload<{ id: number; fileName?: string; mimeType?: string }>('/api/uploads', fd);
    const next: PendingFile = {
      attachmentId: uploaded.id,
      fileName: uploaded.fileName || file.name,
      mimeType: uploaded.mimeType || file.type || 'application/octet-stream',
      durationSec,
    };
    setPendingFiles((prev) => [...prev, next]);
  }, []);

  const removePendingFile = useCallback(async (index: number) => {
    const item = pendingFilesRef.current[index];
    if (!item) return;
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    try {
      await deleteUpload(item.attachmentId);
    } catch (e) {
      toast.errorFrom(e);
    }
  }, []);

  const stopVoiceRecordingRef = useRef<() => void>(() => {});

  const { supported: voiceSupported, recording: recordingVoice, durationSec: recordingSeconds, stop: stopVoiceRecording, toggle: toggleVoice } = useVoiceRecorder({
    onRecorded: async (file, durationSec) => {
      try {
        await uploadPendingFile(file, durationSec);
      } catch (e) {
        toast.errorFrom(e);
      }
    },
    onError: (msg) => toast.error(msg),
  });
  stopVoiceRecordingRef.current = stopVoiceRecording;

  const clearComposerUploads = useCallback(async () => {
    stopVoiceRecordingRef.current();
    const items = [...pendingFilesRef.current];
    setPendingFiles([]);
    setText('');
    await discardPendingUploads(items);
  }, [discardPendingUploads]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, []);

  const applyPayload = useCallback((payload: ChatUpdatePayload) => {
    applyChatPayload(payload, activeConvIdRef.current, setMessages, setConversations, setActiveConversation);
    if (payload.message && activeConvIdRef.current === payload.conversation?.id) {
      scrollToBottom();
      if (payload.conversation?.id) markReadRef.current(payload.conversation.id);
    }
  }, [scrollToBottom]);

  const applyPayloadRef = useRef(applyPayload);
  applyPayloadRef.current = applyPayload;
  const markReadRef = useRef(markConversationRead);
  markReadRef.current = markConversationRead;

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const [targetsRes, convRes] = await Promise.all([api('/api/chat/targets'), api('/api/chat/conversations')]);
      setTargets(targetsRes.targets || []);
      setConversations(convRes.conversations || []);
    } catch (e) {
      toast.errorFrom(e);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: number) => {
    setLoadingMessages(true);
    try {
      const d = await api(`/api/chat/conversations/${conversationId}/messages`);
      setActiveConversation(d.conversation);
      setMessages(d.messages || []);
      scrollToBottom();
    } catch (e) {
      toast.errorFrom(e);
    } finally {
      setLoadingMessages(false);
    }
  }, [scrollToBottom]);

  const openWithUser = useCallback(async (userId?: number) => {
    setLoadingMessages(true);
    try {
      const d = await api('/api/chat/open', {
        method: 'POST',
        body: JSON.stringify(userId ? { userId } : {}),
      });
      setActiveConversation(d.conversation);
      setMessages(d.messages || []);
      setConversations((prev) => upsertConversation(prev, d.conversation));
      scrollToBottom();
    } catch (e) {
      toast.errorFrom(e);
    } finally {
      setLoadingMessages(false);
    }
  }, [scrollToBottom]);

  // Load chat data once per signed-in user. Shell refreshes /api/me on an interval;
  // do not re-fetch chat endpoints when that object reference changes.
  useEffect(() => {
    if (!me?.id) return;
    if (initForUserRef.current === me.id) return;
    initForUserRef.current = me.id;
    void loadList();
  }, [me?.id, loadList]);

  useEffect(() => {
    if (activeConversation?.id) {
      markConversationRead(activeConversation.id);
    }
  }, [activeConversation?.id, messages, markConversationRead]);

  useEffect(() => {
    return onChatUpdate((payload) => applyPayloadRef.current(payload));
  }, []);

  useEffect(() => {
    return onPresenceUpdate((detail) => {
      if (detail.onlineUserList) {
        setOnlineUserIds(new Set(detail.onlineUserList.map((u) => u.id)));
        return;
      }
      if (detail.onlineUsers) {
        setOnlineUserIds(new Set(detail.onlineUsers));
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      void discardPendingUploads(pendingFilesRef.current);
    };
  }, [discardPendingUploads]);

  const urlUserId = searchParams.get('userId');
  useEffect(() => {
    if (!me?.id || !urlUserId) return;
    const userId = Number(urlUserId);
    if (!Number.isFinite(userId) || userId <= 0) return;

    setReplyTo(null);
    setEditingId(null);
    setPickerFor(null);
    setMobileUsersOpen(false);
    void openWithUser(userId);
    router.replace('/chat', { scroll: false });
  }, [me?.id, urlUserId, openWithUser, router]);

  const urlConversationId = searchParams.get('conversationId');
  useEffect(() => {
    if (!me?.id || !urlConversationId) return;
    const conversationId = Number(urlConversationId);
    if (!Number.isFinite(conversationId) || conversationId <= 0) return;

    setReplyTo(null);
    setEditingId(null);
    setPickerFor(null);
    setMobileUsersOpen(false);
    void loadMessages(conversationId);
    router.replace('/chat', { scroll: false });
  }, [me?.id, urlConversationId, loadMessages, router]);

  const filteredTargets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.role || '').toLowerCase().includes(q) ||
        (t.team_name || '').toLowerCase().includes(q)
    );
  }, [targets, search]);

  const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  const resetComposerState = () => {
    setReplyTo(null);
    setEditingId(null);
    setEditText('');
    setPickerFor(null);
  };

  const switchConversation = (loadFn: () => void | Promise<void>) => {
    void clearComposerUploads().finally(() => {
      resetComposerState();
      setMobileUsersOpen(false);
      void loadFn();
    });
  };

  const selectConversation = (conv: Conversation) => {
    switchConversation(() => loadMessages(conv.id));
  };

  const selectTarget = (target: Target) => {
    switchConversation(() => openWithUser(target.id));
  };

  const send = async () => {
    if (!activeConversation) return;
    if (!text.trim() && pendingFiles.length === 0) return;
    setBusy(true);
    const sentAttachmentIds = pendingFiles.map((item) => item.attachmentId);
    try {
      const d = await api(`/api/chat/conversations/${activeConversation.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: text.trim(),
          parentMessageId: replyTo?.id ?? null,
          attachmentIds: sentAttachmentIds,
        }),
      });
      setText('');
      setPendingFiles([]);
      setReplyTo(null);
      applyPayload({ action: 'message', conversation: d.conversation, message: d.message });
    } catch (e) {
      toast.errorFrom(e);
    } finally {
      setBusy(false);
    }
  };

  const toggleReaction = async (messageId: number, emoji: string) => {
    if (!activeConversation) return;
    try {
      const d = await api(`/api/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      applyPayload({ action: 'reaction', conversation: d.conversation, message: d.message });
    } catch (e) {
      toast.errorFrom(e);
    }
  };

  const startEdit = (message: ChatMessage) => {
    setEditingId(message.id);
    setEditText(message.body || '');
    setReplyTo(null);
    setPickerFor(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const saveEdit = async (messageId: number) => {
    if (!activeConversation || !editText.trim()) return;
    try {
      const d = await api(`/api/chat/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: editText.trim() }),
      });
      cancelEdit();
      applyPayload({ action: 'message', conversation: d.conversation, message: d.message });
    } catch (e) {
      toast.errorFrom(e);
    }
  };

  const deleteMessage = async (messageId: number) => {
    if (!activeConversation) return;
    if (!window.confirm('Delete this message?')) return;
    try {
      const d = await api(`/api/chat/messages/${messageId}`, { method: 'DELETE' });
      applyPayload({ action: 'message', conversation: d.conversation, message: d.message });
    } catch (e) {
      toast.errorFrom(e);
    }
  };

  const openCreateGroup = () => {
    void loadAllUsers();
    setCreateGroupOpen(true);
  };

  const openManageGroup = async () => {
    if (!activeConversation || activeConversation.kind !== 'group') return;
    void loadAllUsers(false);
    try {
      const d = await api(`/api/chat/groups/${activeConversation.id}`);
      setManageMemberIds((d.members || []).map((m: any) => m.id));
      setManageGroupOpen(true);
    } catch (e) {
      toast.errorFrom(e);
    }
  };

  const createGroup = async (name: string, memberIds: number[]) => {
    setGroupFormBusy(true);
    try {
      const d = await api('/api/chat/groups', {
        method: 'POST',
        body: JSON.stringify({ name, memberIds }),
      });
      setCreateGroupOpen(false);
      setConversations((prev) => upsertConversation(prev, d.group));
      setActiveConversation(d.group);
      setMessages([]);
      toast.success('Group created');
      void loadList();
    } catch (e) {
      toast.errorFrom(e);
    } finally {
      setGroupFormBusy(false);
    }
  };

  const updateGroup = async (name: string, memberIds: number[]) => {
    if (!activeConversation || activeConversation.kind !== 'group') return;
    setGroupFormBusy(true);
    try {
      const d = await api(`/api/chat/groups/${activeConversation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, memberIds }),
      });
      setManageGroupOpen(false);
      applyPayload({ action: 'group', conversation: d.group });
      toast.success('Group updated');
      void loadList();
    } catch (e) {
      toast.errorFrom(e);
    } finally {
      setGroupFormBusy(false);
    }
  };

  const headerTitle = activeConversation
    ? displayName(activeConversation.member_name)
    : 'Select a chat';

  const headerSubtitle = activeConversation
    ? isGroupChat
      ? `${activeConversation.member_count || 0} member${activeConversation.member_count === 1 ? '' : 's'}`
      : activeConversation.member_email || activeConversation.member_role || undefined
    : 'Pick a user or group from the list';

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="hidden w-72 shrink-0 flex flex-col overflow-hidden border-r bg-card lg:flex">
        <UserListSidebar
          loading={loadingList}
          search={search}
          onSearch={setSearch}
          targets={filteredTargets}
          conversations={conversations}
          groups={groups}
          directConversations={directConversations}
          activeId={activeConversation?.id ?? null}
          onlineUserIds={onlineUserIds}
          isBoss={Boolean(isBoss)}
          onCreateGroup={openCreateGroup}
          onSelectTarget={selectTarget}
          onSelectConversation={selectConversation}
        />
      </div>

      <Sheet open={mobileUsersOpen} onOpenChange={setMobileUsersOpen}>
        <SheetContent side="left" className="flex w-[min(100vw-2rem,320px)] flex-col p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle>Choose user</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <UserListSidebar
              loading={loadingList}
              search={search}
              onSearch={setSearch}
              targets={filteredTargets}
              conversations={conversations}
              groups={groups}
              directConversations={directConversations}
              activeId={activeConversation?.id ?? null}
              onlineUserIds={onlineUserIds}
              isBoss={Boolean(isBoss)}
              onCreateGroup={openCreateGroup}
              onSelectTarget={selectTarget}
              onSelectConversation={selectConversation}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <Button type="button" variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileUsersOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{headerTitle}</h1>
            {headerSubtitle && <p className="truncate text-xs text-muted-foreground">{headerSubtitle}</p>}
          </div>
          {isBoss && isGroupChat && (
            <Button type="button" variant="outline" size="icon-sm" onClick={() => void openManageGroup()} title="Manage group">
              <Settings className="size-4" />
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
          <div className="space-y-2 px-3 py-2">
            {!activeConversation ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Pick a user or group to start chatting.
              </div>
            ) : loadingMessages ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={cn('h-12 animate-pulse rounded-2xl bg-muted', i % 2 ? 'ml-auto w-2/3' : 'w-2/3')} />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No messages yet. Say hello!</div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    parent={message.parent_message_id ? messageById.get(message.parent_message_id) ?? null : null}
                    meId={me!.id}
                    canModerate={canModerate}
                    showAuthorNames={isGroupChat}
                    pickerFor={pickerFor}
                    editingId={editingId}
                    editText={editText}
                    onEditText={setEditText}
                    onStartEdit={startEdit}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={saveEdit}
                    onDelete={deleteMessage}
                    onReply={setReplyTo}
                    onToggleReaction={toggleReaction}
                    onOpenPicker={setPickerFor}
                    onPickEmoji={(messageId, emoji) => {
                      void toggleReaction(messageId, emoji);
                      setPickerFor(null);
                    }}
                  />
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </div>
        </div>

        {activeConversation && (
          <div className="shrink-0 border-t bg-background px-3 py-2">
            {replyTo && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5 text-xs">
                <span>
                  Replying to <strong>{displayName(replyTo.author_name)}</strong>
                  {replyTo.body && <span className="ml-1 text-muted-foreground">· {replyTo.body.slice(0, 60)}</span>}
                </span>
                <Button type="button" variant="ghost" size="icon-xs" onClick={() => setReplyTo(null)}>
                  <X className="size-3.5" />
                </Button>
              </div>
            )}
            {recordingVoice && (
              <div className="mb-2">
                <VoiceRecordingBar durationSec={recordingSeconds} onStop={toggleVoice} />
              </div>
            )}
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pendingFiles.map((item, index) => (
                  <div key={item.attachmentId} className="flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-1 text-xs">
                    <Mic className="size-3 shrink-0 text-muted-foreground" />
                    <span className="max-w-[120px] truncate">
                      {item.mimeType.startsWith('audio/') ? 'Voice note' : item.fileName}
                    </span>
                    {item.durationSec != null && item.durationSec > 0 && (
                      <span className="tabular-nums text-muted-foreground">{formatDuration(item.durationSec)}</span>
                    )}
                    <button type="button" onClick={() => void removePendingFile(index)}>
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,audio/*,application/pdf,.doc,.docx,.zip,.txt"
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                e.target.value = '';
                void (async () => {
                  for (const file of picked) {
                    try {
                      await uploadPendingFile(file);
                    } catch (err) {
                      toast.errorFrom(err);
                    }
                  }
                })();
              }}
            />
            <div className="rounded-md border bg-muted/20 p-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a message…"
                className="min-h-[44px] resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => fileInputRef.current?.click()} title="Attach file">
                    <Paperclip className="size-4" />
                  </Button>
                  {voiceSupported && (
                    <Button
                      type="button"
                      variant={recordingVoice ? 'secondary' : 'ghost'}
                      size="icon-sm"
                      onClick={toggleVoice}
                      title={recordingVoice ? 'Stop recording' : 'Record voice note'}
                    >
                      {recordingVoice ? <Square className="size-3.5 fill-current text-red-600" /> : <Mic className="size-4" />}
                    </Button>
                  )}
                  <span className="hidden text-xs text-muted-foreground sm:inline">Enter to send</span>
                </div>
                <Button type="button" size="sm" disabled={busy || (!text.trim() && pendingFiles.length === 0)} onClick={() => void send()}>
                  <Send className="size-3.5" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <GroupFormModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        title="Create group"
        users={allUsers}
        busy={groupFormBusy}
        onSubmit={createGroup}
      />

      <GroupFormModal
        open={manageGroupOpen}
        onClose={() => setManageGroupOpen(false)}
        title="Manage group"
        initialName={activeConversation?.member_name || ''}
        initialMemberIds={manageMemberIds}
        users={allUsers}
        busy={groupFormBusy}
        onSubmit={updateGroup}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Shell>
      <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading chat…</div>}>
        <ChatInner />
      </Suspense>
    </Shell>
  );
}
