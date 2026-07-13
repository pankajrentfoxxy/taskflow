'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import Modal from '@/components/Modal';
import { api, timeAgo } from '@/lib/util';

function ProjectsInner() {
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState('');

  const load = () => api('/api/projects').then((d) => setProjects(d.projects));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr('');
    try {
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ name, description: desc }) });
      setOpen(false); setName(''); setDesc(''); load();
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Projects</h1>
        <button className="btn-primary" onClick={() => setOpen(true)}>+ New project</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card p-4 hover:border-brand-500 transition">
            <div className="font-bold">{p.name}</div>
            <div className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description || 'No description'}</div>
            <div className="flex gap-3 mt-3 text-xs text-gray-400">
              <span>👤 {p.member_count} members</span>
              <span>✓ {p.open_tasks} open tasks</span>
              <span>· {p.owner_name}</span>
            </div>
          </Link>
        ))}
        {projects.length === 0 && <div className="card p-10 text-center text-gray-400 sm:col-span-2">No projects yet.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <div className="space-y-3">
          <div><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><span className="label">Description</span><textarea className="input min-h-[70px]" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button className="btn-primary w-full" onClick={create} disabled={!name.trim()}>Create project</button>
        </div>
      </Modal>
    </>
  );
}

export default function ProjectsPage() {
  return <Shell><ProjectsInner /></Shell>;
}
