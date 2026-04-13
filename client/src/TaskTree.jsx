import { useState, useRef } from 'react';
import TaskItem from './TaskItem';

export default function TaskTree({
  tasks, onAdd, onToggle, onEdit, onDelete,
  onStartDeepFocus, onZoomIn,
  onStartTimer, onSetEstimate,
  nextUpId, activeTimerId, selectedDay,
  isRoot, parentId,
}) {
  const [addingTitle, setAddingTitle] = useState('');
  const inputRef = useRef(null);

  function handleAddSubmit(e) {
    e.preventDefault();
    const title = addingTitle.trim();
    if (!title) return;
    onAdd(title, parentId ?? null);
    setAddingTitle('');
  }

  function handleAddKeyDown(e) {
    if (e.key === 'Escape') setAddingTitle('');
  }

  return (
    <div className={isRoot ? 'task-tree-root' : 'task-tree'}>
      {isRoot && (
        <form className="root-add-form" onSubmit={handleAddSubmit}>
          <input
            ref={inputRef}
            className="root-add-input"
            placeholder="Add a task… (Enter to save)"
            value={addingTitle}
            onChange={e => setAddingTitle(e.target.value)}
            onKeyDown={handleAddKeyDown}
            autoFocus
          />
          {addingTitle.trim() && (
            <button type="submit" className="root-add-btn">Add</button>
          )}
        </form>
      )}

      {tasks.map(task => (
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
          nextUpId={nextUpId}
          activeTimerId={activeTimerId}
          selectedDay={selectedDay}
        />
      ))}

      {tasks.length === 0 && isRoot && (
        <p className="empty-state">No tasks yet. Add one above to get started.</p>
      )}
    </div>
  );
}
