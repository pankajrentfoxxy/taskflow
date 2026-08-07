"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, MoreHorizontal, Plus } from "lucide-react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ProjectManageDialogs } from "@/components/project-manage-dialogs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function SidebarSpacesGroup() {
  const pathname = usePathname();
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageProject, setManageProject] = useState(null);
  const [manageAction, setManageAction] = useState(null);

  function loadProjects() {
    if (!token) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    apiGet("/projects", { token })
      .then((data) => setProjects(data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProjects();
  }, [token]);

  function openProjectAction(project, action) {
    setManageProject(project);
    setManageAction(action);
  }

  function closeProjectAction() {
    setManageProject(null);
    setManageAction(null);
  }

  function handleRenamed(project) {
    setProjects((current) =>
      current.map((item) =>
        item.project_id === project.project_id ? project : item,
      ),
    );
  }

  function handleDeleted(project) {
    setProjects((current) =>
      current.filter((item) => item.project_id !== project.project_id),
    );
  }

  return (
    <>
      <SidebarGroup className="py-3">
        <div className="flex h-8 items-center justify-between px-3">
          <SidebarGroupLabel className="h-auto p-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Spaces
          </SidebarGroupLabel>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!token}
            title="Create space"
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="size-3.5" />
            <span className="sr-only">Create space</span>
          </button>
        </div>
        <SidebarGroupContent className="px-2">
          {loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading...</p>
          ) : projects.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No projects yet
            </p>
          ) : (
            <SidebarMenu className="gap-1">
              {projects.map((project) => {
                const href = `/projects/${project.project_id}`;
                const isActive = pathname.startsWith(href);

                return (
                  <SidebarMenuItem
                    key={project.project_id}
                    className="group/project"
                  >
                    <div className="flex items-center gap-0.5">
                      <SidebarMenuButton
                        render={<Link href={href} />}
                        isActive={isActive}
                        tooltip={project.name}
                        className="h-9 min-w-0 flex-1 gap-3 px-3"
                      >
                        <Folder className="size-4 shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </SidebarMenuButton>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                              className={cn(
                                "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                "opacity-0 group-hover/project:opacity-100 focus-visible:opacity-100 data-open:opacity-100",
                              )}
                              aria-label={`Project actions for ${project.name}`}
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="bottom">
                          <DropdownMenuItem
                            onClick={() => openProjectAction(project, "rename")}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              openProjectAction(project, "add-members")
                            }
                          >
                            Add members
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              openProjectAction(project, "remove-members")
                            }
                          >
                            Remove members
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => openProjectAction(project, "delete")}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(project) => setProjects((prev) => [...prev, project])}
      />

      <ProjectManageDialogs
        project={manageProject}
        action={manageAction}
        onClose={closeProjectAction}
        token={token}
        onRenamed={handleRenamed}
        onMembersChanged={loadProjects}
        onDeleted={handleDeleted}
      />
    </>
  );
}
