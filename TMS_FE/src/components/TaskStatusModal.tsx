'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import {
  api,
  fromLocalInput,
  STATUS_COLOR,
  STATUS_COLOR_FALLBACK,
  STATUS_LABEL,
  TASK_ACTION_TOAST,
  toast,
  toLocalInput,
} from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type View = 'actions' | 'ack' | 'reason' | 'eta';

export default function TaskStatusModal({
  task,
  open,
  onClose,
  onDone,
}: {
  task: { id: number; title?: string; status?: string } | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [view, setView] = useState<View>('actions');
  const [pendingAction, setPendingAction] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [eta, setEta] = useState('');

  const reset = useCallback(() => {
    setErr('');
    setView('actions');
    setPendingAction('');
    setReasonText('');
    setEta('');
  }, []);

  const load = useCallback(async () => {
    if (!task?.id) return;
    setLoading(true);
    setErr('');
    try {
      const data = await api(`/api/tasks/${task.id}`);
      setDetail(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load task');
      toast.errorFrom(e, 'Failed to load task');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [task?.id]);

  useEffect(() => {
    if (open && task?.id) {
      reset();
      load();
    } else if (!open) {
      setDetail(null);
      reset();
    }
  }, [open, task?.id, load, reset]);

  const act = async (body: Record<string, unknown>) => {
    if (!task?.id) return;
    setBusy(true);
    setErr('');
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      const action = String(body.action || '');
      toast.success(TASK_ACTION_TOAST[action] || 'Task updated');
      onDone();
      onClose();
    } catch (e: any) {
      if (e.code === 'OPEN_SUBTASKS') {
        const reason = prompt(`${e.message}\n\nCreator/Admin override — enter a reason:`);
        if (reason) await act({ ...body, overrideReason: reason });
      } else {
        setErr(e.message || 'Action failed');
        toast.errorFrom(e, 'Action failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const quickEta = (hours: number, eod = false) => {
    const d = new Date();
    if (eod) d.setHours(19, 0, 0, 0);
    else d.setTime(d.getTime() + hours * 3600 * 1000);
    setEta(toLocalInput(d.getTime()));
  };

  const submitAck = () => {
    const etaAt = fromLocalInput(eta);
    if (!etaAt) {
      const msg = 'Set your ETA — it is mandatory';
      setErr(msg);
      toast.error(msg);
      return;
    }
    act({ action: 'acknowledge', etaAt });
  };

  const submitReason = () => {
    if (pendingAction === 'discuss') {
      act({ action: 'discuss', reason: reasonText.trim() || undefined });
      return;
    }
    if (!reasonText.trim()) {
      const msg = 'A reason is required';
      setErr(msg);
      toast.error(msg);
      return;
    }
    act({ action: pendingAction, reason: reasonText.trim() });
  };

  const submitEta = () => {
    const etaAt = fromLocalInput(eta);
    if (!etaAt) {
      const msg = 'Pick an ETA';
      setErr(msg);
      toast.error(msg);
      return;
    }
    act({ action: 'update_eta', etaAt });
  };

  const openReason = (action: string) => {
    setPendingAction(action);
    setReasonText('');
    setErr('');
    setView('reason');
  };

  const t = detail?.task;
  const perm = detail?.permissions;
  const status = t?.status || task?.status || '';
  const title = t?.title || task?.title || 'Task';

  const isEscalated = status === 'ESCALATED';
  const actionButtons: { label: string; onClick: () => void; variant?: 'default' | 'outline'; className?: string }[] = [];

  if (perm?.mustExplain) {
    // Escalation blocks other actions until explanation is submitted on detail page.
  } else if (perm && isEscalated) {
    if (perm.canEditEta) {
      actionButtons.push({
        label: 'Update ETA',
        variant: 'outline',
        onClick: () => {
          setEta(t?.eta_at ? toLocalInput(t.eta_at) : '');
          setErr('');
          setView('eta');
        },
      });
    }
  } else if (perm) {
    if (perm.canAcknowledge) {
      actionButtons.push({
        label: 'Accept + ETA',
        onClick: () => {
          setEta('');
          setErr('');
          setView('ack');
        },
      });
    }
    if (perm.canDiscuss) {
      actionButtons.push({
        label: 'Discuss',
        variant: 'outline',
        onClick: () => openReason('discuss'),
      });
    }
    if (perm.canReject) {
      actionButtons.push({
        label: 'Reject',
        variant: 'outline',
        className: 'text-red-600',
        onClick: () => openReason('reject'),
      });
    }
    if (perm.canStart) {
      actionButtons.push({ label: 'Start', onClick: () => act({ action: 'start' }) });
    }
    if (perm.canDone) {
      actionButtons.push({
        label: 'Mark done',
        onClick: () => act({ action: 'done' }),
        className: 'bg-emerald-600 text-white hover:bg-emerald-700',
      });
    }
    if (perm.canBlock && !t?.blocked_reason) {
      actionButtons.push({
        label: 'Mark blocked',
        variant: 'outline',
        onClick: () => openReason('block'),
      });
    }
    if (t?.blocked_reason && perm.isAssignee) {
      actionButtons.push({
        label: 'Unblock',
        variant: 'outline',
        onClick: () => act({ action: 'unblock' }),
      });
    }
    if (perm.canReopen) {
      actionButtons.push({
        label: 'Reopen',
        variant: 'outline',
        onClick: () => openReason('reopen'),
      });
    }
    if (perm.canCancel) {
      actionButtons.push({
        label: 'Cancel task',
        variant: 'outline',
        className: 'text-red-600',
        onClick: () => openReason('cancel'),
      });
    }
    if (perm.canEditEta) {
      actionButtons.push({
        label: 'Update ETA',
        variant: 'outline',
        onClick: () => {
          setEta(t?.eta_at ? toLocalInput(t.eta_at) : '');
          setErr('');
          setView('eta');
        },
      });
    }
  }

  const reasonTitle =
    pendingAction === 'block'
      ? 'What is blocking you?'
      : pendingAction === 'reopen'
        ? 'Why reopen this task?'
        : pendingAction === 'reject'
          ? 'Why reject this task?'
          : pendingAction === 'discuss'
            ? 'What should be discussed? (optional)'
            : 'Why cancel this task?';

  return (
    <Modal open={open} onClose={onClose} title="Change status">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{title}</span>
          </p>
          <div className="mt-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current status</span>
            <div className="mt-1">
              <Badge className={cn(STATUS_COLOR[status] || STATUS_COLOR_FALLBACK)}>
                <span className="mr-1.5 size-1.5 rounded-full bg-current opacity-70" />
                {STATUS_LABEL[status] || status}
              </Badge>
            </div>
          </div>
        </div>

        {loading && <div className="h-16 animate-pulse rounded-lg bg-muted/50" />}

        {!loading && perm?.mustExplain && (
          <Alert>
            <AlertDescription>
              This task is escalated. Open the task detail page to submit your explanation before changing status.
            </AlertDescription>
          </Alert>
        )}

        {!loading && view === 'actions' && !perm?.mustExplain && (
          <>
            {actionButtons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No status changes available for you on this task.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {actionButtons.map((btn) => (
                  <Button
                    key={btn.label}
                    type="button"
                    variant={btn.variant || 'default'}
                    className={cn('justify-start', btn.className)}
                    disabled={busy}
                    onClick={btn.onClick}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && view === 'ack' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">An ETA is mandatory when accepting this task.</p>
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => quickEta(0, true)}>
                Today EOD
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => quickEta(24)}>
                +24 hours
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => quickEta(48)}>
                +2 days
              </Button>
            </div>
            <Input type="datetime-local" className="h-10" value={eta} onChange={(e) => setEta(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setView('actions')} disabled={busy}>
                Back
              </Button>
              <Button type="button" className="flex-1" disabled={busy} onClick={submitAck}>
                {busy ? 'Saving…' : 'Accept'}
              </Button>
            </div>
          </div>
        )}

        {!loading && view === 'reason' && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{reasonTitle}</p>
            <Textarea rows={3} value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setView('actions')} disabled={busy}>
                Back
              </Button>
              <Button type="button" className="flex-1" disabled={busy} onClick={submitReason}>
                {busy ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </div>
        )}

        {!loading && view === 'eta' && (
          <div className="space-y-3">
            <Input type="datetime-local" className="h-10" value={eta} onChange={(e) => setEta(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setView('actions')} disabled={busy}>
                Back
              </Button>
              <Button type="button" className="flex-1" disabled={busy} onClick={submitEta}>
                {busy ? 'Saving…' : 'Save ETA'}
              </Button>
            </div>
          </div>
        )}

        {err && (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
