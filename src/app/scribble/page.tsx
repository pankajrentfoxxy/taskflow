'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Modal from '@/components/Modal';
import Composer from '@/components/Composer';
import { api } from '@/lib/util';

type El =
  | { type: 'stroke'; points: number[][]; color: string; width: number }
  | { type: 'rect' | 'ellipse' | 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number };

const COLORS = ['#111827', '#3b55e6', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777', '#6b7280'];
const WIDTHS = [2, 4, 8];

export default function ScribblePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text'>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [elements, setElements] = useState<El[]>([]);
  const [undoStack, setUndoStack] = useState<El[][]>([]);
  const [redoStack, setRedoStack] = useState<El[][]>([]);
  const [stylusOnly, setStylusOnly] = useState(false);
  const [boards, setBoards] = useState<any[]>([]);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardName, setBoardName] = useState('Untitled board');
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [attachId, setAttachId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const drawing = useRef<El | null>(null);
  const dirty = useRef(false);

  const pushUndo = useCallback((els: El[]) => {
    setUndoStack((s) => [...s.slice(-49), els]);
    setRedoStack([]);
  }, []);

  // ---------- rendering ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    // dot grid
    ctx.fillStyle = '#e5e7eb';
    const w = canvas.width / dpr, h = canvas.height / dpr;
    for (let x = 20; x < w; x += 28) for (let y = 20; y < h; y += 28) ctx.fillRect(x, y, 1.5, 1.5);

    const all = drawing.current ? [...elements, drawing.current] : elements;
    for (const el of all) {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (el.type === 'stroke') {
        ctx.lineWidth = el.width;
        ctx.globalAlpha = el.width > 10 ? 0.4 : 1; // highlighter
        ctx.beginPath();
        const pts = el.points;
        if (pts.length < 2) { ctx.arc(pts[0][0], pts[0][1], el.width / 2, 0, Math.PI * 2); ctx.fill(); }
        else {
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
            ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (el.type === 'rect') {
        ctx.lineWidth = el.width;
        ctx.strokeRect(Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.abs(el.x2 - el.x1), Math.abs(el.y2 - el.y1));
      } else if (el.type === 'ellipse') {
        ctx.lineWidth = el.width;
        ctx.beginPath();
        ctx.ellipse((el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2, Math.abs(el.x2 - el.x1) / 2, Math.abs(el.y2 - el.y1) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'line' || el.type === 'arrow') {
        ctx.lineWidth = el.width;
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        if (el.type === 'arrow') {
          const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
          const len = 12 + el.width * 2;
          ctx.beginPath();
          ctx.moveTo(el.x2, el.y2);
          ctx.lineTo(el.x2 - len * Math.cos(ang - 0.45), el.y2 - len * Math.sin(ang - 0.45));
          ctx.moveTo(el.x2, el.y2);
          ctx.lineTo(el.x2 - len * Math.cos(ang + 0.45), el.y2 - len * Math.sin(ang + 0.45));
          ctx.stroke();
        }
      } else if (el.type === 'text') {
        ctx.font = `${el.size}px system-ui, sans-serif`;
        ctx.textBaseline = 'top';
        const lines = el.text.split('\n');
        lines.forEach((ln, i) => ctx.fillText(ln, el.x, el.y + i * el.size * 1.3));
      }
    }
  }, [elements]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      draw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  // ---------- pointer handling ----------
  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top] as [number, number];
  };

  const onDown = (e: React.PointerEvent) => {
    if (stylusOnly && e.pointerType === 'touch') return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const [x, y] = getPos(e);
    if (tool === 'text') {
      const text = prompt('Text:');
      if (text) {
        pushUndo(elements);
        setElements((els) => [...els, { type: 'text', x, y, text, color, size: 10 + width * 3 }]);
        dirty.current = true;
      }
      return;
    }
    if (tool === 'eraser') {
      eraseAt(x, y);
      drawing.current = { type: 'stroke', points: [[x, y]], color: 'transparent', width: 0 };
      return;
    }
    if (tool === 'pen' || tool === 'highlighter') {
      drawing.current = { type: 'stroke', points: [[x, y]], color, width: tool === 'highlighter' ? width * 4 : width * (e.pressure ? 0.5 + e.pressure : 1) };
    } else {
      drawing.current = { type: tool, x1: x, y1: y, x2: x, y2: y, color, width } as El;
    }
    draw();
  };

  const eraseAt = (x: number, y: number) => {
    setElements((els) => {
      const keep = els.filter((el) => {
        if (el.type === 'stroke') return !el.points.some((p) => Math.hypot(p[0] - x, p[1] - y) < 16);
        if (el.type === 'text') return !(x > el.x - 10 && x < el.x + 200 && y > el.y - 10 && y < el.y + 40);
        const minX = Math.min(el.x1, el.x2) - 10, maxX = Math.max(el.x1, el.x2) + 10;
        const minY = Math.min(el.y1, el.y2) - 10, maxY = Math.max(el.y1, el.y2) + 10;
        return !(x > minX && x < maxX && y > minY && y < maxY);
      });
      if (keep.length !== els.length) { dirty.current = true; }
      return keep;
    });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const [x, y] = getPos(e);
    if (tool === 'eraser') { eraseAt(x, y); return; }
    const d = drawing.current;
    if (d.type === 'stroke') {
      const evts = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
      if (evts.length) {
        const rect = canvasRef.current!.getBoundingClientRect();
        for (const ce of evts) d.points.push([ce.clientX - rect.left, ce.clientY - rect.top]);
      } else d.points.push([x, y]);
    } else if ('x2' in d) {
      d.x2 = x; d.y2 = y;
    }
    draw();
  };

  const onUp = () => {
    const d = drawing.current;
    drawing.current = null;
    if (!d || tool === 'eraser') { draw(); return; }
    pushUndo(elements);
    setElements((els) => [...els, d]);
    dirty.current = true;
  };

  const undo = () => {
    setUndoStack((s) => {
      if (!s.length) return s;
      setRedoStack((r) => [...r, elements]);
      setElements(s[s.length - 1]);
      return s.slice(0, -1);
    });
  };
  const redo = () => {
    setRedoStack((r) => {
      if (!r.length) return r;
      setUndoStack((s) => [...s, elements]);
      setElements(r[r.length - 1]);
      return r.slice(0, -1);
    });
  };

  // ---------- boards ----------
  const loadBoards = () => api('/api/boards').then((d) => setBoards(d.boards));
  useEffect(() => { loadBoards(); }, []);

  const saveBoard = async () => {
    setSaving(true);
    try {
      const d = await api('/api/boards', { method: 'POST', body: JSON.stringify({ id: boardId, name: boardName, scene: elements }) });
      setBoardId(d.id);
      dirty.current = false;
      loadBoards();
    } finally { setSaving(false); }
  };

  // autosave every 5s when dirty and board exists
  useEffect(() => {
    const iv = setInterval(() => {
      if (dirty.current && boardId) {
        api('/api/boards', { method: 'POST', body: JSON.stringify({ id: boardId, name: boardName, scene: elements }) })
          .then(() => { dirty.current = false; });
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [boardId, boardName, elements]);

  const openBoard = (b: any) => {
    setBoardId(b.id); setBoardName(b.name);
    setElements(JSON.parse(b.scene || '[]'));
    setUndoStack([]); setRedoStack([]);
    setBoardsOpen(false);
  };

  const newBoard = () => {
    setBoardId(null); setBoardName('Untitled board'); setElements([]); setUndoStack([]); setRedoStack([]);
    setBoardsOpen(false);
  };

  // ---------- send as task ----------
  const sendAsTask = async () => {
    const canvas = canvasRef.current!;
    // white background export
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    const blob: Blob = await new Promise((res) => out.toBlob((b) => res(b!), 'image/png'));
    const fd = new FormData();
    fd.append('file', new File([blob], `${boardName || 'scribble'}.png`, { type: 'image/png' }));
    const r = await fetch('/api/uploads', { method: 'POST', body: fd });
    const d = await r.json();
    setAttachId(d.id);
    setComposerOpen(true);
  };

  const ToolBtn = ({ t, icon, title }: { t: typeof tool; icon: string; title: string }) => (
    <button title={title}
      className={`w-9 h-9 rounded-lg text-base flex items-center justify-center ${tool === t ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
      onClick={() => setTool(t)}>{icon}</button>
  );

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 flex-wrap">
        <Link href="/home" className="text-gray-400 hover:text-brand-600 font-bold px-1">←</Link>
        <input className="input !w-40 !py-1 text-sm font-semibold" value={boardName} onChange={(e) => { setBoardName(e.target.value); dirty.current = true; }} />
        <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={saveBoard} disabled={saving}>{saving ? '…' : boardId ? 'Saved ✓' : 'Save'}</button>
        <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => setBoardsOpen(true)}>Boards</button>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" checked={stylusOnly} onChange={(e) => setStylusOnly(e.target.checked)} /> Stylus only
        </label>
        <button className="btn-primary !py-1.5 !px-3 text-sm" onClick={sendAsTask}>📤 Send as Task</button>
      </div>

      {/* Tools */}
      <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-1.5 flex-wrap">
        <ToolBtn t="pen" icon="✏️" title="Pen" />
        <ToolBtn t="highlighter" icon="🖍" title="Highlighter" />
        <ToolBtn t="eraser" icon="🧽" title="Eraser" />
        <ToolBtn t="line" icon="╱" title="Line" />
        <ToolBtn t="arrow" icon="➚" title="Arrow" />
        <ToolBtn t="rect" icon="▭" title="Rectangle" />
        <ToolBtn t="ellipse" icon="◯" title="Ellipse" />
        <ToolBtn t="text" icon="T" title="Text" />
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {COLORS.map((c) => (
          <button key={c} className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
            style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        {WIDTHS.map((w) => (
          <button key={w} className={`w-8 h-8 rounded-lg flex items-center justify-center ${width === w ? 'bg-gray-200' : 'bg-white'}`} onClick={() => setWidth(w)}>
            <span className="rounded-full bg-gray-800" style={{ width: w + 2, height: w + 2 }} />
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 mx-1" />
        <button className="w-9 h-9 rounded-lg bg-white hover:bg-gray-100" onClick={undo} title="Undo" disabled={!undoStack.length}>↩</button>
        <button className="w-9 h-9 rounded-lg bg-white hover:bg-gray-100" onClick={redo} title="Redo" disabled={!redoStack.length}>↪</button>
        <button className="w-9 h-9 rounded-lg bg-white hover:bg-red-50 text-red-500" title="Clear"
          onClick={() => { if (confirm('Clear the whole board?')) { pushUndo(elements); setElements([]); dirty.current = true; } }}>🗑</button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full touch-none cursor-crosshair"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      {/* Boards modal */}
      <Modal open={boardsOpen} onClose={() => setBoardsOpen(false)} title="My boards">
        <button className="btn-primary w-full mb-3" onClick={newBoard}>+ New blank board</button>
        <div className="space-y-2">
          {boards.map((b) => (
            <div key={b.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
              <button className="text-sm font-medium text-left flex-1 hover:text-brand-600" onClick={() => openBoard(b)}>{b.name}</button>
              <button className="text-xs text-red-400 hover:text-red-600 px-2"
                onClick={() => api(`/api/boards?id=${b.id}`, { method: 'DELETE' }).then(loadBoards)}>Delete</button>
            </div>
          ))}
          {boards.length === 0 && <div className="text-sm text-gray-400 text-center py-4">No saved boards yet.</div>}
        </div>
      </Modal>

      {/* Send-as-task composer with the PNG pre-attached */}
      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        presetAttachmentIds={attachId ? [attachId] : []}
        presetBoardId={boardId}
        presetTitle={boardName !== 'Untitled board' ? boardName : ''}
      />
    </div>
  );
}
