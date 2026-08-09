"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
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

export function CreateTaskTypeDialog({
  open,
  onOpenChange,
  token,
  teams = [],
  onCreated,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [alias, setAlias] = useState("");
  const [teamId, setTeamId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setAlias("");
      setTeamId("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token || submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await apiPost(
        "/task-types",
        {
          name: trimmedName,
          description: description.trim() || null,
          alias: alias.trim() || null,
          team_id: teamId ? Number(teamId) : null,
        },
        { token },
      );

      onCreated?.(data.taskType);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not create task type.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add task type</DialogTitle>
          <DialogDescription>
            Create a task type with optional team and alias.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-task-type-name">Name</Label>
            <Input
              id="create-task-type-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-task-type-description">Description</Label>
            <Input
              id="create-task-type-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-task-type-alias">Alias</Label>
            <Input
              id="create-task-type-alias"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              maxLength={100}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-task-type-team">Team</Label>
            <select
              id="create-task-type-team"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.team_id} value={team.team_id}>
                  {team.name}
                </option>
              ))}
            </select>
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
              {submitting ? "Creating..." : "Create task type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
