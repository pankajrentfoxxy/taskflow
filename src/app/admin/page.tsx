'use client';
import { useEffect, useState } from 'react';
import Shell, { useMe } from '@/components/Shell';
import Modal from '@/components/Modal';
import { api } from '@/lib/util';

function AdminInner() {
  const me = useMe();
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [userOpen, setUserOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MEMBER', teamId: '' });
  const [teamForm, setTeamForm] = useState({ name: '', managerId: '' });
  const [err, setErr] = useState('');

  const load = () => {
    api('/api/users').then((d) => setUsers(d.users));
    api('/api/teams').then((d) => setTeams(d.teams));
  };
  useEffect(() => { load(); }, []);

  if (me && me.role !== 'ADMIN') {
    return <div className="card p-8 text-center text-gray-400">Admin access only.</div>;
  }

  const createUser = async () => {
    setErr('');
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, teamId: form.teamId ? Number(form.teamId) : null }),
      });
      setUserOpen(false); setForm({ name: '', email: '', password: '', role: 'MEMBER', teamId: '' }); load();
    } catch (e: any) { setErr(e.message); }
  };

  const createTeam = async () => {
    setErr('');
    try {
      await api('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name: teamForm.name, managerId: teamForm.managerId ? Number(teamForm.managerId) : null }),
      });
      setTeamOpen(false); setTeamForm({ name: '', managerId: '' }); load();
    } catch (e: any) { setErr(e.message); }
  };

  const patchUser = (id: number, body: any) =>
    api('/api/users', { method: 'PATCH', body: JSON.stringify({ id, ...body }) }).then(load).catch((e) => setErr(e.message));

  return (
    <>
      <h1 className="text-xl font-bold mb-4">Admin</h1>
      {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{err}</div>}

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Users ({users.length})</h2>
        <button className="btn-primary !py-1.5 text-xs" onClick={() => setUserOpen(true)}>+ Add user</button>
      </div>
      <div className="card overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
              <th className="px-4 py-2.5">Name</th><th className="px-2 py-2.5">Role</th><th className="px-2 py-2.5">Team</th><th className="px-2 py-2.5">Status</th><th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-[11px] text-gray-400">{u.email}</div>
                </td>
                <td className="px-2 py-2">
                  <select className="input !w-auto !py-1 text-xs" value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}>
                    <option>ADMIN</option><option>CEO</option><option>MANAGER</option><option>MEMBER</option>
                  </select>
                </td>
                <td className="px-2 py-2">
                  <select className="input !w-auto !py-1 text-xs" value={u.team_id ?? ''} onChange={(e) => patchUser(u.id, { teamId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <button className={`pill ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}
                    onClick={() => patchUser(u.id, { isActive: !u.is_active })}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-2 py-2">
                  <button className="text-xs text-brand-600 underline"
                    onClick={() => { const p = prompt(`New password for ${u.name}:`); if (p) patchUser(u.id, { password: p }); }}>
                    Reset pw
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Teams ({teams.length})</h2>
        <button className="btn-primary !py-1.5 text-xs" onClick={() => setTeamOpen(true)}>+ Add team</button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {teams.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="font-bold">{t.name}</div>
            <div className="text-xs text-gray-500 mt-1">Manager: {t.manager_name || '—'}</div>
            <div className="text-xs text-gray-400">{t.member_count} members</div>
          </div>
        ))}
      </div>

      <div className="card p-4 text-xs text-gray-500 leading-relaxed">
        <div className="font-bold text-gray-700 mb-1">System settings</div>
        Working hours: <strong>10:00 – 19:00 IST, Mon–Sat</strong> · Response SLA: <strong>30 working minutes</strong> · Escalation: automatic when a task passes its due date.
        External cron (optional): <code className="bg-gray-100 px-1 rounded">GET /api/cron/sla-check</code> every minute — the app also sweeps automatically on activity.
      </div>

      <Modal open={userOpen} onClose={() => setUserOpen(false)} title="Add user">
        <div className="space-y-3">
          <div><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><span className="label">Email</span><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><span className="label">Password</span><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className="label">Role</span>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>MEMBER</option><option>MANAGER</option><option>CEO</option><option>ADMIN</option>
              </select>
            </div>
            <div><span className="label">Team</span>
              <select className="input" value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                <option value="">None</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={createUser} disabled={!form.name || !form.email || !form.password}>Create user</button>
        </div>
      </Modal>

      <Modal open={teamOpen} onClose={() => setTeamOpen(false)} title="Add team">
        <div className="space-y-3">
          <div><span className="label">Team name</span><input className="input" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} /></div>
          <div><span className="label">Manager</span>
            <select className="input" value={teamForm.managerId} onChange={(e) => setTeamForm({ ...teamForm, managerId: e.target.value })}>
              <option value="">Choose later</option>
              {users.filter((u) => u.is_active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <button className="btn-primary w-full" onClick={createTeam} disabled={!teamForm.name}>Create team</button>
        </div>
      </Modal>
    </>
  );
}

export default function AdminPage() {
  return <Shell><AdminInner /></Shell>;
}
