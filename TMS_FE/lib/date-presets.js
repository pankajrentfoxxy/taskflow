function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function startOfMonth(date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function addMonths(date, months) {
  const value = new Date(date);
  value.setMonth(value.getMonth() + months);
  return startOfMonth(value);
}

export function isSameCalendarDay(left, right) {
  if (!left || !right) return false;

  const leftDate = new Date(Number(left));
  const rightDate = new Date(Number(right));

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

export { startOfDay, endOfDay };

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function getUpcomingWeekday(referenceDate, weekday) {
  const today = startOfDay(referenceDate);
  const currentWeekday = today.getDay();
  let daysAhead = (weekday - currentWeekday + 7) % 7;

  if (daysAhead === 0 && weekday !== currentWeekday) {
    daysAhead = 7;
  }

  if (daysAhead === 0 && referenceDate.getTime() > endOfDay(today).getTime()) {
    daysAhead = 7;
  }

  return startOfDay(addDays(today, daysAhead));
}

function formatWeekdayHint(date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function formatDateHint(date) {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function buildDatePresets(referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const tomorrow = startOfDay(addDays(today, 1));
  const thisWeekend = getUpcomingWeekday(referenceDate, 6);
  const nextWeek = getUpcomingWeekday(addDays(today, 1), 1);
  const nextWeekend = startOfDay(addDays(thisWeekend, 7));
  const twoWeeks = startOfDay(addDays(today, 14));
  const fourWeeks = startOfDay(addDays(today, 28));

  return [
    {
      id: "today",
      label: "Today",
      date: endOfDay(today),
      hint: formatWeekdayHint(today),
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      date: endOfDay(tomorrow),
      hint: formatWeekdayHint(tomorrow),
    },
    {
      id: "this-weekend",
      label: "This weekend",
      date: endOfDay(thisWeekend),
      hint: formatWeekdayHint(thisWeekend),
    },
    {
      id: "next-week",
      label: "Next week",
      date: endOfDay(nextWeek),
      hint: formatWeekdayHint(nextWeek),
    },
    {
      id: "next-weekend",
      label: "Next weekend",
      date: endOfDay(nextWeekend),
      hint: formatDateHint(nextWeekend),
    },
    {
      id: "two-weeks",
      label: "2 weeks",
      date: endOfDay(twoWeeks),
      hint: formatDateHint(twoWeeks),
    },
    {
      id: "four-weeks",
      label: "4 weeks",
      date: endOfDay(fourWeeks),
      hint: formatDateHint(fourWeeks),
    },
  ];
}

export function getPresetTimelineRange(preset, referenceDate = new Date()) {
  const presets = buildDatePresets(referenceDate);
  const match = presets.find((item) => item.id === preset.id) ?? preset;

  return {
    start_date: startOfDay(referenceDate).getTime(),
    end_date: match.date.getTime(),
  };
}

export function formatShortDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(Number(timestamp));
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

export function formatTimelineRange(timeline) {
  const start = formatShortDate(timeline?.start_date);
  const end = formatShortDate(timeline?.end_date);

  if (start && end) {
    return { start, end };
  }

  if (end) {
    return { start: end, end };
  }

  return null;
}
