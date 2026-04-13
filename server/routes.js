const express = require('express');
const db = require('./db');
const router = express.Router();

// GET /api/tasks — return all tasks flat
router.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY parent_id, position, created_at').all();
  res.json(tasks);
});

// POST /api/tasks — create a task
router.post('/tasks', (req, res) => {
  const { title, parent_id = null, day = null } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });

  // Validate parent exists if provided
  if (parent_id !== null && parent_id !== undefined) {
    const parent = db.prepare('SELECT id FROM tasks WHERE id = ?').get(parent_id);
    if (!parent) return res.status(404).json({ error: 'parent not found' });
  }

  // Position: count of siblings
  const { count } = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE parent_id IS ?').get(parent_id ?? null);

  const result = db.prepare(
    'INSERT INTO tasks (title, parent_id, position, day) VALUES (?, ?, ?, ?)'
  ).run(title.trim(), parent_id ?? null, count, day);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id — update title or completed
router.patch('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const title = req.body.title !== undefined ? req.body.title.trim() : task.title;
  const completed = req.body.completed !== undefined ? (req.body.completed ? 1 : 0) : task.completed;
  const estimated_minutes = req.body.estimated_minutes !== undefined ? req.body.estimated_minutes : task.estimated_minutes;
  const time_spent_seconds = req.body.time_spent_seconds !== undefined ? req.body.time_spent_seconds : task.time_spent_seconds;
  const day = req.body.day !== undefined ? req.body.day : task.day;

  db.prepare(
    'UPDATE tasks SET title = ?, completed = ?, estimated_minutes = ?, time_spent_seconds = ?, day = ? WHERE id = ?'
  ).run(title, completed, estimated_minutes, time_spent_seconds, day, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/tasks/:id — delete task + all descendants (cascade)
router.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  // Collect full subtree for undo response
  const subtree = collectSubtree(Number(id));
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ deleted: subtree });
});

// POST /api/tasks/restore — restore a deleted subtree (undo)
router.post('/tasks/restore', (req, res) => {
  const { tasks } = req.body;
  if (!Array.isArray(tasks) || tasks.length === 0) return res.status(400).json({ error: 'tasks required' });

  const insert = db.prepare(
    'INSERT INTO tasks (id, parent_id, title, completed, position, created_at, estimated_minutes, time_spent_seconds, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const restoreAll = db.transaction((tasks) => {
    for (const t of tasks) {
      insert.run(t.id, t.parent_id, t.title, t.completed, t.position, t.created_at, t.estimated_minutes ?? null, t.time_spent_seconds ?? 0, t.day ?? null);
    }
  });

  try {
    restoreAll(tasks);
    res.json({ restored: tasks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function collectSubtree(rootId) {
  const all = db.prepare('SELECT * FROM tasks').all();
  const result = [];
  const queue = [rootId];
  const map = Object.fromEntries(all.map(t => [t.id, t]));

  while (queue.length) {
    const id = queue.shift();
    const task = map[id];
    if (!task) continue;
    result.push(task);
    all.filter(t => t.parent_id === id).forEach(child => queue.push(child.id));
  }
  return result;
}

module.exports = router;
