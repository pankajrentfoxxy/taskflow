'use client';
import { useState } from 'react';
import Modal from './Modal';
import { api, fromLocalInput, toLocalInput } from '@/lib/util';

export default function AckModal({
  task, open, onClose, onDone,
}: { task: any; open: boolean; onClose: () => void; onDone: () => void }) {
  const [eta, setEta] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const quick = (hours: number, eod = false) => {
    const d = new Date();
    if (eod) d.setHours(19, 0, 0, 0);
    else d.setTime(d.getTime() + hours * 3600 * 1000);
    setEta(toLocalInput(d.getTime()));
  };

  const submit = async () => {
    const etaAt = fromLocalInput(eta);
    if (!etaAt) { setErr('Set your ETA — it is mandatory'); return; }
    setBusy(true); setErr('');
    try {
      await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'acknowledge', etaAt }) });
      onDone(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Acknowledge & set ETA">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          You are acknowledging <strong>&quot;{task?.title}&quot;</strong>. An ETA is mandatory.
        </p>
        <div className="flex gap-1.5 flex-wrap">
          <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => quick(0, true)}>Today EOD</button>
          <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => quick(24)}>+24 hours</button>
          <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => quick(48)}>+2 days</button>
        </div>
        <input type="datetime-local" className="input" value={eta} onChange={(e) => setEta(e.target.value)} />
        {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
        <button className="btn-primary w-full" disabled={busy} onClick={submit}>
          {busy ? 'Saving…' : 'Acknowledge with this ETA'}
        </button>
      </div>
    </Modal>
  );
}
