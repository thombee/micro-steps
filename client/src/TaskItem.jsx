import { useState, useRef, useEffect } from 'react';

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
  onStartTimer, onSetEstimate, onReorder,
  nextUpId, activeTimerId, selectedDay,
  depth = 0,
  selectedTaskId, onSelect, selectedRequest, onRequestConsumed,
}) {
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [addingChild, setAddingChild] = useState(false);
  const [childInput, setChildInput] = useState('');
  const [siblingFormOpen, setSiblingFormOpen] = useState(false);
  const [siblingInput, setSiblingInput] = useState('');
  const [justCompleted, setJustCompleted] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [estimateInput, setEstimateInput] = useState('');
  const [promptingEstimate, setPromptingEstimate] = useState(false);
  const [promptInput, setPromptInput] = useState('25');

  const editRef = useRef(null);
  const childInputRef = useRef(null);
  const siblingInputRef = useRef(null);
  const estimateRef = useRef(null);
  const promptRef = useRef(null);

  const children = task.children || [];
  const hasChildren = children.length > 0;
  const progress = getProgress(task);
  const isNextUp = task.id === nextUpId;
  const isActiveTimer = task.id === activeTimerId;
  const isTopLevel = depth === 0;
  const isSelected = String(task.id) === String(selectedTaskId);
  const myRequest = isSelected ? selectedRequest : null;
  const isCarried = task.parent_id === null && task.day && task.day < selectedDay && !task.completed;

  useEffect(() => { setEditValue(task.title); }, [task.title]);

  const prevCompletedRef = useRef(task.completed);
  useEffect(() => {
    const wasCompleted = prevCompletedRef.current;
    prevCompletedRef.current = task.completed;
    // Only auto-collapse when transitioning to completed, not on initial render
    if (task.completed && !wasCompleted && hasChildren) {
      const t = setTimeout(() => setExpanded(false), 400);
      return () => clearTimeout(t);
    } else if (!task.completed && wasCompleted) {
      setExpanded(true);
    }
  }, [task.completed]);

  // Handle requests from App keyboard shortcuts
  useEffect(() => {
    if (!myRequest) return;
    if (myRequest === 'edit') { handleTitleClick(); onRequestConsumed(); }
    else if (myRequest === 'add-child') { startAddingChild(); onRequestConsumed(); }
    else if (myRequest === 'add-sibling') {
      setSiblingFormOpen(true);
      setSiblingInput('');
      onRequestConsumed();
      setTimeout(() => siblingInputRef.current?.focus(), 0);
    }
    else if (myRequest === 'expand') { setExpanded(true); onRequestConsumed(); }
    else if (myRequest === 'collapse') { setExpanded(false); onRequestConsumed(); }
  }, [myRequest]);

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

  function handleAddSibling(e) {
    e.preventDefault();
    const title = siblingInput.trim();
    if (!title) { setSiblingFormOpen(false); return; }
    onAdd(title, task.parent_id ?? null);
    setSiblingInput('');
    setSiblingFormOpen(false);
  }

  function handleSiblingKeyDown(e) {
    if (e.key === 'Escape') { setSiblingFormOpen(false); setSiblingInput(''); }
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

  function handleDeleteWithAnim() {
    setIsLeaving(true);
    setTimeout(() => onDelete(task.id), 180);
  }

  function handleRowClick(e) {
    if (['BUTTON', 'INPUT', 'LABEL'].includes(e.target.tagName)) return;
    e.stopPropagation();
    onSelect(task.id);
  }

  const panelClass = [
    'task-item',
    task.completed ? 'completed' : '',
    justCompleted ? 'just-completed' : '',
    isActiveTimer ? 'has-active-timer' : '',
    isTopLevel ? 'top-level' : '',
    isSelected ? 'selected' : '',
    isLeaving ? 'leaving' : '',
  ].filter(Boolean).join(' ');

  const spentLabel = formatSpent(task.time_spent_seconds);

  return (
    <div className={panelClass} style={{ '--depth': depth }}>
      <div
        className="task-row"
        data-task-id={task.id}
        onClick={handleRowClick}
      >
        <button
          className={`expand-btn${hasChildren ? '' : ' invisible'}`}
          onClick={e => { e.stopPropagation(); setExpanded(ex => !ex); }}
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
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="task-title" onClick={e => { e.stopPropagation(); handleTitleClick(); }} title="Click to edit">
              {task.title}
            </span>
          )}

          {isCarried && <span className="carry-label">from {shortDate(task.day)}</span>}

          {progress && (
            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <span className="progress-label">{progress.done}/{progress.total}</span>
            </div>
          )}
        </div>

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
              onClick={e => e.stopPropagation()}
              placeholder="min"
            />
          ) : task.estimated_minutes ? (
            <button className="estimate-display" onClick={e => { e.stopPropagation(); startEditingEstimate(); }} title="Edit estimate">
              ~{task.estimated_minutes}m
            </button>
          ) : (
            <button className="estimate-display estimate-empty" onClick={e => { e.stopPropagation(); startEditingEstimate(); }} title="Set time estimate">
              +est
            </button>
          )}
          {spentLabel && !isActiveTimer && (
            <span className="time-spent" title="Time spent">{spentLabel}</span>
          )}
        </div>

        <div className="task-actions">
          <button
            className={`action-btn timer-start-btn${isActiveTimer ? ' is-active' : ''}`}
            onClick={e => { e.stopPropagation(); handleTimerClick(); }}
            title={isActiveTimer ? 'Timer running' : 'Start timer'}
          >
            {isActiveTimer ? '⏱' : '▷'}
          </button>
          <button
            className="action-btn focus-btn"
            onClick={e => { e.stopPropagation(); onStartDeepFocus(task.id); }}
            title="Deep focus on this task"
          >
            ⊙
          </button>
          <button
            className="action-btn zoom-btn"
            onClick={e => { e.stopPropagation(); onZoomIn(task.id); }}
            title="Zoom into subtree"
          >
            ⤢
          </button>
          <button
            className="action-btn add-btn"
            onClick={e => { e.stopPropagation(); startAddingChild(); }}
            title="Add sub-task"
          >
            +
          </button>
          <button
            className="action-btn delete-btn"
            onClick={e => { e.stopPropagation(); handleDeleteWithAnim(); }}
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
              onClick={e => e.stopPropagation()}
              placeholder="25"
            />
            <button type="submit" className="root-add-btn prompt-go-btn">Start</button>
            <button
              type="button"
              className="action-btn delete-btn"
              onClick={e => { e.stopPropagation(); setPromptingEstimate(false); onStartTimer(task.id, null); }}
            >
              Skip
            </button>
          </div>
        </form>
      )}

      {siblingFormOpen && (
        <form className="child-add-form sibling-add-form" onSubmit={handleAddSibling}>
          <input
            ref={siblingInputRef}
            className="child-add-input"
            placeholder="New task at same level… (Enter to save)"
            value={siblingInput}
            onChange={e => setSiblingInput(e.target.value)}
            onKeyDown={handleSiblingKeyDown}
            onClick={e => e.stopPropagation()}
          />
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
            onClick={e => e.stopPropagation()}
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
              onReorder={onReorder}
              nextUpId={nextUpId}
              activeTimerId={activeTimerId}
              selectedDay={selectedDay}
              depth={depth + 1}
              selectedTaskId={selectedTaskId}
              onSelect={onSelect}
              selectedRequest={selectedRequest}
              onRequestConsumed={onRequestConsumed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
