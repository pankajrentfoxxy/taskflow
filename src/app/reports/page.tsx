'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell, { useMe } from '@/components/Shell';
import Modal from '@/components/Modal';
import { api, fmtDateTime, STATUS_LABEL, STATUS_COLOR } from '@/lib/util';
import { IconInbox, IconClock, IconMute, IconAlert, IconScale, IconCalendar, IconCheckCircle, IconZap, IconActivity, IconTag, IconUsers, IconDownload } from '@/components/Icons';

function Stat({ icon, chip, label, value, tone, onClick, bar }: {
  icon: React.ReactNode; chip: string; label: string; value: any; tone?: string; onClick?: () => void; bar?: number | null;
}) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      className={`card p-4 text-left w-full group transition ${onClick ? 'hover:border-brand-300 hover:shadow-md' : 'cursor-default'}`}>
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${chip}`}>{icon}</span>
        {onClick && <span className="text-gray-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition text-sm">→</span>}
      </div>
      <div className={`text-[24px] font-bold mt-2.5 leading-none tracking-tight tnum ${tone || 'text-gray-900'}`}>{value ?? '—'}</div>
      <div className="text-xs text-gray-500 mt-1.5 font-medium">{label}</div>
      {bar != null && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2.5">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${bar}%` }} />
        </div>
      )}
    </button>
  );
}

function Num({ value, tone, onClick }: { value: any; tone?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`font-semibold underline decoration-dotted decoration-gray-300 underline-offset-4 hover:text-brand-600 hover:decoration-brand-400 transition ${tone || ''}`}>
      {value}
    </button>
  );
}

const TH = 'px-3 py-3 text-left text-[11px] text-gray-400 uppercase tracking-wider font-semibold';
const TD = 'px-3 py-3';

function ReportsInner() {
  const me = useMe();
  const [days, setDays] = useState('0');
  const [data, setData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [teamId, setTeamId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [drill, setDrill] = useState<{ title: string; tasks: any[] } | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

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

  const openDrill = async (metric: string, title: string, extra: Record<string, any> = {}) => {
    setDrillLoading(true);
    setDrill({ title, tasks: [] });
    try {
      const sp = new URLSearchParams({ days, list: metric });
      if (teamId) sp.set('teamId', teamId);
      if (typeId) sp.set('taskTypeId', typeId);
      for (const [k, v] of Object.entries(extra)) sp.set(k, String(v));
      const d = await api(`/api/reports?${sp}`);
      setDrill({ title, tasks: d.tasks });
    } finally { setDrillLoading(false); }
  };

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-24 card animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-28 card animate-pulse" />)}</div>
      </div>
    );
  }
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

  const attention = s.overdue + s.noResponse + s.escalatedAwaiting + s.escalatedPendingReview;

  return (
    <>
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            {data.scope === 'MEMBER' ? 'Your tasks' : data.scope === 'MANAGER' ? 'Your team' : 'Entire organization'}
          </p>
          <h1 className="text-[24px] font-bold tracking-tight mt-1">Reports</h1>
        </div>
        <span className={`pill !px-3 !py-1.5 !text-xs ${attention > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
          {attention > 0 ? <IconAlert className="w-3.5 h-3.5" /> : <IconCheckCircle className="w-3.5 h-3.5" />}
          {attention} need{attention === 1 ? 's' : ''} attention
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-5">
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
        {data.people.length > 0 && <button className="btn-secondary ml-auto" onClick={exportCsv}><IconDownload className="w-4 h-4" /> CSV</button>}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <Stat icon={<IconInbox className="w-4 h-4" />} chip="bg-brand-50 text-brand-500" label="Open tasks" value={s.open} onClick={() => openDrill('open', 'Open tasks')} />
        <Stat icon={<IconClock className="w-4 h-4" />} chip="bg-red-50 text-red-500" label="Overdue" value={s.overdue} tone={s.overdue > 0 ? 'text-red-600' : ''} onClick={() => openDrill('overdue', 'Overdue tasks')} />
        <Stat icon={<IconMute className="w-4 h-4" />} chip="bg-red-50 text-red-500" label="No response (SLA breach)" value={s.noResponse} tone={s.noResponse > 0 ? 'text-red-600' : ''} onClick={() => openDrill('no_response', 'No response (SLA breached)')} />
        <Stat icon={<IconAlert className="w-4 h-4" />} chip="bg-orange-50 text-orange-500" label="Awaiting explanation" value={s.escalatedAwaiting} tone={s.escalatedAwaiting > 0 ? 'text-orange-600' : ''} onClick={() => openDrill('esc_awaiting', 'Escalations awaiting explanation')} />
        <Stat icon={<IconScale className="w-4 h-4" />} chip="bg-amber-50 text-amber-500" label="Pending review" value={s.escalatedPendingReview} tone={s.escalatedPendingReview > 0 ? 'text-amber-600' : ''} onClick={() => openDrill('esc_pending', 'Explanations pending review')} />
        <Stat icon={<IconCalendar className="w-4 h-4" />} chip="bg-sky-50 text-sky-500" label="Due this week" value={s.dueThisWeek} onClick={() => openDrill('due_week', 'Due this week')} />
        <Stat icon={<IconCheckCircle className="w-4 h-4" />} chip="bg-emerald-50 text-emerald-500" label="Done" value={s.done} tone="text-emerald-600" onClick={() => openDrill('done', 'Done tasks')} />
        <Stat icon={<IconActivity className="w-4 h-4" />} chip="bg-emerald-50 text-emerald-500" label="On-time completion" value={s.onTimePct != null ? `${s.onTimePct}%` : '—'} tone="text-emerald-600" bar={s.onTimePct} />
        <Stat icon={<IconZap className="w-4 h-4" />} chip="bg-violet-50 text-violet-500" label="Avg response time" value={s.avgResponseMin != null ? `${s.avgResponseMin}m` : '—'} />
      </div>

      {/* By task type */}
      {data.byType && data.byType.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-6 h-6 rounded-md bg-brand-50 text-brand-500 flex items-center justify-center"><IconTag className="w-3.5 h-3.5" /></span>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-600">By task type</h2>
            <div className="flex-1 h-px bg-gray-200/70 ml-1" />
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className={`${TH} !pl-4`}>Team</th>
                    <th className={TH}>Task type</th>
                    <th className={TH}>Total</th>
                    <th className={TH}>Open</th>
                    <th className={`${TH} !text-red-500`}>Overdue</th>
                    <th className={TH}>No resp.</th>
                    <th className={TH}>Done</th>
                    <th className={TH}>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((bt: any) => {
                    const x = { taskTypeId: bt.id };
                    return (
                      <tr key={bt.id} className="border-t border-gray-50 hover:bg-brand-50/30 transition">
                        <td className={`${TD} !pl-4 text-xs text-gray-500`}>{bt.team_name}</td>
                        <td className={TD}>
                          <div className="font-semibold">{bt.name}</div>
                          <div className="text-[11px] text-gray-400">counted in {bt.alias}</div>
                        </td>
                        <td className={TD}><Num value={bt.total} onClick={() => openDrill('total', `${bt.name} — all tasks`, x)} /></td>
                        <td className={TD}><Num value={bt.open} onClick={() => openDrill('open', `${bt.name} — open`, x)} /></td>
                        <td className={TD}><Num value={bt.overdue} tone={bt.overdue > 0 ? 'text-red-600' : 'text-gray-400'} onClick={() => openDrill('overdue', `${bt.name} — overdue`, x)} /></td>
                        <td className={TD}><Num value={bt.no_response} tone={bt.no_response > 0 ? 'text-red-600' : 'text-gray-400'} onClick={() => openDrill('no_response', `${bt.name} — no response`, x)} /></td>
                        <td className={TD}><Num value={bt.done} tone={bt.done > 0 ? 'text-emerald-600' : 'text-gray-400'} onClick={() => openDrill('done', `${bt.name} — done`, x)} /></td>
                        <td className={TD}>
                          {bt.target > 0 ? (
                            <div className="min-w-[110px]">
                              <div className={`text-xs font-semibold ${bt.delivered >= bt.target ? 'text-emerald-600' : 'text-gray-600'}`}>
                                {bt.delivered}/{bt.target} {bt.alias}
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                                <div className={`h-full rounded-full ${bt.delivered >= bt.target ? 'bg-emerald-500' : 'bg-brand-500'}`}
                                  style={{ width: `${Math.min(100, (100 * bt.delivered) / bt.target)}%` }} />
                              </div>
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Per person */}
      {data.people.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-6 h-6 rounded-md bg-violet-50 text-violet-500 flex items-center justify-center"><IconUsers className="w-3.5 h-3.5" /></span>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-600">By person</h2>
            <div className="flex-1 h-px bg-gray-200/70 ml-1" />
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className={`${TH} !pl-4`}>Person</th>
                    <th className={TH}>Open</th>
                    <th className={`${TH} !text-red-500`}>Overdue</th>
                    <th className={TH}>No resp.</th>
                    <th className={TH}>Escal.</th>
                    <th className={TH}>Done</th>
                    <th className={TH}>On time</th>
                    <th className={TH}>Avg resp.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p: any) => {
                    const x = { personId: p.id };
                    const initials = p.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
                    return (
                      <tr key={p.id} className="border-t border-gray-50 hover:bg-brand-50/30 transition">
                        <td className={`${TD} !pl-4`}>
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-violet-100 text-brand-700 text-[11px] font-bold flex items-center justify-center shrink-0">{initials}</span>
                            <div>
                              <div className="font-semibold">{p.name.split(' (')[0]}</div>
                              <div className="text-[11px] text-gray-400">{p.team_name || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className={TD}><Num value={p.open} onClick={() => openDrill('open', `${p.name} — open`, x)} /></td>
                        <td className={TD}><Num value={p.overdue} tone={p.overdue > 0 ? 'text-red-600' : 'text-gray-400'} onClick={() => openDrill('overdue', `${p.name} — overdue`, x)} /></td>
                        <td className={TD}><Num value={p.no_response} tone={p.no_response > 0 ? 'text-red-600' : 'text-gray-400'} onClick={() => openDrill('no_response', `${p.name} — no response`, x)} /></td>
                        <td className={TD}><Num value={p.escalations} tone={p.escalations > 0 ? 'text-orange-600' : 'text-gray-400'} onClick={() => openDrill('escalations', `${p.name} — escalations`, x)} /></td>
                        <td className={TD}><Num value={p.done} tone={p.done > 0 ? 'text-emerald-600' : 'text-gray-400'} onClick={() => openDrill('done', `${p.name} — done`, x)} /></td>
                        <td className={TD}>
                          {p.done ? (
                            <span className={`pill ${Math.round((100 * p.done_ontime) / p.done) >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {Math.round((100 * p.done_ontime) / p.done)}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`${TD} text-gray-500`}>{p.avg_response_min != null ? `${p.avg_response_min}m` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down modal */}
      <Modal open={!!drill} onClose={() => setDrill(null)} title={drill?.title || ''}>
        {drillLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-2">
            {drill?.tasks.map((tk: any) => (
              <Link key={tk.id} href={`/tasks/${tk.id}`}
                className="block border border-gray-200 rounded-xl px-3.5 py-3 hover:border-brand-400 hover:shadow-sm transition"
                onClick={() => setDrill(null)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-400">#{tk.id}</span>
                  <span className={`pill ${STATUS_COLOR[tk.status] || 'bg-gray-100'}`}>{STATUS_LABEL[tk.status] || tk.status}</span>
                  {tk.sla_breached_at && tk.status === 'ASSIGNED' && <span className="pill bg-red-600 text-white">NO RESPONSE</span>}
                </div>
                <div className="font-semibold text-sm mt-1.5">{tk.title}</div>
                <div className="text-[11px] text-gray-500 mt-1">
                  {tk.assignee_name || 'Unassigned'} · due {fmtDateTime(tk.due_at)}
                  {tk.type_name && <> · {tk.type_name}{tk.target_count != null && <> ({tk.delivered_count}/{tk.target_count} {tk.type_alias})</>}</>}
                </div>
              </Link>
            ))}
            {drill && drill.tasks.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🎉</div>
                <div className="text-sm text-gray-400">No tasks in this bucket.</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export default function ReportsPage() {
  return <Shell><ReportsInner /></Shell>;
}
