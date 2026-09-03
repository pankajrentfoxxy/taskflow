/** QA rows from reports API people table. */
export function getQaPeopleFromReport(people = []) {
  return people.filter((p) => p.role === "QA");
}

export function aggregateQaTotals(qaPeople = []) {
  return qaPeople.reduce(
    (acc, p) => ({
      assigned_out: acc.assigned_out + (Number(p.assigned_out) || 0),
      done_by_assignee: acc.done_by_assignee + (Number(p.done_by_assignee) || 0),
      done_self: acc.done_self + (Number(p.done_self) || 0),
      done: acc.done + (Number(p.done) || 0),
    }),
    { assigned_out: 0, done_by_assignee: 0, done_self: 0, done: 0 }
  );
}

/** One-line summary for WhatsApp (fits download_report 2nd body param). */
export function formatQaWhatsAppLine(qaPeople = []) {
  if (!qaPeople.length) return "No QA activity";
  const t = aggregateQaTotals(qaPeople);
  if (!t.assigned_out && !t.done_by_assignee && !t.done_self) return "No QA activity";
  return `${t.assigned_out} assigned, ${t.done_by_assignee} user done, ${t.done_self} self done`;
}

/** Short date + QA line for WhatsApp template body param 2. */
export function formatDailyReportWhatsAppDateLine(dateKey, qaPeople = []) {
  const qaLine = formatQaWhatsAppLine(qaPeople);
  if (qaLine === "No QA activity") return dateKey;
  return `${dateKey} — QA: ${qaLine}`;
}

export function personDisplayName(name = "") {
  return String(name).split(" (")[0];
}

export default {
  getQaPeopleFromReport,
  aggregateQaTotals,
  formatQaWhatsAppLine,
  formatDailyReportWhatsAppDateLine,
  personDisplayName,
};
