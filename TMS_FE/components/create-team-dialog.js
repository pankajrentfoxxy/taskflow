"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiPost } from "@/lib/api";
import { CreateUserDialog } from "@/components/create-user-dialog";
import { UserMultiSelect } from "@/components/user-multi-select";
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

export function CreateTeamDialog({
  open,
  onOpenChange,
  token,
  users,
  currentUserId,
  onCreated,
  onUserCreated,
}) {
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [pendingMemberIds, setPendingMemberIds] = useState([]);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTeamName("");
      setTeamDescription("");
      setPendingMemberIds([]);
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  function handleNewUserCreated(createdUser) {
    onUserCreated?.(createdUser);
    setPendingMemberIds((current) =>
      current.includes(createdUser.user_id)
        ? current
        : [...current, createdUser.user_id],
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token || submitting) return;

    const trimmedName = teamName.trim();
    if (!trimmedName) {
      setError("Team name is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await apiPost(
        "/teams",
        {
          name: trimmedName,
          description: teamDescription.trim() || null,
          member_ids: pendingMemberIds,
        },
        { token },
      );

      onCreated?.(data.team);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not create team.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create team</DialogTitle>
            <DialogDescription>
              Set team details and add members before creating the team.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-team-name">Team name</Label>
              <Input
                id="create-team-name"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                maxLength={255}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-team-description">Description</Label>
              <Input
                id="create-team-description"
                value={teamDescription}
                onChange={(event) => setTeamDescription(event.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Team members</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateUserOpen(true)}
                >
                  <Plus className="size-4" />
                  Add user
                </Button>
              </div>

              <UserMultiSelect
                users={users}
                value={pendingMemberIds}
                onChange={setPendingMemberIds}
                excludeUserId={currentUserId}
                placeholder="Select members"
                emptyMessage="No users available. Create a user first."
              />

              {pendingMemberIds.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No members selected yet. You will be added automatically as
                  the team creator.
                </p>
              ) : null}
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
              <Button type="submit" disabled={submitting || !token}>
                {submitting ? "Creating..." : "Create team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        token={token}
        showTeamSelect={false}
        onCreated={handleNewUserCreated}
      />
    </>
  );
}
