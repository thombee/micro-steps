// Server API tests — Node built-in test runner
// Run: node --test server/test.js

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const express = require('express');
const http = require('node:http');

// ── In-memory DB setup ──────────────────────────────────────────────────────

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id  INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      completed  INTEGER DEFAULT 0,
      position   INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      estimated_minutes INTEGER DEFAULT NULL,
      time_spent_seconds INTEGER DEFAULT 0,
      day        TEXT DEFAULT NULL
    );
  `);
  return db;
}

// Inject the in-memory DB before routes.js is loaded
const testDb = createTestDb();
require.cache[require.resolve('./db')] = { id: require.resolve('./db'), exports: testDb };

// Now load routes (will use the injected db)
const routes = require('./routes');

// ── Test server ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api', routes);

let server;
let base;

before(() => new Promise(resolve => {
  server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${server.address().port}/api`;
    resolve();
  });
}));

after(() => new Promise(resolve => server.close(resolve)));

// Clear all tasks between tests (sqlite_sequence only exists after first AUTOINCREMENT insert)
beforeEach(() => {
  testDb.exec('DELETE FROM tasks');
  try { testDb.exec("DELETE FROM sqlite_sequence WHERE name='tasks'"); } catch (_) {}
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function get(path) {
  const r = await fetch(`${base}${path}`);
  return { status: r.status, body: await r.json() };
}

async function post(path, data) {
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return { status: r.status, body: await r.json() };
}

async function patch(path, data) {
  const r = await fetch(`${base}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return { status: r.status, body: await r.json() };
}

async function del(path) {
  const r = await fetch(`${base}${path}`, { method: 'DELETE' });
  return { status: r.status, body: await r.json() };
}

// ── GET /api/tasks ───────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
  test('returns empty array when no tasks', async () => {
    const { status, body } = await get('/tasks');
    assert.equal(status, 200);
    assert.deepEqual(body, []);
  });

  test('returns all tasks flat', async () => {
    await post('/tasks', { title: 'Task A', day: '2024-01-01' });
    await post('/tasks', { title: 'Task B', day: '2024-01-01' });
    const { status, body } = await get('/tasks');
    assert.equal(status, 200);
    assert.equal(body.length, 2);
    assert.equal(body[0].title, 'Task A');
    assert.equal(body[1].title, 'Task B');
  });

  test('returned tasks include all expected fields', async () => {
    await post('/tasks', { title: 'Test', day: '2024-01-01' });
    const { body } = await get('/tasks');
    const task = body[0];
    assert.ok('id' in task);
    assert.ok('parent_id' in task);
    assert.ok('title' in task);
    assert.ok('completed' in task);
    assert.ok('position' in task);
    assert.ok('created_at' in task);
    assert.ok('estimated_minutes' in task);
    assert.ok('time_spent_seconds' in task);
    assert.ok('day' in task);
  });
});

// ── POST /api/tasks ──────────────────────────────────────────────────────────

describe('POST /api/tasks', () => {
  test('creates a root task', async () => {
    const { status, body } = await post('/tasks', { title: 'Root task', day: '2024-01-15' });
    assert.equal(status, 201);
    assert.equal(body.title, 'Root task');
    assert.equal(body.parent_id, null);
    assert.equal(body.day, '2024-01-15');
    assert.equal(body.completed, 0);
    assert.ok(body.id > 0);
  });

  test('creates a child task with valid parent', async () => {
    const { body: parent } = await post('/tasks', { title: 'Parent', day: '2024-01-15' });
    const { status, body: child } = await post('/tasks', { title: 'Child', parent_id: parent.id });
    assert.equal(status, 201);
    assert.equal(child.parent_id, parent.id);
    assert.equal(child.title, 'Child');
  });

  test('rejects missing title', async () => {
    const { status, body } = await post('/tasks', { day: '2024-01-15' });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('rejects empty title', async () => {
    const { status, body } = await post('/tasks', { title: '   ' });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('rejects invalid parent_id', async () => {
    const { status, body } = await post('/tasks', { title: 'Orphan', parent_id: 99999 });
    assert.equal(status, 404);
    assert.ok(body.error);
  });

  test('trims whitespace from title', async () => {
    const { body } = await post('/tasks', { title: '  padded title  ' });
    assert.equal(body.title, 'padded title');
  });

  test('assigns positions sequentially to siblings', async () => {
    const { body: a } = await post('/tasks', { title: 'A', day: '2024-01-01' });
    const { body: b } = await post('/tasks', { title: 'B', day: '2024-01-01' });
    const { body: c } = await post('/tasks', { title: 'C', day: '2024-01-01' });
    // Root siblings: positions 0, 1, 2
    assert.equal(a.position, 0);
    assert.equal(b.position, 1);
    assert.equal(c.position, 2);
  });

  test('stores null day when omitted', async () => {
    const { body } = await post('/tasks', { title: 'No day' });
    assert.equal(body.day, null);
  });
});

// ── PATCH /api/tasks/:id ─────────────────────────────────────────────────────

describe('PATCH /api/tasks/:id', () => {
  test('updates title', async () => {
    const { body: task } = await post('/tasks', { title: 'Old title' });
    const { status, body } = await patch(`/tasks/${task.id}`, { title: 'New title' });
    assert.equal(status, 200);
    assert.equal(body.title, 'New title');
  });

  test('updates completed flag', async () => {
    const { body: task } = await post('/tasks', { title: 'Task' });
    const { body } = await patch(`/tasks/${task.id}`, { completed: true });
    assert.equal(body.completed, 1);
  });

  test('updates estimated_minutes', async () => {
    const { body: task } = await post('/tasks', { title: 'Task' });
    const { body } = await patch(`/tasks/${task.id}`, { estimated_minutes: 30 });
    assert.equal(body.estimated_minutes, 30);
  });

  test('updates time_spent_seconds', async () => {
    const { body: task } = await post('/tasks', { title: 'Task' });
    const { body } = await patch(`/tasks/${task.id}`, { time_spent_seconds: 1800 });
    assert.equal(body.time_spent_seconds, 1800);
  });

  test('updates day field', async () => {
    const { body: task } = await post('/tasks', { title: 'Task', day: '2024-01-01' });
    const { body } = await patch(`/tasks/${task.id}`, { day: '2024-01-02' });
    assert.equal(body.day, '2024-01-02');
  });

  test('partial update preserves other fields', async () => {
    const { body: task } = await post('/tasks', { title: 'Title', day: '2024-01-01' });
    await patch(`/tasks/${task.id}`, { estimated_minutes: 25 });
    const { body } = await patch(`/tasks/${task.id}`, { title: 'Updated' });
    assert.equal(body.title, 'Updated');
    assert.equal(body.estimated_minutes, 25);
    assert.equal(body.day, '2024-01-01');
  });

  test('returns 404 for unknown id', async () => {
    const { status, body } = await patch('/tasks/99999', { title: 'X' });
    assert.equal(status, 404);
    assert.ok(body.error);
  });

  test('can uncheck a completed task', async () => {
    const { body: task } = await post('/tasks', { title: 'Task' });
    await patch(`/tasks/${task.id}`, { completed: true });
    const { body } = await patch(`/tasks/${task.id}`, { completed: false });
    assert.equal(body.completed, 0);
  });
});

// ── DELETE /api/tasks/:id ────────────────────────────────────────────────────

describe('DELETE /api/tasks/:id', () => {
  test('deletes a single task', async () => {
    const { body: task } = await post('/tasks', { title: 'To delete' });
    const { status, body } = await del(`/tasks/${task.id}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.deleted));
    assert.equal(body.deleted.length, 1);
    assert.equal(body.deleted[0].id, task.id);

    const { body: all } = await get('/tasks');
    assert.equal(all.length, 0);
  });

  test('cascade deletes children', async () => {
    const { body: parent } = await post('/tasks', { title: 'Parent' });
    const { body: child1 } = await post('/tasks', { title: 'Child 1', parent_id: parent.id });
    await post('/tasks', { title: 'Grandchild', parent_id: child1.id });
    await post('/tasks', { title: 'Child 2', parent_id: parent.id });

    const { body } = await del(`/tasks/${parent.id}`);
    assert.equal(body.deleted.length, 4); // parent + 2 children + 1 grandchild

    const { body: all } = await get('/tasks');
    assert.equal(all.length, 0);
  });

  test('returns full subtree in deleted array', async () => {
    const { body: parent } = await post('/tasks', { title: 'P', day: '2024-01-01' });
    const { body: child } = await post('/tasks', { title: 'C', parent_id: parent.id });
    const { body } = await del(`/tasks/${parent.id}`);
    const ids = body.deleted.map(t => t.id);
    assert.ok(ids.includes(parent.id));
    assert.ok(ids.includes(child.id));
  });

  test('deleting child does not affect siblings', async () => {
    const { body: parent } = await post('/tasks', { title: 'Parent' });
    const { body: child1 } = await post('/tasks', { title: 'Child 1', parent_id: parent.id });
    const { body: child2 } = await post('/tasks', { title: 'Child 2', parent_id: parent.id });

    await del(`/tasks/${child1.id}`);
    const { body: all } = await get('/tasks');
    assert.equal(all.length, 2);
    assert.ok(all.some(t => t.id === parent.id));
    assert.ok(all.some(t => t.id === child2.id));
  });
});

// ── POST /api/tasks/restore ──────────────────────────────────────────────────

describe('POST /api/tasks/restore', () => {
  test('restores a deleted task', async () => {
    const { body: task } = await post('/tasks', { title: 'Restore me', day: '2024-01-01' });
    const { body: deleted } = await del(`/tasks/${task.id}`);

    const { status, body } = await post('/tasks/restore', { tasks: deleted.deleted });
    assert.equal(status, 200);
    assert.equal(body.restored, 1);

    const { body: all } = await get('/tasks');
    assert.equal(all.length, 1);
    assert.equal(all[0].title, 'Restore me');
  });

  test('restores full subtree', async () => {
    const { body: parent } = await post('/tasks', { title: 'P' });
    const { body: child } = await post('/tasks', { title: 'C', parent_id: parent.id });
    const { body: deleted } = await del(`/tasks/${parent.id}`);

    await post('/tasks/restore', { tasks: deleted.deleted });
    const { body: all } = await get('/tasks');
    assert.equal(all.length, 2);
    assert.ok(all.some(t => t.title === 'P'));
    assert.ok(all.some(t => t.title === 'C'));
    // Parent-child relationship preserved
    const restoredChild = all.find(t => t.title === 'C');
    const restoredParent = all.find(t => t.title === 'P');
    assert.equal(restoredChild.parent_id, restoredParent.id);
  });

  test('rejects empty tasks array', async () => {
    const { status, body } = await post('/tasks/restore', { tasks: [] });
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('rejects missing tasks field', async () => {
    const { status, body } = await post('/tasks/restore', {});
    assert.equal(status, 400);
    assert.ok(body.error);
  });

  test('preserves all fields on restore', async () => {
    const { body: task } = await post('/tasks', { title: 'Full', day: '2024-03-15' });
    await patch(`/tasks/${task.id}`, { estimated_minutes: 45, time_spent_seconds: 900, completed: true });
    const { body: deleted } = await del(`/tasks/${task.id}`);

    await post('/tasks/restore', { tasks: deleted.deleted });
    const { body: all } = await get('/tasks');
    const restored = all[0];
    assert.equal(restored.title, 'Full');
    assert.equal(restored.day, '2024-03-15');
    assert.equal(restored.estimated_minutes, 45);
    assert.equal(restored.time_spent_seconds, 900);
    assert.equal(restored.completed, 1);
    assert.equal(restored.id, task.id); // same id
  });
});

// ── Day field behaviour ──────────────────────────────────────────────────────

describe('Day field', () => {
  test('creates task with specific day', async () => {
    const { body } = await post('/tasks', { title: 'Day task', day: '2024-06-15' });
    assert.equal(body.day, '2024-06-15');
  });

  test('tasks for different days are all returned', async () => {
    await post('/tasks', { title: 'Mon task', day: '2024-01-08' });
    await post('/tasks', { title: 'Tue task', day: '2024-01-09' });
    await post('/tasks', { title: 'Wed task', day: '2024-01-10' });
    const { body } = await get('/tasks');
    assert.equal(body.length, 3);
  });

  test('null day tasks coexist with dated tasks', async () => {
    await post('/tasks', { title: 'No day' });
    await post('/tasks', { title: 'Has day', day: '2024-01-01' });
    const { body } = await get('/tasks');
    assert.equal(body.length, 2);
    assert.equal(body.find(t => t.title === 'No day').day, null);
  });
});

// ── Round-trip / integration ─────────────────────────────────────────────────

describe('Round-trip integration', () => {
  test('create → read → update → delete lifecycle', async () => {
    // Create
    const { body: created } = await post('/tasks', { title: 'Lifecycle', day: '2024-01-01' });
    assert.equal(created.title, 'Lifecycle');

    // Read
    const { body: all } = await get('/tasks');
    assert.equal(all.length, 1);

    // Update
    const { body: updated } = await patch(`/tasks/${created.id}`, { title: 'Updated', completed: true });
    assert.equal(updated.title, 'Updated');
    assert.equal(updated.completed, 1);

    // Delete
    const { body: deleted } = await del(`/tasks/${created.id}`);
    assert.equal(deleted.deleted.length, 1);

    // Confirm gone
    const { body: empty } = await get('/tasks');
    assert.equal(empty.length, 0);
  });

  test('delete → restore → delete again', async () => {
    const { body: task } = await post('/tasks', { title: 'Repeatable', day: '2024-01-01' });
    const { body: del1 } = await del(`/tasks/${task.id}`);
    await post('/tasks/restore', { tasks: del1.deleted });

    const { body: all } = await get('/tasks');
    assert.equal(all.length, 1);

    const { body: del2 } = await del(`/tasks/${all[0].id}`);
    assert.equal(del2.deleted.length, 1);

    const { body: empty } = await get('/tasks');
    assert.equal(empty.length, 0);
  });

  test('deep subtree cascade and restore', async () => {
    // Build: root → child → grandchild → great-grandchild
    const { body: root } = await post('/tasks', { title: 'Root' });
    const { body: child } = await post('/tasks', { title: 'Child', parent_id: root.id });
    const { body: gc } = await post('/tasks', { title: 'Grandchild', parent_id: child.id });
    const { body: ggc } = await post('/tasks', { title: 'Great-grandchild', parent_id: gc.id });

    const { body: deleted } = await del(`/tasks/${root.id}`);
    assert.equal(deleted.deleted.length, 4);

    await post('/tasks/restore', { tasks: deleted.deleted });
    const { body: all } = await get('/tasks');
    assert.equal(all.length, 4);

    // Verify hierarchy
    const rRoot = all.find(t => t.title === 'Root');
    const rChild = all.find(t => t.title === 'Child');
    const rGc = all.find(t => t.title === 'Grandchild');
    const rGgc = all.find(t => t.title === 'Great-grandchild');
    assert.equal(rChild.parent_id, rRoot.id);
    assert.equal(rGc.parent_id, rChild.id);
    assert.equal(rGgc.parent_id, rGc.id);
  });
});
