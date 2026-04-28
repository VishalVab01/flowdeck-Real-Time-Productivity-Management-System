// Dynamic priority engine - shared between routes.
// Higher priorityScore = more urgent. Completed tasks get -1 to sink to bottom.
//
// Rules:
//  - Overdue (deadline in the past, not Completed) -> 1000 + minutesOverdue (always highest)
//  - Has deadline -> max(0, 1440 - minutesUntilDeadline)  (closer = higher)
//  - No deadline  -> 0
//  - Completed    -> -1
//
// Levels (for UI highlighting):
//   Overdue | High (<24h) | Medium (<72h) | Low | Done

const MS_MIN = 60 * 1000;

function computePriority(task, now = new Date()) {
  if (task.status === 'Completed') {
    return { priorityScore: -1, priorityLevel: 'Done' };
  }

  if (!task.deadline) {
    return { priorityScore: 0, priorityLevel: 'Low' };
  }

  const deadline = new Date(task.deadline);
  const diffMin = Math.round((deadline.getTime() - now.getTime()) / MS_MIN);

  if (diffMin < 0) {
    const overdueMin = -diffMin;
    return { priorityScore: 1000 + overdueMin, priorityLevel: 'Overdue' };
  }

  // Approaching deadline: linear gradient 999..0 over a 7-day window.
  // Capped at 999 so overdue (1000+) ALWAYS beats it.
  const URGENCY_WINDOW_MIN = 7 * 24 * 60;
  const score = Math.max(0, Math.round(999 * (1 - Math.min(diffMin / URGENCY_WINDOW_MIN, 1))));
  let level = 'Low';
  if (diffMin < 60 * 24) level = 'High';
  else if (diffMin < 60 * 72) level = 'Medium';
  return { priorityScore: score, priorityLevel: level };
}

// Decorate a task object (plain JSON) with priority fields.
function decorate(taskJson, now = new Date()) {
  return { ...taskJson, ...computePriority(taskJson, now) };
}

// Sort a list of priority-decorated task JSONs:
//   priorityScore desc, then createdAt asc (earlier created comes first).
function sortByPriority(tasksJson) {
  return [...tasksJson].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  });
}

module.exports = { computePriority, decorate, sortByPriority };
