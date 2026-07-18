'use client';
import { useEffect, useState } from 'react';
import Modal from './Modal';
import { api, fromLocalInput, toLocalInput } from '@/lib/util';

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
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="rounded" />
            Multiple tasks (one per line — like the CEO&apos;s 3-in-one message)
          </label>
        )}
        {multiple ? (
          <div>
            <span className="label">Tasks — one per line</span>
            <textarea className="input min-h-[100px]" placeholder={'Prepare sales report\nCall vendor about invoice\nUpdate pricing page'}
              value={linesText} onChange={(e) => setLinesText(e.target.value)} />
          </div>
        ) : (
          <div>
            <span className="label">Title</span>
            <input className="input" placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </div>
        )}
        <div>
          <span className="label">Assign to</span>
          <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Choose person or team…</option>
            <optgroup label="People">
              {users.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.name}{u.team_name ? ` (${u.team_name})` : ''}</option>)}
            </optgroup>
            {!presetParentId && (
              <optgroup label="Teams">
                {teams.map((t) => <option key={t.id} value={`t:${t.id}`}>Team: {t.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        {teamMembers.length > 0 && (
          <div className="text-xs text-gray-500 -mt-2">
            <span className="font-semibold">Team members</span> (tap to assign a person):
            <div className="flex flex-wrap gap-1.5 mt-1">
              {teamMembers.map((m) => (
                <button key={m.id} type="button" className="px-2 py-1 rounded-full bg-gray-100 hover:bg-brand-100 text-gray-700"
                  onClick={() => setAssignee(`u:${m.id}`)}>
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {taskTypes.length > 0 && !presetParentId && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="label">Task type</span>
              <select className="input" value={taskTypeId} onChange={(e) => setTaskTypeId(e.target.value)}>
                <option value="">None</option>
                {taskTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>{tt.name} (counted in {tt.alias})</option>
                ))}
              </select>
            </div>
            {selectedType && (
              <div>
                <span className="label">Target — how many {selectedType.alias}?</span>
                <input type="number" min="1" className="input" placeholder="e.g. 10"
                  value={targetCount} onChange={(e) => setTargetCount(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <div>
          <span className="label">Due date & time</span>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <button type="button" className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => quickDue('eod')}>Today EOD</button>
            <button type="button" className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => quickDue('tomorrow')}>Tomorrow noon</button>
            <button type="button" className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => quickDue('2d')}>+2 days</button>
          </div>
          <input type="datetime-local" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">Priority</span>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>URGENT</option><option>HIGH</option><option>NORMAL</option><option>LOW</option>
            </select>
          </div>
          {!presetParentId && (
            <div>
              <span className="label">Project (optional)</span>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <span className="label">Description (optional)</span>
          <textarea className="input min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <span className="label">Attachments</span>
          <input type="file" multiple className="text-sm" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          {(presetAttachmentIds?.length || 0) > 0 && (
            <div className="text-xs text-emerald-700 mt-1">✓ Drawing from Scribble attached</div>
          )}
        </div>
        {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
        <button className="btn-primary w-full" disabled={busy} onClick={submit}>
          {busy ? 'Creating…' : multiple ? 'Create tasks' : 'Create task'}
        </button>
      </div>
    </Modal>
  );
}
