'use client';
import { useEffect, useState } from 'react';
import Shell, { useMe } from '@/components/Shell';
import Modal from '@/components/Modal';
import { api } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { NativeSelect } from '@/components/ui/native-select';
import { Alert, AlertDescription } from '@/components/ui/alert';

function AdminInner() {
  const me = useMe();
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [userOpen, setUserOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MEMBER', teamId: '' });
  const [teamForm, setTeamForm] = useState({ name: '', managerId: '' });
  const [types, setTypes] = useState<any[]>([]);
  const [typeForm, setTypeForm] = useState({ teamId: '', name: '', alias: '' });
  const [err, setErr] = useState('');

  const load = () => {
    api('/api/users').then((d) => setUsers(d.users)).catch(() => {});
    api('/api/teams').then((d) => setTeams(d.teams)).catch(() => {});
    api('/api/task-types?manage=1').then((d) => setTypes(d.types)).catch(() => setTypes([]));
  };
  useEffect(() => { load(); }, []);

  const isAdmin = me?.role === 'ADMIN';
  const isHead = me?.role === 'MANAGER';
  if (me && !isAdmin && !isHead && me.role !== 'CEO') {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-400">
          Admin or Team Head access only.
        </CardContent>
      </Card>
    );
  }

  const createType = async () => {
    setErr('');
    try {
      const teamId = isAdmin || me?.role === 'CEO' ? Number(typeForm.teamId) : me?.team_id;
      await api('/api/task-types', { method: 'POST', body: JSON.stringify({ teamId, name: typeForm.name, alias: typeForm.alias }) });
      setTypeForm({ teamId: '', name: '', alias: '' }); load();
    } catch (e: any) { setErr(e.message); }
  };

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
      {err && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Task Types — category & alias per team</h2>
      </div>
      <Card className="mb-3 overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 hover:bg-transparent">
                <TableHead className="px-4 py-2.5">Team</TableHead>
                <TableHead className="px-2 py-2.5">Task type</TableHead>
                <TableHead className="px-2 py-2.5">Alias (unit)</TableHead>
                <TableHead className="px-2 py-2.5">Used</TableHead>
                <TableHead className="px-2 py-2.5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((tt) => (
                <TableRow key={tt.id} className="border-b border-gray-50 last:border-0">
                  <TableCell className="px-4 py-2 text-xs text-gray-500">{tt.team_name}</TableCell>
                  <TableCell className="px-2 py-2 font-medium">{tt.name}</TableCell>
                  <TableCell className="px-2 py-2">{tt.alias}</TableCell>
                  <TableCell className="px-2 py-2 text-xs text-gray-400">{tt.used_count} task{tt.used_count === 1 ? '' : 's'}</TableCell>
                  <TableCell className="px-2 py-2">
                    <Badge
                      role="button"
                      className={`cursor-pointer ${tt.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}
                      onClick={() => api('/api/task-types', { method: 'PATCH', body: JSON.stringify({ id: tt.id, isActive: !tt.is_active }) }).then(load).catch((e) => setErr(e.message))}
                    >
                      {tt.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow>
                  <TableCell className="px-4 py-4 text-gray-400" colSpan={5}>No task types yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="mb-6">
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-2">
            {(isAdmin || me?.role === 'CEO') ? (
              <NativeSelect value={typeForm.teamId} onChange={(e) => setTypeForm({ ...typeForm, teamId: e.target.value })}>
                <option value="">Team…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            ) : (
              <div className="flex h-8 items-center rounded-lg border border-input bg-gray-50 px-2.5 text-sm text-gray-500">
                {me?.team || 'My team'}
              </div>
            )}
            <Input placeholder="Type name (e.g. Job Role)" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
            <Input placeholder="Alias / unit (e.g. Resume)" value={typeForm.alias} onChange={(e) => setTypeForm({ ...typeForm, alias: e.target.value })} />
            <Button
              onClick={createType}
              disabled={!typeForm.name.trim() || !typeForm.alias.trim() || ((isAdmin || me?.role === 'CEO') && !typeForm.teamId)}
            >
              + Add type
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (<>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Users ({users.length})</h2>
        <Button size="sm" className="text-xs" onClick={() => setUserOpen(true)}>+ Add user</Button>
      </div>
      <Card className="mb-6 overflow-hidden py-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-left text-xs text-gray-400 uppercase border-b border-gray-100 hover:bg-transparent">
                <TableHead className="px-4 py-2.5">Name</TableHead>
                <TableHead className="px-2 py-2.5">Role</TableHead>
                <TableHead className="px-2 py-2.5">Team</TableHead>
                <TableHead className="px-2 py-2.5">Status</TableHead>
                <TableHead className="px-2 py-2.5"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="border-b border-gray-50 last:border-0">
                  <TableCell className="px-4 py-2">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-[11px] text-gray-400">{u.email}</div>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <NativeSelect className="w-auto py-1 text-xs h-auto" value={u.role} onChange={(e) => patchUser(u.id, { role: e.target.value })}>
                      <option>ADMIN</option><option>CEO</option><option>MANAGER</option><option>MEMBER</option>
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <NativeSelect className="w-auto py-1 text-xs h-auto" value={u.team_id ?? ''} onChange={(e) => patchUser(u.id, { teamId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">—</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <Badge
                      role="button"
                      className={`cursor-pointer ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}
                      onClick={() => patchUser(u.id, { isActive: !u.is_active })}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2 py-2">
                    <button className="text-xs text-brand-600 underline"
                      onClick={() => { const p = prompt(`New password for ${u.name}:`); if (p) patchUser(u.id, { password: p }); }}>
                      Reset pw
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm">Teams ({teams.length})</h2>
        <Button size="sm" className="text-xs" onClick={() => setTeamOpen(true)}>+ Add team</Button>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {teams.map((t) => (
          <Card key={t.id}>
            <CardContent>
              <div className="font-bold">{t.name}</div>
              <div className="text-xs text-gray-500 mt-1">Manager: {t.manager_name || '—'}</div>
              <div className="text-xs text-gray-400">{t.member_count} members</div>
            </CardContent>
          </Card>
        ))}
      </div>

      </>)}

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-xs text-gray-700">System settings</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-gray-500 leading-relaxed">
          Working hours: <strong>10:00 – 19:00 IST, Mon–Sat</strong> · Response SLA: <strong>30 working minutes</strong> · Escalation: automatic when a task passes its due date.
          External cron (optional): <code className="bg-gray-100 px-1 rounded">GET /api/cron/sla-check</code> every minute — the app also sweeps automatically on activity.
        </CardContent>
      </Card>

      <Modal open={userOpen} onClose={() => setUserOpen(false)} title="Add user">
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Password</Label>
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>MEMBER</option><option>MANAGER</option><option>CEO</option><option>ADMIN</option>
              </NativeSelect>
            </div>
            <div>
              <Label>Team</Label>
              <NativeSelect value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                <option value="">None</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </NativeSelect>
            </div>
          </div>
          <Button className="w-full" onClick={createUser} disabled={!form.name || !form.email || !form.password}>Create user</Button>
        </div>
      </Modal>

      <Modal open={teamOpen} onClose={() => setTeamOpen(false)} title="Add team">
        <div className="space-y-3">
          <div>
            <Label>Team name</Label>
            <Input value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
          </div>
          <div>
            <Label>Manager</Label>
            <NativeSelect value={teamForm.managerId} onChange={(e) => setTeamForm({ ...teamForm, managerId: e.target.value })}>
              <option value="">Choose later</option>
              {users.filter((u) => u.is_active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </NativeSelect>
          </div>
          <Button className="w-full" onClick={createTeam} disabled={!teamForm.name}>Create team</Button>
        </div>
      </Modal>
    </>
  );
}

export default function AdminPage() {
  return <Shell><AdminInner /></Shell>;
}
