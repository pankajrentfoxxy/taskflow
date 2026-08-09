"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
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

const selectClassName =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function CreateUserDialog({
  open,
  onOpenChange,
  token,
  teams = [],
  showTeamSelect = true,
  onCreated,
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      setRoleId("");
      setTeamId("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !token) {
      setRoles([]);
      return;
    }

    let cancelled = false;

    async function loadRoles() {
      setRolesLoading(true);
      try {
        const data = await apiGet("/roles", { token });
        if (cancelled) return;

        const loadedRoles = data.roles || [];
        setRoles(loadedRoles);

        const defaultRole =
          loadedRoles.find((role) => role.slug === "team_member") ||
          loadedRoles[0];

        if (defaultRole) {
          setRoleId(String(defaultRole.role_id));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load roles.");
        }
      } finally {
        if (!cancelled) {
          setRolesLoading(false);
        }
      }
    }

    loadRoles();

    return () => {
      cancelled = true;
    };
  }, [open, token]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!token || submitting) return;

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
    if (!roleId) {
      setError("Role is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        full_name: trimmedName,
        email: trimmedEmail,
        phone_number: trimmedPhone,
        password,
        role_id: Number(roleId),
      };

      if (showTeamSelect && teamId) {
        payload.team_id = Number(teamId);
      }

      const data = await apiPost("/users", payload, { token });

      onCreated?.(data.user);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Could not create user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Add a new user with name, email, phone number, password, role, and
            optional team assignment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-user-name">Name</Label>
            <Input
              id="create-user-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={255}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-email">Email</Label>
            <Input
              id="create-user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-phone">Phone number</Label>
            <Input
              id="create-user-phone"
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-password">Password</Label>
            <Input
              id="create-user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-role">Role</Label>
            <select
              id="create-user-role"
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              className={selectClassName}
              required
              disabled={rolesLoading || roles.length === 0}
            >
              {rolesLoading ? (
                <option value="">Loading roles...</option>
              ) : roles.length === 0 ? (
                <option value="">No roles available</option>
              ) : (
                roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.display_name || role.slug}
                  </option>
                ))
              )}
            </select>
          </div>

          {showTeamSelect ? (
            <div className="space-y-2">
              <Label htmlFor="create-user-team">Team</Label>
              <select
                id="create-user-team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className={selectClassName}
              >
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.team_id} value={team.team_id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Optionally add this user to a team when creating their account.
              </p>
            </div>
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
              disabled={submitting || !token || rolesLoading || !roleId}
            >
              {submitting ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
