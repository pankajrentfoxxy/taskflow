'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/util';
import {
  IconHome, IconTasks, IconPen, IconFolder, IconChart, IconBell, IconLogout,
} from './Icons';

type Me = {
  id: number; name: string; email: string; role: string; team_id: number | null; team: string | null;
};
const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext);

const NAV = [
  { href: '/home', label: 'Home', Icon: IconHome },
  { href: '/tasks', label: 'My Tasks', Icon: IconTasks },
  { href: '/scribble', label: 'Scribble', Icon: IconPen },
  { href: '/projects', label: 'Projects', Icon: IconFolder },
  { href: '/reports', label: 'Reports', Icon: IconChart, managerial: true },
];

function initialsOf(name?: string) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const load = () =>
      api('/api/me')
        .then((d) => { if (alive) { setMe(d.user); setUnread(d.unread); } })
        .catch(() => router.push('/login'));
    load();
    const iv = setInterval(load, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, [router]);

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const nav = NAV.filter((n) => !n.managerial || (me && me.role !== 'MEMBER'));
  const canManage = me && ['ADMIN', 'CEO', 'MANAGER'].includes(me.role);

  const Badge = () => unread > 0 ? (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ring-2 ring-white">
      {unread > 99 ? '99+' : unread}
    </span>
  ) : null;

  return (
    <MeContext.Provider value={me}>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-gray-200/70 z-40">
        <Link href="/home" className="flex items-center gap-2.5 px-5 h-16 shrink-0">
          <img src="/icon.svg" alt="" className="w-8 h-8 rounded-[10px] shadow-sm" />
          <span className="font-bold text-[15px] tracking-tight">TaskFlow</span>
        </Link>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition
                  ${active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium'}`}>
                <Icon className={`w-[18px] h-[18px] ${active ? 'text-brand-600' : 'text-gray-400'}`} />
                {label}
              </Link>
            );
          })}
          <Link href="/notifications"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition
              ${pathname.startsWith('/notifications') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium'}`}>
            <span className="relative">
              <IconBell className={`w-[18px] h-[18px] ${pathname.startsWith('/notifications') ? 'text-brand-600' : 'text-gray-400'}`} />
              <Badge />
            </span>
            Notifications
          </Link>
          {canManage && (
            <Link href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] transition
                ${pathname.startsWith('/admin') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium'}`}>
              <span className="w-[18px] h-[18px] flex items-center justify-center text-gray-400 text-sm">⚙︎</span>
              {me?.role === 'ADMIN' ? 'Admin' : 'Manage'}
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {initialsOf(me?.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate leading-tight">{me?.name?.split(' (')[0] || '…'}</div>
              <div className="text-[11px] text-gray-400 truncate leading-tight">{me?.role}{me?.team ? ` · ${me.team}` : ''}</div>
            </div>
            <button onClick={logout} className="text-gray-300 hover:text-red-500 transition p-1" title="Log out">
              <IconLogout className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-gray-200/70">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/home" className="flex items-center gap-2 font-bold tracking-tight">
            <img src="/icon.svg" alt="" className="w-7 h-7 rounded-lg" /> TaskFlow
          </Link>
          <div className="flex items-center gap-1">
            {canManage && (
              <Link href="/admin" className="text-[11px] font-semibold text-gray-400 px-2">{me?.role === 'ADMIN' ? 'Admin' : 'Manage'}</Link>
            )}
            <Link href="/notifications" className="relative p-2 text-gray-500" aria-label="Notifications">
              <IconBell className="w-5 h-5" />
              <Badge />
            </Link>
            <button onClick={logout} title="Log out"
              className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-white text-[10px] font-bold flex items-center justify-center ml-1">
              {initialsOf(me?.name)}
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────── */}
      <main className="md:pl-60 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-5 md:py-8 pb-24 md:pb-12">{children}</div>
      </main>

      {/* ── Mobile bottom nav ───────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-lg border-t border-gray-200/70 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => !n.managerial || (me && me.role !== 'MEMBER')).map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${active ? 'text-brand-600' : 'text-gray-400'}`}>
                <Icon className="w-5 h-5" />
                {label.replace('My ', '')}
              </Link>
            );
          })}
          {(!me || me.role === 'MEMBER') && <div />}
        </div>
      </nav>
    </MeContext.Provider>
  );
}
