import { useEffect } from 'react';

const SHORTCUTS = [
  { keys: ['↑', '↓'], desc: 'Move selection up / down' },
  { keys: ['Shift', '↑↓'], desc: 'Move task up / down within siblings' },
  { keys: ['→'], desc: 'Expand subtree or move into first child' },
  { keys: ['←'], desc: 'Collapse subtree or jump to parent' },
  { keys: ['Enter'], desc: 'Add task at same level' },
  { keys: ['Shift', 'Enter'], desc: 'Add sub-task (nested)' },
  { keys: ['Space'], desc: 'Toggle completion (when no timer running)' },
  { keys: ['E'], desc: 'Edit selected task title' },
  { keys: ['D'], desc: 'Deep focus on selected task' },
  { keys: ['T'], desc: 'Start timer on selected task' },
  { keys: ['Del'], desc: 'Delete selected task (with undo)' },
  { keys: ['N'], desc: 'New root-level task' },
  { keys: ['?'], desc: 'Show / hide this shortcuts panel' },
  { keys: ['Esc'], desc: 'Deselect / close' },
];

export default function ShortcutsHelp({ onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' || e.key === '?') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2 className="shortcuts-title">Keyboard shortcuts</h2>
          <button className="shortcuts-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>
        <div className="shortcuts-list">
          {SHORTCUTS.map(({ keys, desc }) => (
            <div key={desc} className="shortcuts-row">
              <div className="shortcuts-keys">
                {keys.map((k, i) => (
                  <span key={k}>
                    {i > 0 && <span className="shortcuts-plus">+</span>}
                    <kbd className="kbd">{k}</kbd>
                  </span>
                ))}
              </div>
              <span className="shortcuts-desc">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
