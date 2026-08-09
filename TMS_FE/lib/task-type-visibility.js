export function getAssigneeTeamIds(
  assigneeIds = [],
  teams = [],
  assigneeTeamId = "",
) {
  const teamIds = new Set();

  if (assigneeTeamId) {
    teamIds.add(Number(assigneeTeamId));
  }

  const assigneeSet = new Set(assigneeIds.map(String));

  for (const team of teams) {
    const hasSelectedMember = (team.members || []).some((member) =>
      assigneeSet.has(String(member.user_id)),
    );

    if (hasSelectedMember) {
      teamIds.add(Number(team.team_id));
    }
  }

  return teamIds;
}

export function getVisibleTaskTypes(
  taskTypes = [],
  assigneeIds = [],
  teams = [],
  assigneeTeamId = "",
  selectedTaskTypeId = "",
) {
  const relevantTeamIds = getAssigneeTeamIds(
    assigneeIds,
    teams,
    assigneeTeamId,
  );

  const visible = taskTypes.filter((type) => {
    if (type.team_id == null || type.team_id === "") {
      return true;
    }

    return relevantTeamIds.has(Number(type.team_id));
  });

  if (!selectedTaskTypeId) {
    return visible;
  }

  const selectedType = taskTypes.find(
    (type) => String(type.task_type_id) === String(selectedTaskTypeId),
  );

  if (
    selectedType &&
    !visible.some(
      (type) => String(type.task_type_id) === String(selectedType.task_type_id),
    )
  ) {
    return [...visible, selectedType];
  }

  return visible;
}

export function reconcileTaskTypeSelection({
  taskTypes = [],
  assigneeIds = [],
  teams = [],
  assigneeTeamId = "",
  taskTypeId = "",
  target = "",
  targetCompleted = "",
}) {
  const visibleTaskTypes = getVisibleTaskTypes(
    taskTypes,
    assigneeIds,
    teams,
    assigneeTeamId,
  );

  const isCurrentVisible =
    !taskTypeId ||
    visibleTaskTypes.some(
      (type) => String(type.task_type_id) === String(taskTypeId),
    );

  if (!taskTypeId || isCurrentVisible) {
    const currentType = taskTypes.find(
      (type) => String(type.task_type_id) === String(taskTypeId),
    );

    return {
      task_type_id: taskTypeId,
      target: currentType?.alias ? target : "",
      target_completed: currentType?.alias ? targetCompleted : "",
    };
  }

  return {
    task_type_id: "",
    target: "",
    target_completed: "",
  };
}
