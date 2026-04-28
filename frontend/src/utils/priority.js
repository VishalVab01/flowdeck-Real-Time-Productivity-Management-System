// Mirror of /app/backend/utils/priority.js so the UI can recompute priority
// client-side every "tick" (no manual refresh required).
const MS_MIN = 60 * 1000;

export function computePriority(task, now = new Date()) {
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
  const URGENCY_WINDOW_MIN = 7 * 24 * 60;
  const score = Math.max(0, Math.round(999 * (1 - Math.min(diffMin / URGENCY_WINDOW_MIN, 1))));
  let level = 'Low';
  if (diffMin < 60 * 24) level = 'High';
  else if (diffMin < 60 * 72) level = 'Medium';
  return { priorityScore: score, priorityLevel: level };
}

export function decorate(task, now = new Date()) {
  return { ...task, ...computePriority(task, now) };
}

export function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
