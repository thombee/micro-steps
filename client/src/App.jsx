import { useState, useEffect, useCallback, useRef } from 'react';
import { fireCelebration } from './celebrations';
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
import QuoteRotator from './QuoteRotator';
import ShortcutsHelp from './ShortcutsHelp';

function isEditingText() {
  const el = document.activeElement;
  return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [selectedDay, setSelectedDay] = useState(todayISO);
  const [focusedId, setFocusedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeTimer, setActiveTimer] = useState(null);
  const [sessionCompleted, setSessionCompleted] = useState(0);
  const [deepFocusTaskId, setDeepFocusTaskId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Refs for stale-closure-free handlers
  const tasksRef = useRef(tasks);
  const activeTimerRef = useRef(activeTimer);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const toastTimer = useRef(null);
  const rootInputRef = useRef(null);
  const confettiFiredRef = useRef(false);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { activeTimerRef.current = activeTimer; }, [activeTimer]);
  useEffect(() => { selectedTaskIdRef.current = selectedTaskId; }, [selectedTaskId]);

  // Dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
    setSelectedTaskId(null);
    setSelectedRequest(null);
  }

  // ── Timer handlers ─────────────────────────────────────────────────────────

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
    const prev = activeTimerRef.current;
    if (prev && prev.taskId !== taskId && prev.elapsedSeconds > 0) {
      updateTask(prev.taskId, { time_spent_seconds: prev.elapsedSeconds }).catch(() => {});
      setTasks(pt => pt.map(t =>
        t.id === prev.taskId ? { ...t, time_spent_seconds: prev.elapsedSeconds } : t
      ));
    }
    const task = tasksRef.current.find(t => t.id === taskId);
    const alreadySpent = task?.time_spent_seconds || 0;
    const estimatedSeconds = estimatedMinutes ? Math.round(estimatedMinutes * 60) : 0;
    setActiveTimer({ taskId, estimatedSeconds, elapsedSeconds: alreadySpent, startElapsed: alreadySpent, status: 'running' });
  }, []);

  const handlePauseTimer = useCallback(() => {
    setActiveTimer(prev =>
      prev ? { ...prev, status: prev.status === 'running' ? 'paused' : 'running' } : null
    );
  }, []);

  const handleStopTimer = useCallback(() => {
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
      setSelectedTaskId(saved.id);
      if (looksTooBig(title)) {
        showToast('💡 Try breaking that into smaller steps — tiny tasks are easier to start', null, 6000);
      }
    } catch {
      setTasks(prev => prev.filter(t => t.id !== optimistic.id));
    }
  }, [selectedDay]);

  const handleToggle = useCallback(async (id, completed) => {
    if (completed && activeTimerRef.current?.taskId === id) handleStopTimer();

    setTasks(prev => {
      const withToggled = prev.map(t => t.id === id ? { ...t, completed: completed ? 1 : 0 } : t);
      const after = propagateUp(withToggled, id, completed);
      const delta = completionDelta(prev, after);
      if (delta !== 0) setSessionCompleted(n => Math.max(0, n + delta));
      return after;
    });

    if (completed && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      setTimeout(() => {
        fireCelebration();
        setTimeout(() => { confettiFiredRef.current = false; }, 1500);
      }, 100);
    }

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

  const handleReorder = useCallback(async (orderedIds) => {
    setTasks(prev => {
      const posMap = {};
      orderedIds.forEach((id, idx) => { posMap[String(id)] = idx; });
      return prev.map(t => posMap[String(t.id)] !== undefined ? { ...t, position: posMap[String(t.id)] } : t);
    });
    try {
      await Promise.all(orderedIds.map((id, idx) => updateTask(id, { position: idx })));
    } catch { fetchTasks().then(setTasks); }
  }, []);

  const handleStartDeepFocus = useCallback((id) => { setDeepFocusTaskId(id); setSelectedTaskId(id); }, []);
  const handleZoomIn = useCallback((id) => { setFocusedId(id); setSelectedTaskId(null); }, []);
  const handleSelect = useCallback((id) => { setSelectedTaskId(id); }, []);
  const handleRequestConsumed = useCallback(() => setSelectedRequest(null), []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e) {
      // Help overlay toggle
      if (e.key === '?' && !isEditingText()) {
        e.preventDefault();
        setShowHelp(v => !v);
        return;
      }

      // Escape: deselect + close help
      if (e.key === 'Escape') {
        setShowHelp(false);
        setSelectedTaskId(null);
        setSelectedRequest(null);
        return;
      }

      if (isEditingText()) return;
      if (isDeepFocus) return;

      const selId = selectedTaskIdRef.current;

      // N: focus root input
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        rootInputRef.current?.focus();
        return;
      }

      // Shift+Arrow: reorder within siblings
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.shiftKey && selId) {
        e.preventDefault();
        const task = tasksRef.current.find(t => String(t.id) === String(selId));
        if (!task) return;
        const siblings = tasksRef.current
          .filter(t => t.parent_id === task.parent_id)
          .sort((a, b) => a.position - b.position);
        const idx = siblings.findIndex(t => String(t.id) === String(selId));
        if (idx === -1) return;
        const newIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= siblings.length) return;
        const reordered = [...siblings];
        [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
        handleReorder(reordered.map(t => t.id));
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const rows = Array.from(document.querySelectorAll('.task-row[data-task-id]'));
        const ids = rows.map(el => el.dataset.taskId);
        if (!ids.length) return;
        const currentIdx = selId ? ids.indexOf(String(selId)) : -1;
        let nextIdx;
        if (currentIdx === -1) {
          nextIdx = e.key === 'ArrowDown' ? 0 : ids.length - 1;
        } else {
          nextIdx = e.key === 'ArrowDown'
            ? Math.min(currentIdx + 1, ids.length - 1)
            : Math.max(currentIdx - 1, 0);
        }
        const newId = ids[nextIdx];
        setSelectedTaskId(newId);
        document.querySelector(`.task-row[data-task-id="${newId}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }

      // Right arrow: expand or move into first child
      if (e.key === 'ArrowRight' && selId) {
        e.preventDefault();
        const task = tasksRef.current.find(t => String(t.id) === String(selId));
        if (!task) return;
        const children = tasksRef.current.filter(t => t.parent_id === task.id);
        if (!children.length) return;
        // Check if first child is visible (i.e., expanded)
        const firstChildRow = document.querySelector(`.task-row[data-task-id="${children[0].id}"]`);
        if (firstChildRow) {
          // Already expanded → move into first child
          setSelectedTaskId(String(children[0].id));
          firstChildRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          // Collapsed → expand
          setSelectedRequest('expand');
        }
        return;
      }

      // Left arrow: collapse or jump to parent
      if (e.key === 'ArrowLeft' && selId) {
        e.preventDefault();
        const task = tasksRef.current.find(t => String(t.id) === String(selId));
        if (!task) return;
        const children = tasksRef.current.filter(t => t.parent_id === task.id);
        const firstChildRow = children.length
          ? document.querySelector(`.task-row[data-task-id="${children[0].id}"]`)
          : null;

        if (firstChildRow) {
          // Has visible children → collapse
          setSelectedRequest('collapse');
        } else if (task.parent_id) {
          // No visible children or leaf → jump to parent
          setSelectedTaskId(String(task.parent_id));
          document.querySelector(`.task-row[data-task-id="${task.parent_id}"]`)
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        return;
      }

      if (!selId) return;

      // Enter: add sibling
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        setSelectedRequest('add-sibling');
        return;
      }

      // Shift+Enter: add child
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        setSelectedRequest('add-child');
        return;
      }

      // Space: toggle completion
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (activeTimerRef.current) return; // timer owns Space
        e.preventDefault();
        const task = tasksRef.current.find(t => String(t.id) === String(selId));
        if (task) handleToggle(task.id, !task.completed);
        return;
      }

      // Delete/Backspace: delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete(selId);
        setSelectedTaskId(null);
        return;
      }

      // E or F2: edit title
      if (e.key === 'e' || e.key === 'E' || e.key === 'F2') {
        e.preventDefault();
        setSelectedRequest('edit');
        return;
      }

      // D: deep focus
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleStartDeepFocus(selId);
        return;
      }

      // T: start timer
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const task = tasksRef.current.find(t => String(t.id) === String(selId));
        if (task) handleStartTimer(task.id, task.estimated_minutes);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeepFocus, handleToggle, handleDelete, handleStartDeepFocus, handleStartTimer]);

  // ── Breadcrumbs ────────────────────────────────────────────────────────────

  const breadcrumbs = [];
  let cur = focusedId ? dayTasks.find(t => t.id === focusedId) : null;
  while (cur) {
    breadcrumbs.unshift(cur);
    cur = dayTasks.find(t => t.id === cur.parent_id);
  }

  const activeTimerTask = activeTimer ? tasks.find(t => t.id === activeTimer.taskId) : null;

  return (
    <div className="app" onClick={() => { setSelectedTaskId(null); setSelectedRequest(null); }}>
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">micro-steps</h1>
          <QuoteRotator />
        </div>
        <div className="header-right">
          {(nextUpId || isDeepFocus) && (
            <button
              className={`deep-focus-btn${isDeepFocus ? ' is-active' : ''}`}
              onClick={e => { e.stopPropagation(); isDeepFocus ? setDeepFocusTaskId(null) : setDeepFocusTaskId(nextUpId); }}
              title="Deep focus mode — one task, full attention"
            >
              {isDeepFocus ? '✕ exit focus' : '⊙ deep focus'}
            </button>
          )}
          <div className="header-controls">
            <button
              className={`theme-toggle${darkMode ? ' dark' : ''}`}
              onClick={e => { e.stopPropagation(); setDarkMode(v => !v); }}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <CompletionCounter count={sessionCompleted} />
          </div>
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
          <button className="breadcrumb-btn" onClick={e => { e.stopPropagation(); setFocusedId(null); }}>All tasks</button>
          {breadcrumbs.map((b, i) => (
            <span key={b.id}>
              <span className="breadcrumb-sep">›</span>
              <button
                className="breadcrumb-btn"
                onClick={e => { e.stopPropagation(); setFocusedId(b.id); }}
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
        <main className="app-main" onClick={e => e.stopPropagation()}>
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
            onReorder={handleReorder}
            nextUpId={nextUpId}
            activeTimerId={activeTimer?.taskId ?? null}
            selectedDay={selectedDay}
            isRoot={true}
            parentId={focusedId}
            rootInputRef={rootInputRef}
            selectedTaskId={selectedTaskId}
            onSelect={handleSelect}
            selectedRequest={selectedRequest}
            onRequestConsumed={handleRequestConsumed}
            dayTasks={dayTasks}
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

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
