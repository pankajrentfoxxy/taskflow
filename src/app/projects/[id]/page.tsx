'use client';
import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import TaskCard from '@/components/TaskCard';
import Composer from '@/components/Composer';
import { api, timeAgo, fmtDate } from '@/lib/util';

function ProjectInner({ id }: { id: string }) {
  const me = useMe();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'overview' | 'tasks' | 'files' | 'activity'>('overview');
  const [note, setNote] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    api(`/api/projects/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { load(); api('/api/users').then((d) => setUsers(d.users.filter((u: any) => u.is_active))); }, [load]);

  if (err) return <div className="card p-8 text-center text-red-600">{err}</div>;
  if (!data) return <div className="card h-60 animate-pulse" />;
  const { project, members, notes, tasks, files, activity, canManage } = data;

  const patch = (body: any) => api(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }).then(load).catch((e) => setErr(e.message));

  const uploadFile = async (f: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('projectId', id);
      await fetch('/api/uploads', { method: 'POST', body: fd });
      load();
    } finally { setUploading(false); }
  };

  const tabs = [
    ['overview', 'Overview'], ['tasks', `Tasks (${tasks.length})`], ['files', `Files (${files.length})`], ['activity', 'Activity'],
  ] as const;

  return (
    <>
      <Link href="/projects" className="text-sm text-gray-400 hover:text-brand-600">← Projects</Link>
      <div className="card p-4 mt-2 mb-4">
        <h1 className="text-lg font-bold">{project.name}</h1>
        <div className="text-xs text-gray-400 mt-0.5">Owner: {project.owner_name} · created {fmtDate(project.created_at)}</div>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {tabs.map(([k, label]) => (
          <button key={k}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${tab === k ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-2">Description</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.description || '—'}</p>
          </div>
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-2">Notes — visible to every member</h3>
            <div className="space-y-2 mb-3">
              {notes.map((n: any) => (
                <div key={n.id} className={`rounded-lg px-3 py-2 text-sm ${n.pinned ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                  {n.pinned ? '📌 ' : ''}{n.body}
                  <div className="text-[11px] text-gray-400 mt-1">
                    {n.author_name} · {timeAgo(n.created_at)}
                    {canManage && (
                      <button className="ml-2 text-brand-600 underline" onClick={() => patch({ togglePinNoteId: n.id })}>
                        {n.pinned ? 'unpin' : 'pin'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Add a note for the team…" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-primary" disabled={!note.trim()} onClick={() => { patch({ note }); setNote(''); }}>Add</button>
            </div>
          </div>
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-2">Members ({members.length})</h3>
            <div className="space-y-1.5 mb-3">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.name} <span className="text-xs text-gray-400">({m.role})</span></span>
                  {canManage && m.id !== project.owner_id && (
                    <button className="text-xs text-red-400 hover:text-red-600" onClick={() => patch({ removeMemberId: m.id })}>Remove</button>
                  )}
                </div>
              ))}
            </div>
            {canManage && (
              <div className="flex gap-2">
                <select className="input flex-1" value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                  <option value="">Add member…</option>
                  {users.filter((u) => !members.some((m: any) => m.id === u.id)).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button className="btn-primary" disabled={!addUserId} onClick={() => { patch({ addMemberId: Number(addUserId) }); setAddUserId(''); }}>Add</button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div>
          <button className="btn-primary mb-3" onClick={() => setComposerOpen(true)}>+ New task in this project</button>
          <div className="space-y-2">
            {tasks.map((t: any) => <TaskCard key={t.id} task={{ ...t, project_name: null }} />)}
            {tasks.length === 0 && <div className="card p-8 text-center text-gray-400">No tasks in this project yet.</div>}
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div>
          <label className="btn-secondary mb-3 cursor-pointer">
            {uploading ? 'Uploading…' : '⬆ Upload file to project'}
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {files.map((f: any) => (
              <a key={f.id} href={`/api/uploads/${f.id}`} target="_blank" className="card overflow-hidden hover:border-brand-500">
                {f.mime_type.startsWith('image/') ? (
                  <img src={`/api/uploads/${f.id}`} alt="" className="w-full h-28 object-cover" />
                ) : (
                  <div className="h-28 flex items-center justify-center text-3xl bg-gray-50">📄</div>
                )}
                <div className="px-2 py-1.5">
                  <div className="text-[11px] font-medium truncate">{f.file_name}</div>
                  <div className="text-[10px] text-gray-400">{f.uploader_name} · {timeAgo(f.created_at)}</div>
                </div>
              </a>
            ))}
            {files.length === 0 && <div className="card p-8 text-center text-gray-400 col-span-full">No files yet.</div>}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="card p-4 space-y-2">
          {activity.map((a: any) => (
            <div key={a.id} className="text-xs text-gray-500 border-b border-gray-50 pb-2 last:border-0">
              <span className="font-semibold text-gray-700">{a.actor_name || 'System'}</span>
              {' '}{a.type.toLowerCase().replace(/_/g, ' ')}
              {a.task_title && <> on <Link href={`/tasks/${a.task_id}`} className="text-brand-600 underline">{a.task_title}</Link></>}
              {' · '}{timeAgo(a.created_at)}
            </div>
          ))}
          {activity.length === 0 && <div className="text-center text-gray-400 py-4">No activity yet.</div>}
        </div>
      )}

      <Composer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} presetProjectId={Number(id)} />
    </>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Shell><ProjectInner id={id} /></Shell>;
}
