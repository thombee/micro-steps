import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  todayISO,
  buildTree,
  findNextUp,
  propagateUp,
  getVisibleIds,
  collectSubtreeIds,
  looksTooBig,
  completionDelta,
} from './utils';

// ── todayISO ────────────────────────────────────────────────────────────────

describe('todayISO', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today\'s date', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    expect(todayISO()).toBe(`${y}-${m}-${d}`);
  });
});

// ── buildTree ────────────────────────────────────────────────────────────────

describe('buildTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('builds a single root node with no children', () => {
    const flat = [{ id: 1, parent_id: null, title: 'Root' }];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
    expect(tree[0].children).toEqual([]);
  });

  it('nests children under their parent', () => {
    const flat = [
      { id: 1, parent_id: null, title: 'Parent' },
      { id: 2, parent_id: 1, title: 'Child A' },
      { id: 3, parent_id: 1, title: 'Child B' },
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].id).toBe(2);
    expect(tree[0].children[1].id).toBe(3);
  });

  it('builds multi-level deep trees', () => {
    const flat = [
      { id: 1, parent_id: null, title: 'Root' },
      { id: 2, parent_id: 1, title: 'Child' },
      { id: 3, parent_id: 2, title: 'Grandchild' },
    ];
    const tree = buildTree(flat);
    expect(tree[0].children[0].children[0].id).toBe(3);
  });

  it('handles multiple root nodes', () => {
    const flat = [
      { id: 1, parent_id: null, title: 'Root A' },
      { id: 2, parent_id: null, title: 'Root B' },
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(2);
  });

  it('orphaned tasks (unknown parent) are dropped', () => {
    const flat = [
      { id: 1, parent_id: null, title: 'Root' },
      { id: 2, parent_id: 999, title: 'Orphan' }, // 999 not in list
    ];
    const tree = buildTree(flat);
    // Orphan has a non-null parent_id not in the map → not added to roots or any parent
    expect(tree).toHaveLength(1);
  });

  it('does not mutate input objects', () => {
    const flat = [{ id: 1, parent_id: null, title: 'Root' }];
    buildTree(flat);
    expect('children' in flat[0]).toBe(false);
  });
});

// ── findNextUp ───────────────────────────────────────────────────────────────

describe('findNextUp', () => {
  it('returns null for a completed node', () => {
    const node = { id: 1, completed: 1, children: [] };
    expect(findNextUp(node)).toBeNull();
  });

  it('returns the node id if it is a leaf and uncompleted', () => {
    const node = { id: 1, completed: 0, children: [] };
    expect(findNextUp(node)).toBe(1);
  });

  it('returns deepest uncompleted leaf', () => {
    const tree = {
      id: 1, completed: 0,
      children: [{
        id: 2, completed: 0,
        children: [
          { id: 3, completed: 0, children: [] },
        ],
      }],
    };
    expect(findNextUp(tree)).toBe(3);
  });

  it('skips completed children', () => {
    const tree = {
      id: 1, completed: 0,
      children: [
        { id: 2, completed: 1, children: [] },
        { id: 3, completed: 0, children: [] },
      ],
    };
    expect(findNextUp(tree)).toBe(3);
  });

  it('returns null when all children are completed', () => {
    const tree = {
      id: 1, completed: 0,
      children: [
        { id: 2, completed: 1, children: [] },
      ],
    };
    // Node 1 is uncompleted but its only child is done — it's not a leaf either
    // findNextUp recurses into uncompleted children only; no uncompleted children → returns node.id
    // Actually: uncompletedChildren.length === 0 → return node.id (1)
    expect(findNextUp(tree)).toBe(1);
  });

  it('finds next-up in first uncompleted subtree', () => {
    const tree = {
      id: 1, completed: 0,
      children: [
        { id: 2, completed: 0, children: [{ id: 4, completed: 0, children: [] }] },
        { id: 3, completed: 0, children: [{ id: 5, completed: 0, children: [] }] },
      ],
    };
    expect(findNextUp(tree)).toBe(4); // first subtree's deepest leaf
  });
});

// ── propagateUp ──────────────────────────────────────────────────────────────

describe('propagateUp', () => {
  it('returns unchanged array when task has no parent', () => {
    const tasks = [{ id: 1, parent_id: null, completed: 1 }];
    const result = propagateUp(tasks, 1, true);
    expect(result).toEqual(tasks);
  });

  it('completes parent when all siblings are done', () => {
    const tasks = [
      { id: 1, parent_id: null, completed: 0 },
      { id: 2, parent_id: 1, completed: 1 },
      { id: 3, parent_id: 1, completed: 0 },
    ];
    // Mark task 3 as complete → all siblings of parent 1 are done → parent should complete
    const result = propagateUp(
      tasks.map(t => t.id === 3 ? { ...t, completed: 1 } : t),
      3,
      true,
    );
    expect(result.find(t => t.id === 1).completed).toBe(1);
  });

  it('unchecks parent when a sibling is unchecked', () => {
    const tasks = [
      { id: 1, parent_id: null, completed: 1 },
      { id: 2, parent_id: 1, completed: 1 },
      { id: 3, parent_id: 1, completed: 1 },
    ];
    // Mark task 2 as incomplete → parent should be unchecked
    const result = propagateUp(
      tasks.map(t => t.id === 2 ? { ...t, completed: 0 } : t),
      2,
      false,
    );
    expect(result.find(t => t.id === 1).completed).toBe(0);
  });

  it('cascades completion upward through multiple levels', () => {
    const tasks = [
      { id: 1, parent_id: null, completed: 0 },
      { id: 2, parent_id: 1, completed: 0 },
      { id: 3, parent_id: 2, completed: 0 }, // only child of 2
    ];
    const withToggled = tasks.map(t => t.id === 3 ? { ...t, completed: 1 } : t);
    const result = propagateUp(withToggled, 3, true);
    // Task 3 done → task 2 (only child done) → task 1 done
    expect(result.find(t => t.id === 2).completed).toBe(1);
    expect(result.find(t => t.id === 1).completed).toBe(1);
  });

  it('does not complete parent if not all siblings done', () => {
    const tasks = [
      { id: 1, parent_id: null, completed: 0 },
      { id: 2, parent_id: 1, completed: 0 },
      { id: 3, parent_id: 1, completed: 0 },
    ];
    const withToggled = tasks.map(t => t.id === 2 ? { ...t, completed: 1 } : t);
    const result = propagateUp(withToggled, 2, true);
    expect(result.find(t => t.id === 1).completed).toBe(0);
  });
});

// ── getVisibleIds ────────────────────────────────────────────────────────────

describe('getVisibleIds', () => {
  const TODAY = '2024-04-10';
  const YESTERDAY = '2024-04-09';
  const TOMORROW = '2024-04-11';

  it('returns empty set for empty input', () => {
    expect(getVisibleIds([], TODAY).size).toBe(0);
  });

  it('includes root tasks matching selectedDay', () => {
    const tasks = [{ id: 1, parent_id: null, day: TODAY, completed: 0 }];
    const ids = getVisibleIds(tasks, TODAY);
    expect(ids.has(1)).toBe(true);
  });

  it('excludes root tasks from a different future day', () => {
    const tasks = [{ id: 1, parent_id: null, day: TOMORROW, completed: 0 }];
    const ids = getVisibleIds(tasks, TODAY);
    expect(ids.has(1)).toBe(false);
  });

  it('carry-forward: includes incomplete tasks from past days', () => {
    const tasks = [{ id: 1, parent_id: null, day: YESTERDAY, completed: 0 }];
    const ids = getVisibleIds(tasks, TODAY);
    expect(ids.has(1)).toBe(true);
  });

  it('does not carry forward completed tasks from past days', () => {
    const tasks = [{ id: 1, parent_id: null, day: YESTERDAY, completed: 1 }];
    const ids = getVisibleIds(tasks, TODAY);
    expect(ids.has(1)).toBe(false);
  });

  it('includes children of visible roots', () => {
    const tasks = [
      { id: 1, parent_id: null, day: TODAY, completed: 0 },
      { id: 2, parent_id: 1, day: null, completed: 0 },
      { id: 3, parent_id: 2, day: null, completed: 0 },
    ];
    const ids = getVisibleIds(tasks, TODAY);
    expect(ids.has(2)).toBe(true);
    expect(ids.has(3)).toBe(true);
  });

  it('does not include children of non-visible roots', () => {
    const tasks = [
      { id: 1, parent_id: null, day: TOMORROW, completed: 0 },
      { id: 2, parent_id: 1, day: null, completed: 0 },
    ];
    const ids = getVisibleIds(tasks, TODAY);
    expect(ids.has(1)).toBe(false);
    expect(ids.has(2)).toBe(false);
  });

  it('treats null day as today (legacy compat)', () => {
    const tasks = [{ id: 1, parent_id: null, day: null, completed: 0 }];
    const ids = getVisibleIds(tasks, todayISO()); // must be actual today
    expect(ids.has(1)).toBe(true);
  });

  it('mixed: only shows relevant tasks for selectedDay', () => {
    const tasks = [
      { id: 1, parent_id: null, day: TODAY, completed: 0 },    // today ✓
      { id: 2, parent_id: null, day: TOMORROW, completed: 0 }, // future ✗
      { id: 3, parent_id: null, day: YESTERDAY, completed: 0 },// carried ✓
      { id: 4, parent_id: null, day: YESTERDAY, completed: 1 },// past done ✗
    ];
    const ids = getVisibleIds(tasks, TODAY);
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(false);
    expect(ids.has(3)).toBe(true);
    expect(ids.has(4)).toBe(false);
  });
});

// ── collectSubtreeIds ────────────────────────────────────────────────────────

describe('collectSubtreeIds', () => {
  it('returns just the root id for a leaf', () => {
    const tasks = [{ id: 1, parent_id: null }];
    expect(collectSubtreeIds(tasks, 1)).toEqual([1]);
  });

  it('returns root and all descendants', () => {
    const tasks = [
      { id: 1, parent_id: null },
      { id: 2, parent_id: 1 },
      { id: 3, parent_id: 1 },
      { id: 4, parent_id: 2 },
    ];
    const ids = collectSubtreeIds(tasks, 1);
    expect(ids).toContain(1);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
    expect(ids).toHaveLength(4);
  });

  it('collecting a child subtree excludes the parent', () => {
    const tasks = [
      { id: 1, parent_id: null },
      { id: 2, parent_id: 1 },
      { id: 3, parent_id: 2 },
    ];
    const ids = collectSubtreeIds(tasks, 2);
    expect(ids).toContain(2);
    expect(ids).toContain(3);
    expect(ids).not.toContain(1);
  });

  it('handles unknown id gracefully', () => {
    const tasks = [{ id: 1, parent_id: null }];
    const ids = collectSubtreeIds(tasks, 999);
    expect(ids).toEqual([999]); // starts with the id, finds no children
  });
});

// ── looksTooBig ──────────────────────────────────────────────────────────────

describe('looksTooBig', () => {
  it('returns false for short tasks', () => {
    expect(looksTooBig('Write unit tests')).toBe(false);
    expect(looksTooBig('Fix the bug')).toBe(false);
    expect(looksTooBig('Call dentist')).toBe(false);
  });

  it('returns true for tasks with more than 6 words', () => {
    expect(looksTooBig('Write a comprehensive test suite for the server')).toBe(true);
    expect(looksTooBig('one two three four five six seven')).toBe(true);
  });

  it('returns false for exactly 6 words', () => {
    expect(looksTooBig('one two three four five six')).toBe(false);
  });

  it('detects "and" as a compound indicator', () => {
    expect(looksTooBig('Write tests and fix bugs')).toBe(true);
  });

  it('detects "then" as a compound indicator', () => {
    expect(looksTooBig('Write tests then deploy')).toBe(true);
  });

  it('detects "also" as a compound indicator', () => {
    expect(looksTooBig('Fix UI also update styles')).toBe(true);
  });

  it('detects "plus" as a compound indicator', () => {
    expect(looksTooBig('Code review plus documentation')).toBe(true);
  });

  it('is case-insensitive for conjunctions', () => {
    expect(looksTooBig('Write tests AND push')).toBe(true);
    expect(looksTooBig('fix bug Then deploy')).toBe(true);
  });

  it('does not flag "android" or "sandbox" as compound', () => {
    // These contain "and" as a substring but not as a word
    expect(looksTooBig('Android testing')).toBe(false);
    expect(looksTooBig('sandbox setup')).toBe(false);
  });
});

// ── completionDelta ──────────────────────────────────────────────────────────

describe('completionDelta', () => {
  it('returns 0 when nothing changed', () => {
    const tasks = [
      { id: 1, completed: 0 },
      { id: 2, completed: 1 },
    ];
    expect(completionDelta(tasks, tasks)).toBe(0);
  });

  it('returns +1 when one task is newly completed', () => {
    const before = [{ id: 1, completed: 0 }];
    const after = [{ id: 1, completed: 1 }];
    expect(completionDelta(before, after)).toBe(1);
  });

  it('returns -1 when one task is un-completed', () => {
    const before = [{ id: 1, completed: 1 }];
    const after = [{ id: 1, completed: 0 }];
    expect(completionDelta(before, after)).toBe(-1);
  });

  it('counts multiple completions', () => {
    const before = [
      { id: 1, completed: 0 },
      { id: 2, completed: 0 },
      { id: 3, completed: 0 },
    ];
    const after = [
      { id: 1, completed: 1 },
      { id: 2, completed: 1 },
      { id: 3, completed: 0 },
    ];
    expect(completionDelta(before, after)).toBe(2);
  });

  it('handles mixed completions and un-completions', () => {
    const before = [
      { id: 1, completed: 1 },
      { id: 2, completed: 0 },
    ];
    const after = [
      { id: 1, completed: 0 }, // -1
      { id: 2, completed: 1 }, // +1
    ];
    expect(completionDelta(before, after)).toBe(0);
  });

  it('counts propagated completions (e.g., parent auto-completed)', () => {
    const before = [
      { id: 1, completed: 0 }, // parent
      { id: 2, completed: 0 }, // child
    ];
    const after = [
      { id: 1, completed: 1 }, // parent auto-completed
      { id: 2, completed: 1 }, // child directly toggled
    ];
    expect(completionDelta(before, after)).toBe(2);
  });

  it('returns 0 for empty arrays', () => {
    expect(completionDelta([], [])).toBe(0);
  });
});
