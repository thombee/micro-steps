// ── Date helpers ────────────────────────────────────────────────────────────

export function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Tree building ────────────────────────────────────────────────────────────

/**
 * Convert a flat task array into a nested tree (each task gets a .children array).
 * Root tasks are those with parent_id === null or parent_id not found in the list.
 */
export function buildTree(flatList) {
  const map = {};
  const roots = [];
  flatList.forEach(t => { map[t.id] = { ...t, children: [] }; });
  flatList.forEach(t => {
    if (t.parent_id && map[t.parent_id]) {
      map[t.parent_id].children.push(map[t.id]);
    } else if (!t.parent_id) {
      roots.push(map[t.id]);
    }
  });
  return roots;
}

// ── Next-up logic ────────────────────────────────────────────────────────────

/**
 * Find the id of the deepest uncompleted leaf in a subtree.
 * Returns null if the node itself is completed or has no uncompleted descendants.
 */
export function findNextUp(node) {
  if (node.completed) return null;
  const uncompletedChildren = (node.children || []).filter(c => !c.completed);
  if (uncompletedChildren.length === 0) return node.id; // leaf
  for (const child of uncompletedChildren) {
    const found = findNextUp(child);
    if (found !== null) return found;
  }
  return null;
}

// ── Completion propagation ───────────────────────────────────────────────────

/**
 * After toggling a task, propagate completion state upward through ancestors.
 * - If all siblings are complete → complete the parent
 * - If any sibling is uncomplete → uncheck the parent
 */
export function propagateUp(tasks, changedId, completed) {
  const changed = tasks.find(t => t.id === changedId);
  if (!changed || !changed.parent_id) return tasks;
  const siblings = tasks.filter(t => t.parent_id === changed.parent_id);
  const allDone = siblings.every(t => (t.id === changedId ? completed : t.completed));
  if (allDone) {
    return propagateUp(
      tasks.map(t => t.id === changed.parent_id ? { ...t, completed: 1 } : t),
      changed.parent_id,
      true,
    );
  } else if (!completed) {
    return propagateUp(
      tasks.map(t => t.id === changed.parent_id ? { ...t, completed: 0 } : t),
      changed.parent_id,
      false,
    );
  }
  return tasks;
}

// ── Day filtering ────────────────────────────────────────────────────────────

/**
 * Return the Set of task IDs that should be visible for a given day.
 * Rules:
 *   - Root task with task.day === selectedDay → visible
 *   - Root task with task.day < selectedDay && !completed → carry-forward, visible
 *   - Root task with task.day === null → treated as today (legacy compat)
 *   - Children of visible roots → recursively included
 */
export function getVisibleIds(allTasks, selectedDay) {
  const today = todayISO();

  const visibleRootIds = new Set(
    allTasks
      .filter(t => {
        if (t.parent_id !== null && t.parent_id !== undefined) return false;
        const taskDay = t.day ?? today;
        if (taskDay === selectedDay) return true;
        if (taskDay < selectedDay && !t.completed) return true;
        return false;
      })
      .map(t => t.id)
  );

  // BFS expand to all descendants of visible roots
  const result = new Set(visibleRootIds);
  const queue = [...visibleRootIds];
  while (queue.length) {
    const parentId = queue.shift();
    allTasks
      .filter(t => t.parent_id === parentId)
      .forEach(child => {
        if (!result.has(child.id)) {
          result.add(child.id);
          queue.push(child.id);
        }
      });
  }

  return result;
}

// ── Subtree collection ───────────────────────────────────────────────────────

/**
 * Return an array of all IDs in the subtree rooted at rootId (inclusive).
 */
export function collectSubtreeIds(tasks, rootId) {
  const ids = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    tasks.filter(t => t.parent_id === id).forEach(c => { ids.push(c.id); queue.push(c.id); });
  }
  return ids;
}

// ── Heuristics ───────────────────────────────────────────────────────────────

/**
 * Return true if a task title looks too large to be a single micro-step.
 * Heuristic: >6 words, or contains conjunction words suggesting compound tasks.
 */
export function looksTooBig(title) {
  const words = title.trim().split(/\s+/);
  if (words.length > 6) return true;
  if (/ and | then | also | plus /i.test(title)) return true;
  return false;
}

// ── Completion delta ─────────────────────────────────────────────────────────

/**
 * Count how many tasks changed completion state between two flat task arrays.
 * Returns a signed integer: positive = net completions, negative = net un-completions.
 */
export function completionDelta(before, after) {
  return after.reduce((acc, t) => {
    const was = !!before.find(p => p.id === t.id)?.completed;
    const is = !!t.completed;
    if (!was && is) return acc + 1;
    if (was && !is) return acc - 1;
    return acc;
  }, 0);
}
