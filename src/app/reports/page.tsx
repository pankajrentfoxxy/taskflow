'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import { api } from '@/lib/util';

function Stat({ label, value, tone, href }: { label: string; value: any; tone?: string; href?: string }) {
  const inner = (
    <div className={`card p-4 ${href ? 'hover:border-brand-500 transition' : ''}`}>
      <div className={`text-2xl font-bold ${tone || ''}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ReportsInner() {
  const me = useMe();
  const [days, setDays] = useState('0');
  const [data, setData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [teamId, setTeamId] = useState('');
  const [typeId, setTypeId] = useState('');

  useEffect(() => {
    const sp = new URLSearchParams({ days });
    if (teamId) sp.set('teamId', teamId);
    if (typeId) sp.set('taskTypeId', typeId);
    api(`/api/reports?${sp}`).then(setData);
  }, [days, teamId, typeId]);

  useEffect(() => {
    if (me && ['ADMIN', 'CEO'].includes(me.role)) api('/api/teams').then((d) => setTeams(d.teams)).catch(() => {});
  }, [me]);

  useEffect(() => {
    setTypeId('');
    const tid = me && ['ADMIN', 'CEO'].includes(me.role) ? teamId : me?.team_id ? String(me.team_id) : '';
    if (!tid) { setTypes([]); return; }
    api(`/api/task-types?teamId=${tid}`).then((d) => setTypes(d.types)).catch(() => setTypes([]));
  }, [teamId, me]);

  if (!data) return <div className="card h-60 animate-pulse" />;
  const s = data.summary;

  const exportCsv = () => {
    const header = 'Name,Team,Open,Overdue,No response,Escalations,Done,Done on time,Avg response (min)\n';
    const rows = data.people.map((p: any) =>
      [p.name, p.team_name || '', p.open, p.overdue, p.no_response, p.escalations, p.done, p.done_ontime, p.avg_response_min ?? ''].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'taskflow-report.csv';
    a.click();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Reports</h1>
          <p className="text-xs text-gray-500">Scope: {data.scope === 'MEMBER' ? 'your tasks' : data.scope === 'MANAGER' ? 'your team' : 'entire organization'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {me && ['ADMIN', 'CEO'].includes(me.role) && (
            <select className="input !w-auto" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">All teams</option>
              {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {types.length > 0 && (
            <select className="input !w-auto" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">All task types</option>
              {types.map((tt: any) => <option key={tt.id} value={tt.id}>{tt.name} ({tt.alias})</option>)}
            </select>
          )}
          <select className="input !w-auto" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="0">All time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          {data.people.length > 0 && <button className="btn-secondary" onClick={exportCsv}>⬇ CSV</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Open tasks" value={s.open} />
        <Stat label="Overdue" value={s.overdue} tone="text-red-600" href="/tasks?status=ESCALATED" />
        <Stat label="No response (SLA breach)" value={s.noResponse} tone="text-red-600" href="/tasks?status=ASSIGNED" />
        <Stat label="Escalations awaiting explanation" value={s.escalatedAwaiting} tone="text-orange-600" />
        <Stat label="Explanations pending review" value={s.escalatedPendingReview} tone="text-amber-600" />
        <Stat label="Due this week" value={s.dueThisWeek} />
        <Stat label="Done" value={s.done} tone="text-emerald-600" />
        <Stat label="On-time completion" value={s.onTimePct != null ? `${s.onTimePct}%` : '—'} tone="text-emerald-600" />
        <Stat label="Avg response time" value={s.avgResponseMin != null ? `${s.avgResponseMin} min` : '—'} />
      </div>

      {data.byType && data.byType.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-sm mb-2">By task type</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3">Team</th>
                  <th className="px-2 py-3">Task type</th>
                  <th className="px-2 py-3">Total</th>
                  <th className="px-2 py-3">Open</th>
                  <th className="px-2 py-3 text-red-600">Overdue</th>
                  <th className="px-2 py-3">No resp.</th>
                  <th className="px-2 py-3">Done</th>
                  <th className="px-2 py-3">Delivered</th>
                </tr>
              </thead>
              <tbody>
                {data.byType.map((bt: any) => (
                  <tr key={bt.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-gray-500">{bt.team_name}</td>
                    <td className="px-2 py-2.5">
                      <div className="font-medium">{bt.name}</div>
                      <div className="text-[11px] text-gray-400">counted in {bt.alias}</div>
                    </td>
                    <td className="px-2 py-2.5">{bt.total}</td>
                    <td className="px-2 py-2.5">{bt.open}</td>
                    <td className={`px-2 py-2.5 ${bt.overdue > 0 ? 'text-red-600 font-bold' : ''}`}>{bt.overdue}</td>
                    <td className={`px-2 py-2.5 ${bt.no_response > 0 ? 'text-red-600 font-bold' : ''}`}>{bt.no_response}</td>
                    <td className="px-2 py-2.5">{bt.done}</td>
                    <td className="px-2 py-2.5">
                      {bt.target > 0 ? (
                        <span className={bt.delivered >= bt.target ? 'text-emerald-600 font-semibold' : ''}>
                          {bt.delivered}/{bt.target} {bt.alias}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.people.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3">Person</th>
                <th className="px-2 py-3">Open</th>
                <th className="px-2 py-3 text-red-600">Overdue</th>
                <th className="px-2 py-3">No resp.</th>
                <th className="px-2 py-3">Escal.</th>
                <th className="px-2 py-3">Done</th>
                <th className="px-2 py-3">On time</th>
                <th className="px-2 py-3">Avg resp.</th>
              </tr>
            </thead>
            <tbody>
              {data.people.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-gray-400">{p.team_name || '—'}</div>
                  </td>
                  <td className="px-2 py-2.5">{p.open}</td>
                  <td className={`px-2 py-2.5 ${p.overdue > 0 ? 'text-red-600 font-bold' : ''}`}>{p.overdue}</td>
                  <td className={`px-2 py-2.5 ${p.no_response > 0 ? 'text-red-600 font-bold' : ''}`}>{p.no_response}</td>
                  <td className={`px-2 py-2.5 ${p.escalations > 0 ? 'text-orange-600 font-bold' : ''}`}>{p.escalations}</td>
                  <td className="px-2 py-2.5">{p.done}</td>
                  <td className="px-2 py-2.5">{p.done ? `${Math.round((100 * p.done_ontime) / p.done)}%` : '—'}</td>
                  <td className="px-2 py-2.5">{p.avg_response_min != null ? `${p.avg_response_min}m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function ReportsPage() {
  return <Shell><ReportsInner /></Shell>;
}
