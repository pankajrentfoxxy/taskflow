"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock3,
  Flag,
  Plus,
  Tag,
  Zap,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { PersonalScribbleDialog } from "@/components/personal-scribble-dialog";
import { PriorityDisplay } from "@/lib/task-priorities";
import { cn } from "@/lib/utils";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getFirstName(fullName) {
  return String(fullName || "there").trim().split(/\s+/)[0];
}

function formatTodayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getStatusBadgeClass(statusName) {
  const normalized = String(statusName || "").toLowerCase();

  if (/escalat|explanation|awaiting/.test(normalized)) {
    return "bg-red-100 text-red-700";
  }
  if (/progress/.test(normalized)) {
    return "bg-sky-100 text-sky-700";
  }
  if (/need response|awaiting response/.test(normalized)) {
    return "bg-rose-100 text-rose-700";
  }

  return "bg-muted text-muted-foreground";
}

function SummaryCard({ label, value, icon: Icon, tone = "default", active }) {
  const toneClasses = {
    default: "text-foreground",
    danger: "text-red-600",
    warning: "text-amber-600",
    info: "text-blue-600",
  };

  return (
    <Card
      className={cn(
        "shadow-none transition-colors",
        active && "ring-2 ring-red-300",
      )}
    >
      <CardContent className="flex items-center gap-4 pt-4">
        <div className="rounded-xl bg-muted/70 p-3 text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <div>
          <div className={cn("text-3xl font-semibold", toneClasses[tone])}>
            {value}
          </div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task }) {
  const deliveryUnit = task.type?.alias || task.type?.name || "Item";
  const hasDelivery = task.target != null && Number(task.target) > 0;
  const deliveryPct = hasDelivery
    ? Math.round(
        (Number(task.target_completed || 0) / Number(task.target)) * 100,
      )
    : 0;

  const assigneeLabel = task.assignees?.length
    ? task.assignees.map((assignee) => assignee.full_name).join(", ")
    : "Unassigned";

  return (
    <Link href={`/projects/${task.project_id}`}>
      <Card className="shadow-none transition-colors hover:bg-muted/20">
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {task.status?.name ? (
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                  getStatusBadgeClass(task.status.name),
                )}
              >
                {task.status.name}
              </span>
            ) : null}
            {task.type?.name ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Tag className="size-3" />
                {task.type.name}
              </span>
            ) : null}
            {task.priority && task.priority !== "medium" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                <Flag className="size-3" />
                <PriorityDisplay priority={task.priority} />
              </span>
            ) : null}
          </div>

          <div>
            <h3 className="text-lg font-semibold tracking-tight">{task.name}</h3>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {(task.assignees || []).slice(0, 3).map((assignee) => (
                  <Avatar key={assignee.user_id} size="sm" className="ring-2 ring-background">
                    <AvatarFallback>{assignee.initials}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="truncate">
                {assigneeLabel}
                {task.creator?.full_name ? ` · by ${task.creator.full_name}` : ""}
                {task.project_name ? (
                  <>
                    {" · "}
                    <span className="text-violet-600">{task.project_name}</span>
                  </>
                ) : null}
              </span>
            </div>

            {task.due_label ? (
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-sm",
                  task.is_overdue ? "text-red-600" : "text-muted-foreground",
                )}
              >
                <Clock3 className="size-4" />
                {task.due_label}
              </div>
            ) : null}
          </div>

          {hasDelivery ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Delivery</span>
                <span className="text-muted-foreground">
                  {task.target_completed ?? 0}/{task.target} {deliveryUnit}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${Math.min(100, deliveryPct)}%` }}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

function DashboardSection({ section }) {
  const icon =
    section.id === "escalated" ? (
      <AlertTriangle className="size-4 text-red-600" />
    ) : section.id === "due_today" ? (
      <CalendarDays className="size-4 text-amber-600" />
    ) : section.id === "in_progress" ? (
      <Activity className="size-4 text-blue-600" />
    ) : (
      <Zap className="size-4 text-red-600" />
    );

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        <span>
          {section.label} {section.count}
        </span>
      </div>
      <div className="space-y-3">
        {section.tasks.map((task) => (
          <TaskCard key={task.task_id} task={task} />
        ))}
      </div>
    </section>
  );
}

export function DashboardPersonal() {
  const { token, user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [projects, setProjects] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scribbleOpen, setScribbleOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      setDashboard(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiGet("/dashboard/me", { token });
      setDashboard(data.dashboard);
    } catch (err) {
      setError(err.message || "Failed to load your dashboard.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!token) return;

    async function loadCreateContext() {
      try {
        const [projectsData, statusesData, taskTypesData, teamsData] =
          await Promise.all([
            apiGet("/projects", { token }),
            apiGet("/task-statuses", { token }),
            apiGet("/task-types", { token }),
            apiGet("/teams", { token }),
          ]);

        const loadedProjects = projectsData.projects || [];
        setProjects(loadedProjects);
        setStatuses(statusesData.taskStatuses || []);
        setTaskTypes(taskTypesData.taskTypes || []);
        setTeams(teamsData.teams || []);

        if (loadedProjects.length > 0) {
          setSelectedProjectId(String(loadedProjects[0].project_id));
        }
      } catch {
        setProjects([]);
      }
    }

    loadCreateContext();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedProjectId) {
      setSelectedProject(null);
      return;
    }

    apiGet(`/projects/${selectedProjectId}`, { token })
      .then((data) => setSelectedProject(data.project))
      .catch(() => setSelectedProject(null));
  }, [token, selectedProjectId]);

  const summary = dashboard?.summary;
  const sections = dashboard?.sections ?? [];

  const summaryCards = useMemo(
    () => [
      {
        key: "need_response",
        label: "Need response",
        value: summary?.need_response ?? 0,
        icon: Zap,
        tone: "danger",
      },
      {
        key: "escalated",
        label: "Escalated",
        value: summary?.escalated ?? 0,
        icon: AlertTriangle,
        tone: "warning",
        active: (summary?.escalated ?? 0) > 0,
      },
      {
        key: "in_progress",
        label: "In progress",
        value: summary?.in_progress ?? 0,
        icon: Activity,
        tone: "info",
      },
      {
        key: "due_today",
        label: "Due today",
        value: summary?.due_today ?? 0,
        icon: CalendarDays,
        tone: "info",
      },
    ],
    [summary],
  );

  const projectMembers = useMemo(() => {
    if (!selectedProject?.members?.length) return [];

    const seen = new Set();
    return selectedProject.members.filter((member) => {
      if (seen.has(member.user_id)) return false;
      seen.add(member.user_id);
      return true;
    });
  }, [selectedProject]);

  const defaultStatusId = statuses[0]?.task_status_id
    ? String(statuses[0].task_status_id)
    : "";

  function handleTaskCreated() {
    loadDashboard();
    setCreateOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {formatTodayLabel()}
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">
            {getGreeting()}, {getFirstName(user?.full_name)}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setScribbleOpen(true)}
            disabled={!token}
          >
            Scribble
          </Button>
          <Button
            type="button"
            className="bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => setCreateOpen(true)}
            disabled={!token || projects.length === 0}
          >
            <Plus className="size-4" />
            New task
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.key} {...card} />
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your tasks...</p>
      ) : sections.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No assigned tasks right now. Create a task or wait for new assignments.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <DashboardSection key={section.id} section={section} />
          ))}
        </div>
      )}

      <PersonalScribbleDialog
        token={token}
        open={scribbleOpen}
        onOpenChange={setScribbleOpen}
      />

      {selectedProject ? (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={selectedProjectId}
          projectName={selectedProject.name}
          statuses={statuses}
          taskTypes={taskTypes}
          members={projectMembers}
          teams={teams}
          defaultStatusId={defaultStatusId}
          onCreated={handleTaskCreated}
        />
      ) : null}

      {projects.length > 1 && createOpen ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border bg-background p-3 shadow-lg">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Create task in project
          </label>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="flex h-9 min-w-[220px] rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
