"use client";

import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function getMemberLabel(member) {
  return (
    member.user?.full_name ||
    member.user?.email ||
    `User #${member.user_id}`
  );
}

export function getTeamProjectMemberIds(team, members = []) {
  const projectMemberIds = new Set(members.map((member) => Number(member.user_id)));
  return [
    ...new Set(
      (team?.members || [])
        .map((member) => Number(member.user_id))
        .filter((userId) => projectMemberIds.has(userId)),
    ),
  ];
}

export function findMatchingTeamId(teams = [], assigneeIds = [], members = []) {
  const selectedIds = assigneeIds.map(String).sort().join(",");

  for (const team of teams) {
    const teamMemberIds = getTeamProjectMemberIds(team, members)
      .map(String)
      .sort()
      .join(",");

    if (teamMemberIds && teamMemberIds === selectedIds) {
      return String(team.team_id);
    }
  }

  return "";
}

export function getAssigneeLabel({
  members = [],
  teams = [],
  assigneeIds = [],
  assigneeTeamId = "",
}) {
  if (assigneeTeamId) {
    const team = teams.find(
      (item) => String(item.team_id) === String(assigneeTeamId),
    );
    if (team) {
      return team.name;
    }
  }

  const selectedMembers = members.filter((member) =>
    assigneeIds.map(String).includes(String(member.user_id)),
  );

  if (selectedMembers.length === 0) {
    return "Assignee";
  }

  if (selectedMembers.length === 1) {
    return getMemberLabel(selectedMembers[0]);
  }

  return `${selectedMembers.length} assignees`;
}

export function TaskAssigneePickerContent({
  members = [],
  teams = [],
  assigneeIds = [],
  assigneeTeamId = "",
  onChange,
  peopleLabel = "People",
  teamsLabel = "Teams",
}) {
  const normalizedAssigneeIds = assigneeIds.map(String);

  function clearAssignees() {
    onChange({ assigneeIds: [], assigneeTeamId: "" });
  }

  function selectTeam(teamId) {
    const team = teams.find((item) => String(item.team_id) === String(teamId));
    if (!team) {
      return;
    }

    const memberIds = getTeamProjectMemberIds(team, members).map(String);
    onChange({
      assigneeIds: memberIds,
      assigneeTeamId: String(teamId),
    });
  }

  function togglePerson(userId) {
    const id = String(userId);
    const teamMode = Boolean(assigneeTeamId);

    if (teamMode) {
      onChange({
        assigneeIds: normalizedAssigneeIds.includes(id) ? [] : [id],
        assigneeTeamId: "",
      });
      return;
    }

    const nextIds = normalizedAssigneeIds.includes(id)
      ? normalizedAssigneeIds.filter((value) => value !== id)
      : [...normalizedAssigneeIds, id];

    onChange({
      assigneeIds: nextIds,
      assigneeTeamId: "",
    });
  }

  return (
    <>
      <DropdownMenuItem onClick={clearAssignees}>Clear assignees</DropdownMenuItem>

      {teams.length > 0 ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={assigneeTeamId}
            onValueChange={selectTeam}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {teamsLabel}
            </DropdownMenuLabel>
            {teams.map((team) => (
              <DropdownMenuRadioItem
                key={team.team_id}
                value={String(team.team_id)}
              >
                {team.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </>
      ) : null}

      {members.length > 0 ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {peopleLabel}
            </DropdownMenuLabel>
            {members.map((member) => (
              <DropdownMenuCheckboxItem
                key={member.user_id}
                checked={normalizedAssigneeIds.includes(String(member.user_id))}
                onCheckedChange={() => togglePerson(member.user_id)}
              >
                {getMemberLabel(member)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </>
      ) : null}
    </>
  );
}
