'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { api, fromLocalInput, toLocalInput } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Composer({
  open, onClose, onCreated, presetProjectId, presetParentId, presetAttachmentIds, presetBoardId, presetTitle,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (ids: number[]) => void;
  presetProjectId?: number | null;
  presetParentId?: number | null;
  presetAttachmentIds?: number[];
  presetBoardId?: number | null;
  presetTitle?: string;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [title, setTitle] = useState(presetTitle || '');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [due, setDue] = useState('');
  const [projectId, setProjectId] = useState<string>(presetProjectId ? String(presetProjectId) : '');
  const [multiple, setMultiple] = useState(false);
  const [linesText, setLinesText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [taskTypes, setTaskTypes] = useState<any[]>([]);
  const [taskTypeId, setTaskTypeId] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    api('/api/users').then((d) => setUsers(d.users.filter((u: any) => u.is_active)));
    api('/api/teams').then((d) => setTeams(d.teams));
    api('/api/projects').then((d) => setProjects(d.projects));
    setTitle(presetTitle || '');
    setErr('');
  }, [open, presetTitle]);

  // Task types follow the selected person's team (or the selected team)
  useEffect(() => {
    setTaskTypeId(''); setTargetCount('');
    if (!assignee) { setTaskTypes([]); return; }
    const [kind, idStr] = assignee.split(':');
    const q = kind === 't' ? `teamId=${idStr}` : `userId=${idStr}`;
    api(`/api/task-types?${q}`).then((d) => setTaskTypes(d.types)).catch(() => setTaskTypes([]));
  }, [assignee]);

  const selectedTeamId = (() => {
    if (!assignee) return null;
    const [kind, idStr] = assignee.split(':');
    if (kind === 't') return Number(idStr);
    return users.find((u) => u.id === Number(idStr))?.team_id ?? null;
  })();
  const teamMembers = assignee.startsWith('t:')
    ? users.filter((u) => u.team_id === Number(assignee.split(':')[1]))
    : [];
  const selectedType = taskTypes.find((tt) => String(tt.id) === taskTypeId);

  const quickDue = (label: string) => {
    const d = new Date();
    if (label === 'eod') d.setHours(19, 0, 0, 0);
    if (label === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); }
    if (label === '2d') { d.setDate(d.getDate() + 2); d.setHours(19, 0, 0, 0); }
    setDue(toLocalInput(d.getTime()));
  };

  const submit = async () => {
    setErr('');
    const dueAt = fromLocalInput(due);
    if (!dueAt) { setErr('Pick a due date & time'); return; }
    if (!assignee) { setErr('Pick an assignee'); return; }
    setBusy(true);
    try {
      // upload files first
      const attachmentIds: number[] = [...(presetAttachmentIds || [])];
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        const res = await fetch('/api/uploads', { method: 'POST', body: fd });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Upload failed');
        attachmentIds.push(d.id);
      }
      const [kind, idStr] = assignee.split(':');
      const payload: any = {
        title, description, priority, dueAt,
        assigneeId: kind === 'u' ? Number(idStr) : null,
        teamId: kind === 't' ? Number(idStr) : null,
        projectId: projectId ? Number(projectId) : null,
        parentId: presetParentId || null,
        boardId: presetBoardId || null,
        attachmentIds,
        taskTypeId: taskTypeId ? Number(taskTypeId) : null,
        targetCount: taskTypeId && targetCount ? Number(targetCount) : null,
        multiple,
        lines: multiple ? linesText.split('\n') : [],
      };
      const d = await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      onCreated?.(d.ids);
      onClose();
      setTitle(''); setDescription(''); setLinesText(''); setFiles([]); setMultiple(false); setDue(''); setTaskTypeId(''); setTargetCount('');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={presetParentId ? 'New subtask' : 'New task'}>
      <div className="space-y-4">
        {!presetParentId && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="composer-multiple"
              checked={multiple}
              onCheckedChange={(v) => setMultiple(v === true)}
            />
            <Label htmlFor="composer-multiple" className="text-sm font-medium text-muted-foreground">
              Multiple tasks (one per line — like the CEO&apos;s 3-in-one message)
            </Label>
          </div>
        )}
        {multiple ? (
          <div className="space-y-2">
            <Label>Tasks — one per line</Label>
            <Textarea
              className="min-h-[100px]"
              placeholder={'Prepare sales report\nCall vendor about invoice\nUpdate pricing page'}
              value={linesText}
              onChange={(e) => setLinesText(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              className="h-10"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label>Assign to</Label>
          <NativeSelect className="h-10" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Choose person or team…</option>
            <optgroup label="People">
              {users.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.name}{u.team_name ? ` (${u.team_name})` : ''}</option>)}
            </optgroup>
            {!presetParentId && (
              <optgroup label="Teams">
                {teams.map((t) => <option key={t.id} value={`t:${t.id}`}>Team: {t.name}</option>)}
              </optgroup>
            )}
          </NativeSelect>
        </div>
        {teamMembers.length > 0 && (
          <div className="text-xs text-muted-foreground -mt-2">
            <span className="font-semibold">Team members</span> (tap to assign a person):
            <div className="flex flex-wrap gap-1.5 mt-1">
              {teamMembers.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setAssignee(`u:${m.id}`)}
                >
                  {m.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        {assignee && !presetParentId && (taskTypes.length === 0 ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800">
            <AlertDescription className="text-xs text-amber-800">
              This team has no task types yet. A Head/Admin can add them from the <b>Manage</b> page (e.g. HR: Job Role, counted in Resumes). The task can still be created without a type.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Task type</Label>
              <NativeSelect className="h-10" value={taskTypeId} onChange={(e) => setTaskTypeId(e.target.value)}>
                <option value="">None</option>
                {taskTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>{tt.name} (counted in {tt.alias})</option>
                ))}
              </NativeSelect>
            </div>
            {selectedType && (
              <div className="space-y-2">
                <Label>Target — how many {selectedType.alias}?</Label>
                <Input
                  type="number"
                  min="1"
                  className="h-10"
                  placeholder="e.g. 10"
                  value={targetCount}
                  onChange={(e) => setTargetCount(e.target.value)}
                />
              </div>
            )}
          </div>
        ))}
        <div className="space-y-2">
          <Label>Due date & time</Label>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <Button type="button" variant="outline" size="xs" onClick={() => quickDue('eod')}>Today EOD</Button>
            <Button type="button" variant="outline" size="xs" onClick={() => quickDue('tomorrow')}>Tomorrow noon</Button>
            <Button type="button" variant="outline" size="xs" onClick={() => quickDue('2d')}>+2 days</Button>
          </div>
          <Input
            type="datetime-local"
            className="h-10"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Priority</Label>
            <NativeSelect className="h-10" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>URGENT</option><option>HIGH</option><option>NORMAL</option><option>LOW</option>
            </NativeSelect>
          </div>
          {!presetParentId && (
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <NativeSelect className="h-10" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea
            className="min-h-[70px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Attachments</Label>
          <Input
            type="file"
            multiple
            className="h-10 text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {(presetAttachmentIds?.length || 0) > 0 && (
            <div className="text-xs text-emerald-700 mt-1">✓ Drawing from Scribble attached</div>
          )}
        </div>
        {err && (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}
        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>
          {busy ? 'Creating…' : multiple ? 'Create tasks' : 'Create task'}
        </Button>
      </div>
    </Modal>
  );
}
