export const EMPTY_TIMELINE = {
  start_date: null,
  end_date: null,
};

export function normalizeTimelineValue(timeline) {
  if (!timeline || Array.isArray(timeline)) {
    return { ...EMPTY_TIMELINE };
  }

  return {
    start_date: timeline.start_date ?? null,
    end_date: timeline.end_date ?? null,
    updated_by: timeline.updated_by ?? null,
    updated_at: timeline.updated_at ?? null,
  };
}

export function buildTimelinePayload(timeline, userId, timestamp = Date.now()) {
  const normalized = normalizeTimelineValue(timeline);

  return {
    start_date: normalized.start_date,
    end_date: normalized.end_date,
    updated_by: userId,
    updated_at: timestamp,
  };
}

export function isValidTimelineRange(timeline) {
  const normalized = normalizeTimelineValue(timeline);

  if (normalized.start_date == null && normalized.end_date == null) {
    return true;
  }

  if (normalized.start_date == null || normalized.end_date == null) {
    return true;
  }

  return normalized.start_date <= normalized.end_date;
}
