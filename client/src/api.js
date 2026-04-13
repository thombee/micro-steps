const BASE = '/api';

export async function fetchTasks() {
  const res = await fetch(`${BASE}/tasks`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function createTask(title, parent_id = null, day = null) {
  const res = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, parent_id, day }),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function updateTask(id, fields) {
  const res = await fetch(`${BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

export async function deleteTask(id) {
  const res = await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
  return res.json(); // { deleted: [...subtree] }
}

export async function restoreTasks(tasks) {
  const res = await fetch(`${BASE}/tasks/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  });
  if (!res.ok) throw new Error('Failed to restore tasks');
  return res.json();
}
