'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/util';

type Me = {
  id: number; name: string; email: string; role: string; team_id: number | null; team: string | null;
};
const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext);

const tabs = [
  { href: '/home', label: 'Home', icon: '🏠' },
  { href: '/tasks', label: 'Tasks', icon: '✓' },
  { href: '/scribble', label: 'Scribble', icon: '✏️' },
  { href: '/projects', label: 'Projects', icon: '📁' },
  { href: '/reports', label: 'Reports', icon: '📊' },
];

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

  const visibleTabs = tabs.filter((t) => t.href !== '/reports' || (me && me.role !== 'MEMBER'));

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen pb-20">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200">
          <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
            <Link href="/home" className="flex items-center gap-2 font-bold text-brand-700">
              <img src="/icon.svg" alt="" className="w-7 h-7 rounded-lg" /> TaskFlow
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-gray-100" aria-label="Notifications">
                <span className="text-xl">🔔</span>
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
              {me && (
                <div className="flex items-center gap-2">
                  {me.role === 'ADMIN' && (
                    <Link href="/admin" className="text-xs font-semibold text-gray-500 hover:text-brand-600 hidden sm:block">Admin</Link>
                  )}
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-semibold leading-tight">{me.name}</div>
                    <div className="text-[11px] text-gray-500 leading-tight">{me.role}{me.team ? ` · ${me.team}` : ''}</div>
                  </div>
                  <button onClick={logout} className="text-xs text-gray-400 hover:text-red-600 p-1" title="Log out">⏻</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-4">{children}</main>

        <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-4xl mx-auto grid grid-cols-5">
            {visibleTabs.map((t) => {
              const active = pathname.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? 'text-brand-600' : 'text-gray-400'}`}>
                  <span className="text-lg leading-none">{t.icon}</span>
                  {t.label}
                </Link>
              );
            })}
            {visibleTabs.length < 5 && <div />}
          </div>
        </nav>
      </div>
    </MeContext.Provider>
  );
}
