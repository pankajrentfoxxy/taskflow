"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { canViewAllProjectTasks } from "@/lib/user-roles";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { PersonalScribbleButton } from "@/components/personal-scribble-dialog";
import { ProjectPageSkeleton } from "@/components/project-page-skeleton";
import { ProjectTasksBoard } from "@/components/project-tasks-board";
import { cn } from "@/lib/utils";

const TASK_SCOPE_OPTIONS = [
  { value: "all", label: "All", adminOnly: true },
  { value: "assigned", label: "My tasks" },
  { value: "created", label: "Created by me" },
];

function groupTasksByStatus(statuses, tasks) {
  const groups = statuses.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.task_status_id === status.task_status_id),
  }));

  const knownStatusIds = new Set(
    statuses.map((status) => status.task_status_id),
  );
  const unassignedTasks = tasks.filter(
    (task) => !knownStatusIds.has(task.task_status_id),
  );

  if (unassignedTasks.length > 0) {
    groups.push({
      status: {
        task_status_id: "unknown",
        name: "Unknown Status",
      },
      tasks: unassignedTasks,
    });
  }

  return groups;
}

export default function ProjectPage() {
  const params = useParams();
  const { token, user } = useAuth();
  const canViewAll = canViewAllProjectTasks(user?.role?.slug);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [taskScope, setTaskScope] = useState(canViewAll ? "all" : "assigned");

  const scopeOptions = useMemo(
    () =>
      TASK_SCOPE_OPTIONS.filter((option) => !option.adminOnly || canViewAll),
    [canViewAll],
  );

  useEffect(() => {
    setTaskScope(canViewAll ? "all" : "assigned");
  }, [canViewAll, params.projectId]);

  function handleTaskCreated(task) {
    setTasks((prev) => [...prev, task]);
  }

  function handleTaskUpdated(task) {
    setTasks((prev) =>
      prev.map((item) => (item.task_id === task.task_id ? task : item)),
    );
  }

  function handleTaskDeleted(taskId) {
    setTasks((prev) => prev.filter((item) => item.task_id !== taskId));
  }

  useEffect(() => {
    if (!token || !params.projectId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProjectMeta() {
      setLoading(true);
      setError("");

      try {
        const [projectData, statusesData, taskTypesData, teamsData] =
          await Promise.all([
            apiGet(`/projects/${params.projectId}`, { token }),
            apiGet("/task-statuses", { token }),
            apiGet("/task-types", { token }),
            apiGet("/teams", { token }),
          ]);

        if (cancelled) return;

        setProject(projectData.project);
        setStatuses(statusesData.taskStatuses || []);
        setTaskTypes(taskTypesData.taskTypes || []);
        setTeams(teamsData.teams || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load project");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProjectMeta();

    return () => {
      cancelled = true;
    };
  }, [token, params.projectId]);

  useEffect(() => {
    if (!token || !params.projectId || loading) {
      return;
    }

    let cancelled = false;

    async function loadTasks() {
      setTasksLoading(true);
      setError("");

      try {
        const tasksData = await apiGet(
          `/projects/${params.projectId}/tasks?limit=200&order=asc&scope=${taskScope}`,
          { token },
        );

        if (cancelled) return;
        setTasks(tasksData.tasks || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load tasks");
          setTasks([]);
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, [token, params.projectId, taskScope, loading]);

  const tasksByStatus = useMemo(
    () => groupTasksByStatus(statuses, tasks),
    [statuses, tasks],
  );

  const projectMembers = useMemo(() => {
    if (!project?.members?.length) return [];

    const seen = new Set();
    return project.members.filter((member) => {
      if (seen.has(member.user_id)) return false;
      seen.add(member.user_id);
      return true;
    });
  }, [project]);

  if (loading) {
    return <ProjectPageSkeleton />;
  }

  if (error && !project) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-2">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {project.name}
            </h2>
            {project.description ? (
              <p className="text-sm text-muted-foreground sm:text-base">
                {project.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground sm:text-base">
                No description for this project.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PersonalScribbleButton token={token} />
            <Button className="flex-1 sm:flex-none" onClick={() => setCreateOpen(true)}>
              Add task
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scopeOptions.map((option) => {
            const isActive = taskScope === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTaskScope(option.value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
          {tasksLoading ? (
            <span className="text-sm text-muted-foreground">Updating...</span>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-3">
          {statuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No task statuses configured yet.
            </p>
          ) : tasksLoading && tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          ) : (
            <ProjectTasksBoard
              columns={tasksByStatus}
              projectId={params.projectId}
              projectName={project.name}
              token={token}
              statuses={statuses}
              taskTypes={taskTypes}
              members={projectMembers}
              teams={teams}
              onTaskCreated={handleTaskCreated}
              onTaskUpdated={handleTaskUpdated}
              onTaskDeleted={handleTaskDeleted}
            />
          )}
        </div>
      </div>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={params.projectId}
        projectName={project.name}
        statuses={statuses}
        taskTypes={taskTypes}
        members={projectMembers}
        teams={teams}
        onCreated={handleTaskCreated}
      />
    </>
  );
}
