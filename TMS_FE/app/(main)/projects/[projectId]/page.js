"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { PersonalScribbleButton } from "@/components/personal-scribble-dialog";
import { ProjectPageSkeleton } from "@/components/project-page-skeleton";
import { ProjectTasksBoard } from "@/components/project-tasks-board";

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
  const { token } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

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

    async function loadProjectData() {
      setLoading(true);
      setError("");

      try {
        const [projectData, tasksData, statusesData, taskTypesData, teamsData] =
          await Promise.all([
            apiGet(`/projects/${params.projectId}`, { token }),
            apiGet(
              `/projects/${params.projectId}/tasks?limit=200&order=asc`,
              { token },
            ),
            apiGet("/task-statuses", { token }),
            apiGet("/task-types", { token }),
            apiGet("/teams", { token }),
          ]);

        if (cancelled) return;

        setProject(projectData.project);
        setTasks(tasksData.tasks || []);
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

    loadProjectData();

    return () => {
      cancelled = true;
    };
  }, [token, params.projectId]);

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

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!project) {
    return <p className="text-sm text-muted-foreground">Project not found.</p>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h2>
            {project.description ? (
              <p className="text-muted-foreground">{project.description}</p>
            ) : (
              <p className="text-muted-foreground">
                No description for this project.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PersonalScribbleButton token={token} />
            <Button onClick={() => setCreateOpen(true)}>Add task</Button>
          </div>
        </div>

        <div className="space-y-3">
          {statuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No task statuses configured yet.
            </p>
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
