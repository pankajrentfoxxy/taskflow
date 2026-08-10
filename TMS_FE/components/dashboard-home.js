"use client";

import { useAuth } from "@/hooks/use-auth";
import { DashboardReports } from "@/components/dashboard-reports";
import { DashboardPersonal } from "@/components/dashboard-personal";
import { canViewOrgDashboard } from "@/lib/user-roles";

export function DashboardHome() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading dashboard...</p>
    );
  }

  if (canViewOrgDashboard(user?.role?.slug)) {
    return <DashboardReports />;
  }

  return <DashboardPersonal />;
}
