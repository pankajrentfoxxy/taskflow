"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  LayoutDashboard,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { canAccessAdmin } from "@/lib/user-roles";
import { SidebarSpacesGroup } from "@/components/sidebar-spaces-group";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Admin", href: "/admin", icon: Shield, adminOnly: true },
];

function SidebarNavGroup({ label, items, pathname }) {
  return (
    <SidebarGroup className="py-3">
      <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent className="px-2">
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActive}
                  tooltip={item.title}
                  className="h-9 gap-3 px-3"
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleNavItems = useMemo(() => {
    const canSeeAdmin = canAccessAdmin(user?.role?.slug);
    return navItems.filter((item) => !item.adminOnly || canSeeAdmin);
  }, [user]);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <LayoutDashboard className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">TMS</span>
                <span className="truncate text-xs text-muted-foreground">
                  Task Management
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        <SidebarNavGroup
          label="Navigation"
          items={visibleNavItems}
          pathname={pathname}
        />
        <SidebarSpacesGroup />
      </SidebarContent>

      <SidebarSeparator />
      <SidebarRail />
    </Sidebar>
  );
}
