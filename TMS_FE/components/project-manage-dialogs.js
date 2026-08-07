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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      setError("");
      setSubmitting(false);
    }
  }, [open, project]);

  async function handleSubmit(event) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>
            Create a new member account for &ldquo;{project?.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              {submitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveProjectMembersDialog({
  open,
  onOpenChange,
  project,
  token,
  onMembersChanged,
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !token || !project) {
      return;
    }

    let cancelled = false;

    async function loadMembers() {
      setLoading(true);
      setError("");

      try {
        const data = await apiGet(
          `/projects/${project.project_id}/members`,
          { token },
        );
        if (!cancelled) {
          setMembers(data.members || []);
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

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [open, project, token]);

  const removableMembers = useMemo(
    () =>
      members.filter((member) => member.user_id !== project?.created_by),
    [members, project?.created_by],
  );

  async function handleRemove(member) {
    if (!token || !project || removingId) return;

    setRemovingId(member.project_member_id);
    setError("");

    try {
      await apiDelete(
        `/projects/${project.project_id}/members/${member.project_member_id}`,
        { token },
      );
      setMembers((current) =>
        current.filter(
          (item) => item.project_member_id !== member.project_member_id,
        ),
      );
      onMembersChanged?.();
    } catch (err) {
      setError(err.message || "Could not remove member.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove members</DialogTitle>
          <DialogDescription>
            Remove members from &ldquo;{project?.name}&rdquo;. The project
            creator cannot be removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading members...</p>
          ) : removableMembers.length === 0 ? (
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
                      {member.user?.full_name || member.user?.email || "Member"}
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
                    disabled={removingId === member.project_member_id}
                    onClick={() => handleRemove(member)}
                  >
                    {removingId === member.project_member_id
                      ? "Removing..."
                      : "Remove"}
                  </Button>
                </li>
              ))}
            </ul>
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
