"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Package,
  Scale,
  Users,
  Zap,
  Activity,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 min-w-[140px] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function MetricCard({ label, value, tone = "default", icon: Icon, progress }) {
  const toneClasses = {
    default: "text-foreground",
    danger: "text-red-600",
    warning: "text-amber-600",
    success: "text-emerald-600",
    info: "text-blue-600",
  };

  return (
    <Card className="relative overflow-hidden shadow-none">
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-lg bg-muted/60 p-2 text-muted-foreground">
            <Icon className="size-4" />
          </div>
        </div>
        <div>
          <div className={cn("text-3xl font-semibold tracking-tight", toneClasses[tone])}>
            {value}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        {progress != null ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DeliveredCell({ delivered }) {
  const completed = Number(delivered?.completed ?? 0);
  const target = Number(delivered?.target ?? 0);
  const unit = delivered?.unit || "Item";
  const pct = target > 0 ? Math.round((completed / target) * 100) : 0;
  const complete = target > 0 && completed >= target;

  return (
    <div className="min-w-[140px] space-y-1.5">
      <div className={cn("text-sm font-medium", complete && "text-emerald-600")}>
        {completed}/{target} {unit}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            complete ? "bg-emerald-500" : "bg-violet-500",
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell == null ? "" : String(cell);
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DashboardReports() {
  const { token } = useAuth();
  const [teams, setTeams] = useState([]);
  const [reports, setReports] = useState(null);
  const [teamId, setTeamId] = useState("");
  const [period, setPeriod] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    if (!token) {
      setReports(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ period });
      if (teamId) params.set("team_id", teamId);

      const data = await apiGet(`/dashboard/reports?${params.toString()}`, {
        token,
      });
      setReports(data.reports);
    } catch (err) {
      setError(err.message || "Failed to load dashboard reports.");
      setReports(null);
    } finally {
      setLoading(false);
    }
  }, [token, teamId, period]);

  useEffect(() => {
    if (!token) return;

    apiGet("/teams", { token })
      .then((data) => setTeams(data.teams || []))
      .catch(() => setTeams([]));
  }, [token]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const summary = reports?.summary;
  const byTaskType = reports?.by_task_type ?? [];
  const byPerson = reports?.by_person ?? [];

  const metricCards = useMemo(
    () => [
      {
        label: "Open tasks",
        value: summary?.open_tasks ?? 0,
        tone: "default",
        icon: Package,
      },
      {
        label: "Overdue",
        value: summary?.overdue ?? 0,
        tone: "danger",
        icon: Clock3,
      },
      {
        label: "Need response",
        value: summary?.no_response ?? 0,
        tone: "danger",
        icon: BellOff,
      },
      {
        label: "Awaiting explanation",
        value: summary?.awaiting_explanation ?? 0,
        tone: "warning",
        icon: AlertTriangle,
      },
      {
        label: "Pending review",
        value: summary?.pending_review ?? 0,
        tone: "warning",
        icon: Scale,
      },
      {
        label: "Due this week",
        value: summary?.due_this_week ?? 0,
        tone: "info",
        icon: CalendarDays,
      },
      {
        label: "Done",
        value: summary?.done ?? 0,
        tone: "success",
        icon: CheckCircle2,
      },
      {
        label: "On-time completion",
        value:
          summary?.on_time_completion_pct != null
            ? `${summary.on_time_completion_pct}%`
            : "—",
        tone: "success",
        icon: Activity,
        progress: summary?.on_time_completion_pct ?? 0,
      },
      {
        label: "Avg response time",
        value: summary?.avg_response_time ?? "—",
        tone: "default",
        icon: Zap,
      },
    ],
    [summary],
  );

  function handleExportCsv() {
    if (!reports) return;

    const rows = [
      ["Metric", "Value"],
      ["Open tasks", summary?.open_tasks ?? 0],
      ["Overdue", summary?.overdue ?? 0],
      ["Need response", summary?.no_response ?? 0],
      ["Awaiting explanation", summary?.awaiting_explanation ?? 0],
      ["Pending review", summary?.pending_review ?? 0],
      ["Due this week", summary?.due_this_week ?? 0],
      ["Done", summary?.done ?? 0],
      ["On-time completion", summary?.on_time_completion_pct ?? "—"],
      ["Avg response time", summary?.avg_response_time ?? "—"],
      [],
      ["Team", "Task Type", "Total", "Open", "Overdue", "Need Resp.", "Done", "Delivered"],
      ...byTaskType.map((row) => [
        row.team_name,
        row.task_type_name,
        row.total,
        row.open,
        row.overdue,
        row.no_response,
        row.done,
        `${row.delivered.completed}/${row.delivered.target} ${row.delivered.unit}`,
      ]),
      [],
      [
        "Person",
        "Department",
        "Open",
        "Overdue",
        "Need Resp.",
        "Escal.",
        "Done",
        "On Time",
        "Avg Resp.",
      ],
      ...byPerson.map((row) => [
        row.full_name,
        row.department,
        row.open,
        row.overdue,
        row.no_response,
        row.escalated,
        row.done,
        row.on_time_pct != null ? `${row.on_time_pct}%` : "—",
        row.avg_response_time ?? "—",
      ]),
    ];

    downloadCsv("dashboard-reports.csv", rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Entire organization
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">Reports</h2>
          {summary?.need_attention ? (
            <p className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700">
              <AlertTriangle className="size-4" />
              {summary.need_attention} need attention
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            className={selectClassName}
          >
            <option value="">All teams</option>
            {teams.map((team) => (
              <option key={team.team_id} value={team.team_id}>
                {team.name}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className={selectClassName}
          >
            <option value="all">All time</option>
            <option value="this_week">Due this week</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>

          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={!reports}
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <Card className="shadow-none">
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By task type
          </CardTitle>
          <CardDescription>
            Task volume and delivery progress grouped by team and type.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pt-0">
          {loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading reports...</p>
          ) : byTaskType.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No task type data yet.
            </p>
          ) : (
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-4 py-3 font-medium">Task type</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Open</th>
                  <th className="px-4 py-3 font-medium text-red-600">Overdue</th>
                  <th className="px-4 py-3 font-medium">Need resp.</th>
                  <th className="px-4 py-3 font-medium">Done</th>
                  <th className="px-4 py-3 font-medium">Delivered</th>
                </tr>
              </thead>
              <tbody>
                {byTaskType.map((row) => (
                  <tr key={`${row.team_id}-${row.task_type_id}`} className="border-b last:border-b-0">
                    <td className="px-4 py-4 align-top font-medium">{row.team_name}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-medium">{row.task_type_name}</div>
                      <div className="text-xs text-muted-foreground">
                        counted in {row.alias}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">{row.total}</td>
                    <td className="px-4 py-4 align-top">{row.open}</td>
                    <td className={cn("px-4 py-4 align-top", row.overdue > 0 && "text-red-600")}>
                      {row.overdue}
                    </td>
                    <td className={cn("px-4 py-4 align-top", row.no_response > 0 && "text-red-600")}>
                      {row.no_response}
                    </td>
                    <td className={cn("px-4 py-4 align-top", row.done > 0 && "text-emerald-600")}>
                      {row.done}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <DeliveredCell delivered={row.delivered} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              By person
            </CardTitle>
          </div>
          <CardDescription>
            Workload and performance metrics per assignee.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 pt-0">
          {loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading reports...</p>
          ) : byPerson.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No assignee data yet.
            </p>
          ) : (
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">Open</th>
                  <th className="px-4 py-3 font-medium text-red-600">Overdue</th>
                  <th className="px-4 py-3 font-medium">Need resp.</th>
                  <th className="px-4 py-3 font-medium">Escal.</th>
                  <th className="px-4 py-3 font-medium">Done</th>
                  <th className="px-4 py-3 font-medium">On time</th>
                  <th className="px-4 py-3 font-medium">Avg resp.</th>
                </tr>
              </thead>
              <tbody>
                {byPerson.map((row) => (
                  <tr key={row.user_id} className="border-b last:border-b-0">
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback>{row.initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{row.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.department}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">{row.open}</td>
                    <td className={cn("px-4 py-4 align-top", row.overdue > 0 && "text-red-600")}>
                      {row.overdue}
                    </td>
                    <td className={cn("px-4 py-4 align-top", row.no_response > 0 && "text-red-600")}>
                      {row.no_response}
                    </td>
                    <td className={cn("px-4 py-4 align-top", row.escalated > 0 && "text-amber-600")}>
                      {row.escalated}
                    </td>
                    <td className="px-4 py-4 align-top">{row.done}</td>
                    <td className="px-4 py-4 align-top">
                      {row.on_time_pct != null ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          {row.on_time_pct}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {row.avg_response_time ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
