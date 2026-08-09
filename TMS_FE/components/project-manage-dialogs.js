"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserMultiSelect } from "@/components/user-multi-select";
import { cn } from "@/lib/utils";

function getTeamMemberUserIds(team) {
  return [
    ...new Set(
      (team?.members || [])
        .map((member) => Number(member.user_id))
        .filter(Boolean),
    ),
  ];
}

function ModeSwitch({ mode, onChange, options }) {
  const items = options ?? [
    { id: "existing", label: "Existing" },
    { id: "team", label: "Team" },
    { id: "create", label: "Create new" },
  ];

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-1">
      {items.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === option.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function RenameProjectDialog({
  open,
  onOpenChange,
  project,
  token,
  onRenamed,
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && project) {
      setName(project.name || "");
      setError("");
      setSubmitting(false);
    }
  }, [open, project]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token || !project || submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await apiPatch(
        `/projects/${project.project_id}`,
        { name: trimmedName },
        { token },
      );
      onRenamed?.(data.project);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not rename project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            Update the name for &ldquo;{project?.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-project-name">Name</Label>
            <Input
              id="rename-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              autoFocus
              required
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddProjectMembersDialog({
  open,
  onOpenChange,
  project,
  token,
  onMembersChanged,
}) {
  const [mode, setMode] = useState("existing");
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !token || !project) {
      return;
    }

    let cancelled = false;

    async function loadOptions() {
      setLoadingOptions(true);
      setError("");

      try {
        const [usersData, teamsData, membersData] = await Promise.all([
          apiGet("/users", { token }),
          apiGet("/teams", { token }),
          apiGet(`/projects/${project.project_id}/members`, { token }),
        ]);

        if (cancelled) return;

        setUsers(usersData.users || []);
        setTeams(teamsData.teams || []);
        setProjectMembers(membersData.members || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load member options.");
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    }

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [open, project, token]);

  useEffect(() => {
    if (open) {
      setMode("existing");
      setSelectedUserIds([]);
      setSelectedTeamId("");
      setFullName("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      setError("");
      setSubmitting(false);
    }
  }, [open, project]);

  const projectMemberIds = useMemo(
    () => new Set(projectMembers.map((member) => Number(member.user_id))),
    [projectMembers],
  );

  const availableUsers = useMemo(
    () => users.filter((user) => !projectMemberIds.has(Number(user.user_id))),
    [users, projectMemberIds],
  );

  const teamOptions = useMemo(
    () =>
      teams
        .map((team) => {
          const addableUserIds = getTeamMemberUserIds(team).filter(
            (userId) => !projectMemberIds.has(userId),
          );

          return {
            ...team,
            addableUserIds,
          };
        })
        .filter((team) => team.addableUserIds.length > 0),
    [teams, projectMemberIds],
  );

  const selectedTeam = teamOptions.find(
    (team) => String(team.team_id) === String(selectedTeamId),
  );

  async function addMembersByUserIds(userIds) {
    const uniqueIds = [...new Set(userIds.map(Number).filter(Boolean))];
    if (uniqueIds.length === 0) {
      throw new Error("No members selected to add.");
    }

    for (const userId of uniqueIds) {
      await apiPost(
        `/projects/${project.project_id}/members`,
        { user_id: userId },
        { token },
      );
    }
  }

  async function handleSubmitExisting(event) {
    event.preventDefault();
    if (!token || !project || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await addMembersByUserIds(selectedUserIds);
      onMembersChanged?.();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not add members.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitTeam(event) {
    event.preventDefault();
    if (!token || !project || submitting) return;

    if (!selectedTeam) {
      setError("Select a team to add.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await addMembersByUserIds(selectedTeam.addableUserIds);
      onMembersChanged?.();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not add team members.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitCreate(event) {
    event.preventDefault();
    if (!token || !project || submitting) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phoneNumber.trim();

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }
    if (!trimmedPhone) {
      setError("Phone number is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await apiPost(
        `/projects/${project.project_id}/members`,
        {
          full_name: trimmedName,
          email: trimmedEmail,
          phone_number: trimmedPhone,
          password,
        },
        { token },
      );
      onMembersChanged?.();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not add member.");
    } finally {
      setSubmitting(false);
    }
  }

  const descriptionByMode = {
    existing: `Add existing users to "${project?.name}".`,
    team: `Add all members from a team to "${project?.name}".`,
    create: `Create a new user account and add them to "${project?.name}".`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>{descriptionByMode[mode]}</DialogDescription>
        </DialogHeader>

        <ModeSwitch mode={mode} onChange={setMode} />

        {loadingOptions ? (
          <p className="text-sm text-muted-foreground">Loading options...</p>
        ) : null}

        {mode === "existing" ? (
          <form onSubmit={handleSubmitExisting} className="space-y-4">
            <div className="space-y-2">
              <Label>Select users</Label>
              <UserMultiSelect
                users={availableUsers}
                value={selectedUserIds}
                onChange={setSelectedUserIds}
                placeholder="Search and select users"
                emptyMessage={
                  availableUsers.length === 0
                    ? "All users are already in this project"
                    : "No users available"
                }
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting || loadingOptions || selectedUserIds.length === 0
                }
              >
                {submitting ? "Adding..." : "Add members"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {mode === "team" ? (
          <form onSubmit={handleSubmitTeam} className="space-y-4">
            <div className="space-y-2">
              <Label>Select team</Label>
              {teamOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No teams with members left to add.
                </p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                  {teamOptions.map((team) => {
                    const isSelected =
                      String(team.team_id) === String(selectedTeamId);

                    return (
                      <li key={team.team_id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTeamId(String(team.team_id))
                          }
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:bg-muted/50",
                          )}
                        >
                          <span className="font-medium">{team.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {team.addableUserIds.length} member
                            {team.addableUserIds.length === 1 ? "" : "s"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {selectedTeam ? (
              <p className="text-xs text-muted-foreground">
                All {selectedTeam.addableUserIds.length} member
                {selectedTeam.addableUserIds.length === 1 ? "" : "s"} from{" "}
                {selectedTeam.name} will be added to this project.
              </p>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting || loadingOptions || !selectedTeamId || !selectedTeam
                }
              >
                {submitting ? "Adding..." : "Add team"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {mode === "create" ? (
          <form onSubmit={handleSubmitCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-member-name">Name</Label>
              <Input
                id="add-member-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={255}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-member-email">Email</Label>
              <Input
                id="add-member-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-member-phone">Phone number</Label>
              <Input
                id="add-member-phone"
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-member-password">Password</Label>
              <Input
                id="add-member-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create and add"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function getRemovableMembersForTeam(team, removableMembers) {
  const teamUserIds = new Set(getTeamMemberUserIds(team));

  return removableMembers.filter((member) =>
    teamUserIds.has(Number(member.user_id)),
  );
}

export function RemoveProjectMembersDialog({
  open,
  onOpenChange,
  project,
  token,
  onMembersChanged,
}) {
  const [mode, setMode] = useState("people");
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [removingTeam, setRemovingTeam] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !token || !project) {
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [membersData, teamsData] = await Promise.all([
          apiGet(`/projects/${project.project_id}/members`, { token }),
          apiGet("/teams", { token }),
        ]);

        if (!cancelled) {
          setMembers(membersData.members || []);
          setTeams(teamsData.teams || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load members.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [open, project, token]);

  useEffect(() => {
    if (open) {
      setMode("people");
      setSelectedTeamId("");
      setError("");
      setRemovingId(null);
      setRemovingTeam(false);
    }
  }, [open, project]);

  const removableMembers = useMemo(
    () =>
      members.filter((member) => member.user_id !== project?.created_by),
    [members, project?.created_by],
  );

  const teamOptions = useMemo(
    () =>
      teams
        .map((team) => ({
          ...team,
          removableMembers: getRemovableMembersForTeam(team, removableMembers),
        }))
        .filter((team) => team.removableMembers.length > 0),
    [teams, removableMembers],
  );

  const selectedTeam = teamOptions.find(
    (team) => String(team.team_id) === String(selectedTeamId),
  );

  async function removeMembers(memberList) {
    for (const member of memberList) {
      await apiDelete(
        `/projects/${project.project_id}/members/${member.project_member_id}`,
        { token },
      );
    }

    const removedIds = new Set(
      memberList.map((member) => member.project_member_id),
    );

    setMembers((current) =>
      current.filter((item) => !removedIds.has(item.project_member_id)),
    );
    onMembersChanged?.();
  }

  async function handleRemove(member) {
    if (!token || !project || removingId || removingTeam) return;

    setRemovingId(member.project_member_id);
    setError("");

    try {
      await removeMembers([member]);
    } catch (err) {
      setError(err.message || "Could not remove member.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRemoveTeam(event) {
    event.preventDefault();
    if (!token || !project || removingTeam || removingId || !selectedTeam) {
      return;
    }

    setRemovingTeam(true);
    setError("");

    try {
      await removeMembers(selectedTeam.removableMembers);
      setSelectedTeamId("");
    } catch (err) {
      setError(err.message || "Could not remove team members.");
    } finally {
      setRemovingTeam(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remove members</DialogTitle>
          <DialogDescription>
            {mode === "people"
              ? `Remove individual members from "${project?.name}". The project creator cannot be removed.`
              : `Remove all members of a team from "${project?.name}". The project creator is never removed.`}
          </DialogDescription>
        </DialogHeader>

        <ModeSwitch
          mode={mode}
          onChange={setMode}
          options={[
            { id: "people", label: "People" },
            { id: "team", label: "Team" },
          ]}
        />

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading members...</p>
          ) : mode === "people" ? (
            removableMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No removable members in this project.
              </p>
            ) : (
              <ul className="max-h-60 space-y-2 overflow-y-auto">
                {removableMembers.map((member) => (
                  <li
                    key={member.project_member_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.user?.full_name ||
                          member.user?.email ||
                          "Member"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[member.user?.email, member.user?.phone_number]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        removingId === member.project_member_id || removingTeam
                      }
                      onClick={() => handleRemove(member)}
                    >
                      {removingId === member.project_member_id
                        ? "Removing..."
                        : "Remove"}
                    </Button>
                  </li>
                ))}
              </ul>
            )
          ) : teamOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No teams with removable members in this project.
            </p>
          ) : (
            <form onSubmit={handleRemoveTeam} className="space-y-4">
              <div className="space-y-2">
                <Label>Select team</Label>
                <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
                  {teamOptions.map((team) => {
                    const isSelected =
                      String(team.team_id) === String(selectedTeamId);

                    return (
                      <li key={team.team_id}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTeamId(String(team.team_id))
                          }
                          disabled={removingTeam}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:bg-muted/50",
                          )}
                        >
                          <span className="font-medium">{team.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {team.removableMembers.length} member
                            {team.removableMembers.length === 1 ? "" : "s"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selectedTeam ? (
                <p className="text-xs text-muted-foreground">
                  All {selectedTeam.removableMembers.length} removable member
                  {selectedTeam.removableMembers.length === 1 ? "" : "s"} from{" "}
                  {selectedTeam.name} will be removed from this project.
                </p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={removingTeam || !selectedTeam}
                >
                  {removingTeam ? "Removing..." : "Remove team"}
                </Button>
              </div>
            </form>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  project,
  token,
  onDeleted,
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  async function handleDelete() {
    if (!token || !project || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      await apiDelete(`/projects/${project.project_id}`, { token });
      onDeleted?.(project);
      onOpenChange(false);

      if (window.location.pathname.startsWith(`/projects/${project.project_id}`)) {
        router.push("/");
      }
    } catch (err) {
      setError(err.message || "Could not delete project.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This will permanently delete &ldquo;{project?.name}&rdquo; and all
            of its tasks. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? "Deleting..." : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectManageDialogs({
  project,
  action,
  onClose,
  token,
  onRenamed,
  onMembersChanged,
  onDeleted,
}) {
  const open = Boolean(project && action);

  return (
    <>
      <RenameProjectDialog
        open={open && action === "rename"}
        onOpenChange={(nextOpen) => !nextOpen && onClose?.()}
        project={project}
        token={token}
        onRenamed={onRenamed}
      />
      <AddProjectMembersDialog
        open={open && action === "add-members"}
        onOpenChange={(nextOpen) => !nextOpen && onClose?.()}
        project={project}
        token={token}
        onMembersChanged={onMembersChanged}
      />
      <RemoveProjectMembersDialog
        open={open && action === "remove-members"}
        onOpenChange={(nextOpen) => !nextOpen && onClose?.()}
        project={project}
        token={token}
        onMembersChanged={onMembersChanged}
      />
      <DeleteProjectDialog
        open={open && action === "delete"}
        onOpenChange={(nextOpen) => !nextOpen && onClose?.()}
        project={project}
        token={token}
        onDeleted={onDeleted}
      />
    </>
  );
}
