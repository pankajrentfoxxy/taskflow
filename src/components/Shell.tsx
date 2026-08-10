'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ListTodo,
  PenLine,
  Folder,
  BarChart3,
  Bell,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
} from 'lucide-react';
import { api } from '@/lib/util';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

type Me = {
  id: number; name: string; email: string; role: string; team_id: number | null; team: string | null;
};

const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext);

const NAV = [
  { href: '/home', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', Icon: ListTodo },
  { href: '/projects', label: 'Projects', Icon: Folder },
  { href: '/scribble', label: 'Scribble', Icon: PenLine },
  { href: '/reports', label: 'Reports', Icon: BarChart3, managerial: true },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Super Admin',
  CEO: 'CEO',
  MANAGER: 'Manager',
  MEMBER: 'Member',
};

function SidebarNav({
  pathname,
  nav,
  collapsed,
  unread,
  canManage,
  adminLabel,
  onNavigate,
}: {
  pathname: string;
  nav: typeof NAV;
  collapsed: boolean;
  unread: number;
  canManage: boolean;
  adminLabel: string;
  onNavigate?: () => void;
}) {
  const linkClass = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
      active
        ? 'bg-muted font-semibold text-foreground'
        : 'font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      collapsed && 'justify-center px-2'
    );

  return (
    <div>
      {!collapsed && (
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Navigation
        </div>
      )}
      <nav className="space-y-0.5">
        {nav.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={onNavigate} className={linkClass(active)} title={collapsed ? label : undefined}>
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
        <Link
          href="/notifications"
          onClick={onNavigate}
          className={linkClass(pathname.startsWith('/notifications'))}
          title={collapsed ? 'Notifications' : undefined}
        >
          <span className="relative shrink-0">
            <Bell className="size-[18px]" />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          {!collapsed && 'Notifications'}
        </Link>
        {canManage && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className={linkClass(pathname.startsWith('/admin'))}
            title={collapsed ? adminLabel : undefined}
          >
            <Settings2 className="size-[18px] shrink-0" />
            {!collapsed && adminLabel}
          </Link>
        )}
      </nav>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('tf-sidebar-collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

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

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('tf-sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const nav = NAV.filter((n) => !n.managerial || (me && me.role !== 'MEMBER'));
  const canManage = me && ['ADMIN', 'CEO', 'MANAGER'].includes(me.role);
  const adminLabel = me?.role === 'ADMIN' ? 'Admin' : 'Manage';
  const roleLabel = ROLE_LABEL[me?.role || ''] || me?.role || '';

  return (
    <MeContext.Provider value={me}>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex',
            collapsed ? 'w-[68px]' : 'w-[260px]'
          )}
        >
          <div className={cn('flex h-16 shrink-0 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <span className="text-xs font-black">TF</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-bold tracking-tight">TaskFlow</div>
                <div className="truncate text-[11px] text-muted-foreground">Task Management</div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-4">
            <SidebarNav
              pathname={pathname}
              nav={nav}
              collapsed={collapsed}
              unread={unread}
              canManage={!!canManage}
              adminLabel={adminLabel}
            />
          </div>

          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
              {!collapsed && 'Collapse'}
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'md:pl-[68px]' : 'md:pl-[260px]')}>
          {/* Top header */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button
              variant="outline"
              size="icon-sm"
              className="shrink-0 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden shrink-0 md:inline-flex"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>

            <div className="min-w-0 flex-1 text-center md:text-left">
              <span className="text-sm font-medium text-foreground">Task Management System</span>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="icon-sm" className="relative" asChild>
                <Link href="/notifications" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-foreground" />
                  )}
                </Link>
              </Button>
              <span className="hidden text-sm font-medium sm:inline">{roleLabel}</span>
              <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="border-b px-4 py-4 text-left">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
                  <span className="text-xs font-black">TF</span>
                </div>
                <div>
                  <SheetTitle className="text-sm">TaskFlow</SheetTitle>
                  <p className="text-[11px] text-muted-foreground">Task Management</p>
                </div>
              </div>
            </SheetHeader>
            <div className="px-2 py-4">
              <SidebarNav
                pathname={pathname}
                nav={nav}
                collapsed={false}
                unread={unread}
                canManage={!!canManage}
                adminLabel={adminLabel}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
            <Separator />
            <div className="p-4">
              <div className="mb-3 text-sm font-medium">{me?.name?.split(' (')[0]}</div>
              <Badge variant="outline" className="mb-3">{roleLabel}</Badge>
              <Button variant="outline" className="w-full gap-2" onClick={logout}>
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </MeContext.Provider>
  );
}
