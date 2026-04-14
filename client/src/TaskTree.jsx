import { useRef } from 'react';
import TaskItem from './TaskItem';
import { QUOTES } from './quotes';

// Stable random quote for empty state (picked once per session)
const EMPTY_QUOTE = QUOTES[Math.floor(Math.random() * QUOTES.length)];

export default function TaskTree({
  tasks, onAdd, onToggle, onEdit, onDelete,
  onStartDeepFocus, onZoomIn,
  onStartTimer, onSetEstimate, onReorder,
  nextUpId, activeTimerId, selectedDay,
  isRoot, parentId, rootInputRef,
  selectedTaskId, onSelect, selectedRequest, onRequestConsumed,
  dayTasks,
}) {
  const localInputRef = useRef(null);
  const inputRef = rootInputRef || localInputRef;

  function handleAddSubmit(e) {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const title = input.value.trim();
    if (!title) return;
    onAdd(title, parentId ?? null);
    input.value = '';
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Escape') { if (inputRef.current) inputRef.current.value = ''; }
  }

  const isEmpty = isRoot && tasks.length === 0;

  return (
    <div className={isRoot ? 'task-tree-root' : 'task-tree'}>
      {isRoot && (
        <form className="root-add-form" onSubmit={handleAddSubmit}>
          <input
            ref={inputRef}
            className="root-add-input"
            placeholder="Add a task… (Enter to save)"
            onKeyDown={handleAddKeyDown}
            autoFocus
          />
        </form>
      )}

      {isEmpty ? (
        <div className="empty-day">
          <p className="empty-day-quote">"{EMPTY_QUOTE}"</p>
          <p className="empty-day-hint">Press <kbd className="kbd">N</kbd> to add your first task</p>
        </div>
      ) : (
        tasks.map(task => (
          <TaskItem
            key={task.id}
            task={task}
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
            selectedTaskId={selectedTaskId}
            onSelect={onSelect}
            selectedRequest={selectedRequest}
            onRequestConsumed={onRequestConsumed}
          />
        ))
      )}
    </div>
  );
}
