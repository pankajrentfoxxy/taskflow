export function sanitizeTimelineInput(timeline) {
  return {
    start_date: timeline?.start_date ?? null,
    end_date: timeline?.end_date ?? null,
  };
}
