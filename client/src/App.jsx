import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTasks, createTask, updateTask, deleteTask, restoreTasks } from './api';
import {
  buildTree, findNextUp, propagateUp,
  getVisibleIds, collectSubtreeIds,
  looksTooBig, completionDelta, todayISO,
} from './utils';
import TaskTree from './TaskTree';
import TimerPanel from './TimerPanel';
import CompletionCounter from './CompletionCounter';
import DeepFocus from './DeepFocus';
import DayNav from './DayNav';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [selectedDay, setSelectedDay] = useState(todayISO);
  const [focusedId, setFocusedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null);
  const [sessionCompleted, setSessionCompleted] = useState(0);
  // null = not in deep focus; a task id = focused on that task
  const [deepFocusTaskId, setDeepFocusTaskId] = useState(null);

  // Refs give handlers access to current values without stale closures
  // and without nesting state setters inside other state updaters.
  const tasksRef = useRef(tasks);
  const activeTimerRef = useRef(activeTimer);
  const toastTimer = useRef(null);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { activeTimerRef.current = activeTimer; }, [activeTimer]);

  useEffect(() => {
    fetchTasks().then(flat => setTasks(flat));
  }, []);

  // Global timer tick
  useEffect(() => {
    if (!activeTimer || activeTimer.status !== 'running') return;
    const id = setInterval(() => {
      setActiveTimer(prev => prev ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : null);
    }, 1000);
    return () => clearInterval(id);
  }, [activeTimer?.status]);

  // ── Day-filtered views ─────────────────────────────────────────────────────

  const visibleIds = getVisibleIds(tasks, selectedDay);
  const dayTasks = tasks.filter(t => visibleIds.has(t.id));
  const tree = buildTree(dayTasks);

  const dayRoots = tasks.filter(t => {
    if (t.parent_id !== null && t.parent_id !== undefined) return false;
    return (t.day ?? todayISO()) === selectedDay;
  });
  const carriedRoots = tasks.filter(t => {
    if (t.parent_id !== null && t.parent_id !== undefined) return false;
    const d = t.day ?? todayISO();
    return d < selectedDay && !t.completed;
  });

  const viewRoots = focusedId
    ? (() => {
        const map = {};
        dayTasks.forEach(t => { map[t.id] = { ...t, children: [] }; });
        dayTasks.forEach(t => { if (t.parent_id && map[t.parent_id]) map[t.parent_id].children.push(map[t.id]); });
        return map[focusedId] ? [map[focusedId]] : tree;
      })()
    : tree;

  let nextUpId = null;
  for (const root of viewRoots) {
    const found = findNextUp(root);
    if (found !== null) { nextUpId = found; break; }
  }

  // deepFocusTask is ONLY set when deepFocusTaskId is explicitly set (not a fallback)
  const isDeepFocus = deepFocusTaskId !== null;
  const deepFocusTask = isDeepFocus ? tasks.find(t => t.id === deepFocusTaskId) ?? null : null;

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(message, onUndo, duration = 5000) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, onUndo });
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }

  // ── Day navigation ─────────────────────────────────────────────────────────

  function shiftDay(delta) {
    setSelectedDay(d => {
      const [y, m, day] = d.split('-').map(Number);
      const next = new Date(y, m - 1, day + delta);
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    });
    setFocusedId(null);
    setDeepFocusTaskId(null);
  }

  // ── Timer handlers (no nested state setters — uses refs) ───────────────────

  const stopTimerAndSave = useCallback(async (timer, opts = {}) => {
    if (!timer) return;
    const sessionSeconds = timer.elapsedSeconds - (timer.startElapsed || 0);
    if (timer.elapsedSeconds > 0) {
      try {
        await updateTask(timer.taskId, { time_spent_seconds: timer.elapsedSeconds });
        setTasks(prev => prev.map(t =>
          t.id === timer.taskId ? { ...t, time_spent_seconds: timer.elapsedSeconds } : t
        ));
      } catch { /* non-critical */ }
    }
    if (!opts.silent && sessionSeconds >= 20 * 60) {
      const mins = Math.round(sessionSeconds / 60);
      showToast(`You worked for ${mins} min. Take a 5 min break — your brain needs it 🌿`, null, 8000);
    }
  }, []);

  const handleStartTimer = useCallback((taskId, estimatedMinutes) => {
    // Read current timer from ref — no state updater nesting
    const prev = activeTimerRef.current;
    if (prev && prev.taskId !== taskId && prev.elapsedSeconds > 0) {
      updateTask(prev.taskId, { time_spent_seconds: prev.elapsedSeconds }).catch(() => {});
      setTasks(pt => pt.map(t =>
        t.id === prev.taskId ? { ...t, time_spent_seconds: prev.elapsedSeconds } : t
      ));
    }

    // Read current tasks from ref — no state updater nesting
    const task = tasksRef.current.find(t => t.id === taskId);
    const alreadySpent = task?.time_spent_seconds || 0;
    const estimatedSeconds = estimatedMinutes ? Math.round(estimatedMinutes * 60) : 0;

    setActiveTimer({
      taskId,
      estimatedSeconds,
      elapsedSeconds: alreadySpent,
      startElapsed: alreadySpent,
      status: 'running',
    });
  }, []);

  const handlePauseTimer = useCallback(() => {
    setActiveTimer(prev =>
      prev ? { ...prev, status: prev.status === 'running' ? 'paused' : 'running' } : null
    );
  }, []);

  const handleStopTimer = useCallback(() => {
    // Read from ref — no async call inside state updater
    const timer = activeTimerRef.current;
    setActiveTimer(null);
    if (timer) stopTimerAndSave(timer);
  }, [stopTimerAndSave]);

  const handleSetEstimate = useCallback(async (id, minutes) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, estimated_minutes: minutes } : t));
    try { await updateTask(id, { estimated_minutes: minutes }); }
    catch { fetchTasks().then(setTasks); }
  }, []);

  // ── Task handlers ──────────────────────────────────────────────────────────

  const handleAdd = useCallback(async (title, parent_id = null) => {
    const day = parent_id ? null : selectedDay;
    const optimistic = {
      id: `tmp-${Date.now()}`,
      parent_id,
      title,
      completed: 0,
      position: 9999,
      created_at: new Date().toISOString(),
      estimated_minutes: null,
      time_spent_seconds: 0,
      day,
    };
    setTasks(prev => [...prev, optimistic]);
    try {
      const saved = await createTask(title, parent_id, day);
      setTasks(prev => prev.map(t => t.id === optimistic.id ? saved : t));
      if (looksTooBig(title)) {
        showToast('💡 Try breaking that into smaller steps — tiny tasks are easier to start', null, 6000);
      }
    } catch {
      setTasks(prev => prev.filter(t => t.id !== optimistic.id));
    }
  }, [selectedDay]);

  const handleToggle = useCallback(async (id, completed) => {
    // Stop timer if completing its task
    if (completed && activeTimerRef.current?.taskId === id) handleStopTimer();

    setTasks(prev => {
      const withToggled = prev.map(t => t.id === id ? { ...t, completed: completed ? 1 : 0 } : t);
      const after = propagateUp(withToggled, id, completed);
      const delta = completionDelta(prev, after);
      if (delta !== 0) setSessionCompleted(n => Math.max(0, n + delta));
      return after;
    });

    try { await updateTask(id, { completed }); }
    catch { fetchTasks().then(setTasks); }
  }, [handleStopTimer]);

  const handleEdit = useCallback(async (id, title) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    try { await updateTask(id, { title }); }
    catch { fetchTasks().then(setTasks); }
  }, []);

  const handleDelete = useCallback(async (id) => {
    const currentTasks = tasksRef.current;
    const subtreeIds = collectSubtreeIds(currentTasks, id);
    const subtreeSnap = currentTasks.filter(t => subtreeIds.includes(t.id));

    if (activeTimerRef.current && subtreeIds.includes(activeTimerRef.current.taskId)) {
      setActiveTimer(null);
    }
    if (deepFocusTaskId && subtreeIds.includes(deepFocusTaskId)) setDeepFocusTaskId(null);
    setTasks(prev => prev.filter(t => !subtreeIds.includes(t.id)));
    if (focusedId && subtreeIds.includes(focusedId)) setFocusedId(null);

    try {
      const { deleted } = await deleteTask(id);
      showToast(`Deleted "${subtreeSnap[0]?.title}"`, async () => {
        await restoreTasks(deleted);
        fetchTasks().then(setTasks);
        setToast(null);
      });
    } catch { fetchTasks().then(setTasks); }
  }, [focusedId, deepFocusTaskId]);

  const handleStartDeepFocus = useCallback((id) => { setDeepFocusTaskId(id); }, []);
  const handleZoomIn = useCallback((id) => { setFocusedId(id); }, []);

  // Breadcrumb trail
  const breadcrumbs = [];
  let cur = focusedId ? dayTasks.find(t => t.id === focusedId) : null;
  while (cur) {
    breadcrumbs.unshift(cur);
    cur = dayTasks.find(t => t.id === cur.parent_id);
  }

  const activeTimerTask = activeTimer ? tasks.find(t => t.id === activeTimer.taskId) : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">micro-steps</h1>
          <p className="app-subtitle">break it down until it's easy</p>
        </div>
        <div className="header-right">
          {(nextUpId || isDeepFocus) && (
            <button
              className={`deep-focus-btn${isDeepFocus ? ' is-active' : ''}`}
              onClick={() => isDeepFocus ? setDeepFocusTaskId(null) : setDeepFocusTaskId(nextUpId)}
              title="Deep focus mode — one task, full attention"
            >
              {isDeepFocus ? '✕ exit focus' : '⊙ deep focus'}
            </button>
          )}
          <CompletionCounter count={sessionCompleted} />
        </div>
      </header>

      <DayNav
        selectedDay={selectedDay}
        onPrev={() => shiftDay(-1)}
        onNext={() => shiftDay(1)}
        taskCount={dayRoots.length}
        carriedCount={carriedRoots.length}
      />

      {breadcrumbs.length > 0 && !isDeepFocus && (
        <nav className="breadcrumbs">
          <button className="breadcrumb-btn" onClick={() => setFocusedId(null)}>All tasks</button>
          {breadcrumbs.map((b, i) => (
            <span key={b.id}>
              <span className="breadcrumb-sep">›</span>
              <button
                className="breadcrumb-btn"
                onClick={() => setFocusedId(b.id)}
                style={{ fontWeight: i === breadcrumbs.length - 1 ? 600 : 400 }}
              >
                {b.title}
              </button>
            </span>
          ))}
        </nav>
      )}

      {isDeepFocus && deepFocusTask ? (
        <DeepFocus
          task={deepFocusTask}
          onComplete={(id) => { handleToggle(id, true); setDeepFocusTaskId(null); }}
          onExit={() => setDeepFocusTaskId(null)}
          onStartTimer={handleStartTimer}
          onSetEstimate={handleSetEstimate}
          activeTimer={activeTimer}
          onPauseTimer={handlePauseTimer}
          onStopTimer={handleStopTimer}
        />
      ) : (
        <main className="app-main">
          <TaskTree
            tasks={viewRoots}
            onAdd={handleAdd}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStartDeepFocus={handleStartDeepFocus}
            onZoomIn={handleZoomIn}
            onStartTimer={handleStartTimer}
            onSetEstimate={handleSetEstimate}
            nextUpId={nextUpId}
            activeTimerId={activeTimer?.taskId ?? null}
            selectedDay={selectedDay}
            isRoot={true}
            parentId={focusedId}
          />
        </main>
      )}

      {activeTimer && activeTimerTask && (
        <TimerPanel
          activeTimer={activeTimer}
          taskTitle={activeTimerTask.title}
          onPause={handlePauseTimer}
          onStop={handleStopTimer}
          draggable
          style={isDeepFocus ? { display: 'none' } : undefined}
        />
      )}

      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          {toast.onUndo && <button className="toast-undo" onClick={toast.onUndo}>Undo</button>}
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}
