import { useState, useRef, useEffect } from 'react';
import TaskTree from './TaskTree';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${SHORT_DAYS[date.getDay()]} ${SHORT_MONTHS[m - 1]} ${d}`;
}

function getProgress(task) {
  const children = task.children || [];
  if (children.length === 0) return null;
  const done = children.filter(c => c.completed).length;
  return { done, total: children.length };
}

function formatSpent(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export default function TaskItem({
  task,
  onAdd, onToggle, onEdit, onDelete,
  onStartDeepFocus, onZoomIn,
  onStartTimer, onSetEstimate,
  nextUpId, activeTimerId, selectedDay,
  depth = 0,
}) {
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [addingChild, setAddingChild] = useState(false);
  const [childInput, setChildInput] = useState('');
  const [justCompleted, setJustCompleted] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [estimateInput, setEstimateInput] = useState('');
  const [promptingEstimate, setPromptingEstimate] = useState(false);
  const [promptInput, setPromptInput] = useState('25');

  const editRef = useRef(null);
  const childInputRef = useRef(null);
  const estimateRef = useRef(null);
  const promptRef = useRef(null);

  const children = task.children || [];
  const hasChildren = children.length > 0;
  const progress = getProgress(task);
  const isNextUp = task.id === nextUpId;
  const isActiveTimer = task.id === activeTimerId;
  const isTopLevel = depth === 0;

  // Carried-over indicator: task was created on a past day
  const isCarried = task.parent_id === null && task.day && task.day < selectedDay && !task.completed;

  useEffect(() => { setEditValue(task.title); }, [task.title]);

  useEffect(() => {
    if (task.completed && hasChildren) {
      const t = setTimeout(() => setExpanded(false), 400);
      return () => clearTimeout(t);
    } else if (!task.completed) {
      setExpanded(true);
    }
  }, [task.completed]);

  function handleCheckbox(e) {
    const checked = e.target.checked;
    setJustCompleted(checked);
    if (checked) setTimeout(() => setJustCompleted(false), 600);
    onToggle(task.id, checked);
  }

  function handleTitleClick() {
    setIsEditing(true);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 0);
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditValue(task.title); setIsEditing(false); }
  }

  function commitEdit() {
    const val = editValue.trim();
    if (val && val !== task.title) onEdit(task.id, val);
    else setEditValue(task.title);
    setIsEditing(false);
  }

  function handleAddChild(e) {
    e.preventDefault();
    const title = childInput.trim();
    if (!title) { setAddingChild(false); return; }
    onAdd(title, task.id);
    setChildInput('');
    setAddingChild(false);
    setExpanded(true);
  }

  function startAddingChild() {
    setAddingChild(true);
    setExpanded(true);
    setTimeout(() => childInputRef.current?.focus(), 0);
  }

  function handleChildInputKeyDown(e) {
    if (e.key === 'Escape') { setAddingChild(false); setChildInput(''); }
  }

  function startEditingEstimate() {
    setEstimateInput(task.estimated_minutes != null ? String(task.estimated_minutes) : '');
    setEditingEstimate(true);
    setTimeout(() => { estimateRef.current?.focus(); estimateRef.current?.select(); }, 0);
  }

  function commitEstimate() {
    const val = parseInt(estimateInput, 10);
    if (!isNaN(val) && val > 0) onSetEstimate(task.id, val);
    setEditingEstimate(false);
  }

  function handleEstimateKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitEstimate(); }
    if (e.key === 'Escape') setEditingEstimate(false);
  }

  function handleTimerClick() {
    if (isActiveTimer) return;
    if (task.estimated_minutes) {
      onStartTimer(task.id, task.estimated_minutes);
    } else {
      setPromptingEstimate(true);
      setPromptInput('25');
      setTimeout(() => { promptRef.current?.focus(); promptRef.current?.select(); }, 0);
    }
  }

  function handlePromptSubmit(e) {
    e.preventDefault();
    const val = parseInt(promptInput, 10);
    const minutes = (!isNaN(val) && val > 0) ? val : null;
    setPromptingEstimate(false);
    if (minutes) onSetEstimate(task.id, minutes);
    onStartTimer(task.id, minutes);
  }

  function handlePromptKeyDown(e) {
    if (e.key === 'Escape') setPromptingEstimate(false);
  }

  const completedClass = task.completed ? ' completed' : '';
  const nextUpClass = isNextUp ? ' next-up' : '';
  const animClass = justCompleted ? ' just-completed' : '';
  const activeTimerClass = isActiveTimer ? ' has-active-timer' : '';
  const topLevelClass = isTopLevel ? ' top-level' : '';
  const spentLabel = formatSpent(task.time_spent_seconds);

  return (
    <div className={`task-item${completedClass}${nextUpClass}${animClass}${activeTimerClass}${topLevelClass}`} style={{ '--depth': depth }}>
      <div className="task-row">
        <button
          className={`expand-btn${hasChildren ? '' : ' invisible'}`}
          onClick={() => setExpanded(e => !e)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          tabIndex={hasChildren ? 0 : -1}
        >
          <span className={`chevron${expanded ? ' open' : ''}`}>›</span>
        </button>

        {isActiveTimer && <span className="timer-badge" title="Timer running" />}

        <label className="checkbox-wrap" aria-label="Complete task">
          <input type="checkbox" checked={!!task.completed} onChange={handleCheckbox} className="checkbox" />
          <span className="checkbox-custom" />
        </label>

        <div className="task-title-area">
          {isEditing ? (
            <input
              ref={editRef}
              className="task-edit-input"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKeyDown}
            />
          ) : (
            <span className="task-title" onClick={handleTitleClick} title="Click to edit">
              {task.title}
            </span>
          )}

          {/* Carry-forward label */}
          {isCarried && (
            <span className="carry-label">from {shortDate(task.day)}</span>
          )}

          {progress && (
            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <span className="progress-label">{progress.done}/{progress.total}</span>
            </div>
          )}
        </div>

        {/* Estimate + time spent */}
        <div className="task-meta">
          {editingEstimate ? (
            <input
              ref={estimateRef}
              type="number" min="1" max="480"
              className="estimate-input"
              value={estimateInput}
              onChange={e => setEstimateInput(e.target.value)}
              onBlur={commitEstimate}
              onKeyDown={handleEstimateKeyDown}
              placeholder="min"
            />
          ) : task.estimated_minutes ? (
            <button className="estimate-display" onClick={startEditingEstimate} title="Edit estimate">
              ~{task.estimated_minutes}m
            </button>
          ) : (
            <button className="estimate-display estimate-empty" onClick={startEditingEstimate} title="Set time estimate">
              +est
            </button>
          )}
          {spentLabel && !isActiveTimer && (
            <span className="time-spent" title="Time spent">{spentLabel}</span>
          )}
        </div>

        {/* Actions */}
        <div className="task-actions">
          <button
            className={`action-btn timer-start-btn${isActiveTimer ? ' is-active' : ''}`}
            onClick={handleTimerClick}
            title={isActiveTimer ? 'Timer running' : 'Start timer'}
          >
            {isActiveTimer ? '⏱' : '▷'}
          </button>
          <button
            className="action-btn focus-btn"
            onClick={() => onStartDeepFocus(task.id)}
            title="Deep focus on this task"
          >
            ⊙
          </button>
          <button
            className="action-btn zoom-btn"
            onClick={() => onZoomIn(task.id)}
            title="Zoom into subtree"
          >
            ⤢
          </button>
          <button
            className="action-btn add-btn"
            onClick={startAddingChild}
            title="Add sub-task"
          >
            +
          </button>
          <button
            className="action-btn delete-btn"
            onClick={() => onDelete(task.id)}
            title="Delete task"
          >
            ×
          </button>
        </div>
      </div>

      {promptingEstimate && (
        <form className="child-add-form" onSubmit={handlePromptSubmit}>
          <div className="prompt-row">
            <span className="prompt-label">How many minutes?</span>
            <input
              ref={promptRef}
              type="number" min="1" max="480"
              className="child-add-input prompt-input"
              value={promptInput}
              onChange={e => setPromptInput(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              placeholder="25"
            />
            <button type="submit" className="root-add-btn prompt-go-btn">Start</button>
            <button
              type="button"
              className="action-btn delete-btn"
              onClick={() => { setPromptingEstimate(false); onStartTimer(task.id, null); }}
            >
              Skip
            </button>
          </div>
        </form>
      )}

      {addingChild && (
        <form className="child-add-form" onSubmit={handleAddChild}>
          <input
            ref={childInputRef}
            className="child-add-input"
            placeholder="New sub-task… (Enter to save)"
            value={childInput}
            onChange={e => setChildInput(e.target.value)}
            onKeyDown={handleChildInputKeyDown}
          />
        </form>
      )}

      {hasChildren && expanded && (
        <div className="task-children">
          {children.map(child => (
            <TaskItem
              key={child.id}
              task={child}
              onAdd={onAdd}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onStartDeepFocus={onStartDeepFocus}
              onZoomIn={onZoomIn}
              onStartTimer={onStartTimer}
              onSetEstimate={onSetEstimate}
              nextUpId={nextUpId}
              activeTimerId={activeTimerId}
              selectedDay={selectedDay}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
