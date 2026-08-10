export function formatNotificationTime(timestamp) {
  if (!timestamp) return "";

  const diffMs = Date.now() - Number(timestamp);
  if (Number.isNaN(diffMs) || diffMs < 0) return "Just now";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(Number(timestamp)).toLocaleDateString();
}

export function getNotificationIcon(type) {
  switch (type) {
    case "escalated":
      return { glyph: "!", className: "bg-rose-100 text-rose-600" };
    case "acknowledged":
      return { glyph: "👍", className: "bg-emerald-100 text-emerald-700" };
    case "assigned":
      return { glyph: "✓", className: "bg-sky-100 text-sky-700" };
    default:
      return { glyph: "•", className: "bg-muted text-muted-foreground" };
  }
}
