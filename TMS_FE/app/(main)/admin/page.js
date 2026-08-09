"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { CreateUserDialog } from "@/components/create-user-dialog";
import { CreateTeamDialog } from "@/components/create-team-dialog";
import { CreateTaskTypeDialog } from "@/components/create-task-type-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminPage() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createTaskTypeOpen, setCreateTaskTypeOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loadError, setLoadError] = useState("");

  const loadUsers = useCallback(async () => {
    if (!token) {
      setUsers([]);
      return;
    }

    const data = await apiGet("/users", { token });
    setUsers(data.users || []);
  }, [token]);

  const loadTeams = useCallback(async () => {
    if (!token) {
      setTeams([]);
      return;
    }

    const data = await apiGet("/teams", { token });
    setTeams(data.teams || []);
  }, [token]);

  const loadTaskTypes = useCallback(async () => {
    if (!token) {
      setTaskTypes([]);
      return;
    }

    const data = await apiGet("/task-types", { token });
    setTaskTypes(data.taskTypes || []);
  }, [token]);

  const loadTeamMembers = useCallback(
    async (teamId) => {
      if (!token || !teamId) {
        setTeamMembers([]);
        return;
      }

      setMembersLoading(true);
      try {
        const data = await apiGet(`/teams/${teamId}/members`, { token });
        setTeamMembers(data.members || []);
      } catch (err) {
        setTeamMembers([]);
        setLoadError(err.message || "Failed to load team members.");
      } finally {
        setMembersLoading(false);
      }
    },
    [token],
  );

  const loadAll = useCallback(async () => {
    if (!token) {
      setUsers([]);
      setTeams([]);
      setTaskTypes([]);
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      await Promise.all([loadUsers(), loadTeams(), loadTaskTypes()]);
    } catch (err) {
      setLoadError(err.message || "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [token, loadUsers, loadTeams, loadTaskTypes]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamMembers(selectedTeamId);
    } else {
      setTeamMembers([]);
    }
  }, [selectedTeamId, loadTeamMembers]);

  const selectedTeam = useMemo(
    () => teams.find((team) => String(team.team_id) === selectedTeamId),
    [teams, selectedTeamId],
  );

  function handleUserCreated(createdUser) {
    setUsers((current) => {
      const exists = current.some((user) => user.user_id === createdUser.user_id);
      if (exists) {
        return current.map((user) =>
          user.user_id === createdUser.user_id ? createdUser : user,
        );
      }
      return [createdUser, ...current];
    });
  }

  function handleTaskTypeCreated(taskType) {
    setTaskTypes((current) => {
      const exists = current.some(
        (item) => item.task_type_id === taskType.task_type_id,
      );
      if (exists) {
        return current.map((item) =>
          item.task_type_id === taskType.task_type_id ? taskType : item,
        );
      }
      return [...current, taskType];
    });
  }

  async function handleTeamCreated(team) {
    await loadTeams();
    if (team?.team_id) {
      setSelectedTeamId(String(team.team_id));
    }
  }

  return (
    <>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Admin</h2>
          <p className="text-muted-foreground">
            Manage task types, users, and teams from one place.
          </p>
        </div>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-medium">Task types</h3>
            <Button type="button" onClick={() => setCreateTaskTypeOpen(true)}>
              <Plus className="size-4" />
              Add task type
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Task types</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading task types..."
                  : `${taskTypes.length} task type${taskTypes.length === 1 ? "" : "s"} configured`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">
                  Loading task types...
                </p>
              ) : taskTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No task types found.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Alias</th>
                        <th className="px-4 py-3 font-medium">Team</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskTypes.map((taskType) => (
                        <tr
                          key={taskType.task_type_id}
                          className="border-t border-border"
                        >
                          <td className="px-4 py-3">{taskType.name}</td>
                          <td className="px-4 py-3">{taskType.alias || "—"}</td>
                          <td className="px-4 py-3">
                            {taskType.team?.name || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {taskType.description || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-medium">Users</h3>
            <Button type="button" onClick={() => setCreateUserOpen(true)}>
              <Plus className="size-4" />
              Add user
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading users..."
                  : `${users.length} user${users.length === 1 ? "" : "s"} in the system`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users found.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Phone</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr
                          key={user.user_id}
                          className="border-t border-border"
                        >
                          <td className="px-4 py-3">
                            {user.full_name || "—"}
                          </td>
                          <td className="px-4 py-3">{user.email}</td>
                          <td className="px-4 py-3">
                            {user.phone_number || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {user.role?.slug || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-medium">Teams</h3>
            <Button type="button" onClick={() => setCreateTeamOpen(true)}>
              <Plus className="size-4" />
              Create team
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Teams</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading teams..."
                  : selectedTeam
                    ? `Members of "${selectedTeam.name}"`
                    : `${teams.length} team${teams.length === 1 ? "" : "s"} available`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading teams...</p>
              ) : teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams found.</p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="px-4 py-3 font-medium">Team</th>
                          <th className="px-4 py-3 font-medium">Description</th>
                          <th className="px-4 py-3 font-medium">Created by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map((team) => (
                          <tr
                            key={team.team_id}
                            className={`border-t border-border ${
                              String(team.team_id) === selectedTeamId
                                ? "bg-muted/30"
                                : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedTeamId(String(team.team_id))
                                }
                                className="font-medium text-left hover:underline"
                              >
                                {team.name}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              {team.description || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {team.creator?.full_name ||
                                team.creator?.email ||
                                "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedTeamId ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Team members</h4>
                      {membersLoading ? (
                        <p className="text-sm text-muted-foreground">
                          Loading members...
                        </p>
                      ) : teamMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No members in this team yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {teamMembers.map((member) => (
                            <li
                              key={member.team_member_id}
                              className="rounded-lg border border-border px-3 py-2 text-sm"
                            >
                              <p className="font-medium">
                                {member.user?.full_name ||
                                  member.user?.email ||
                                  "Member"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.user?.email || "—"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        token={token}
        teams={teams}
        onCreated={handleUserCreated}
      />

      <CreateTaskTypeDialog
        open={createTaskTypeOpen}
        onOpenChange={setCreateTaskTypeOpen}
        token={token}
        teams={teams}
        onCreated={handleTaskTypeCreated}
      />

      <CreateTeamDialog
        open={createTeamOpen}
        onOpenChange={setCreateTeamOpen}
        token={token}
        users={users}
        currentUserId={currentUser?.user_id}
        onCreated={handleTeamCreated}
        onUserCreated={handleUserCreated}
      />
    </>
  );
}
