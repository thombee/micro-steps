import { useEffect, useRef, useState } from 'react';
import TimerPanel from './TimerPanel';

const ENCOURAGEMENTS = [
  'You only need to start.',
  'One thing. Just this.',
  'Small and done beats big and pending.',
  'This moment is enough.',
  'Focus here. Nothing else exists.',
  'The hardest part is starting.',
  'Tiny progress is still progress.',
];

function formatSpent(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export default function DeepFocus({
  task, onComplete, onExit,
  onStartTimer, onSetEstimate,
  activeTimer, onPauseTimer, onStopTimer,
}) {
  const [phrase] = useState(() => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [estimateInput, setEstimateInput] = useState('');
  const estimateRef = useRef(null);

  const isActiveTimer = activeTimer?.taskId === task.id;
  const spentLabel = formatSpent(task.time_spent_seconds);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !editingEstimate) onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, editingEstimate]);

  function handleComplete() { onComplete(task.id); }

  function handleTimer() {
    if (isActiveTimer) {
      onPauseTimer();
    } else {
      onStartTimer(task.id, task.estimated_minutes);
    }
  }

  function startEditingEstimate() {
    setEstimateInput(task.estimated_minutes != null ? String(task.estimated_minutes) : '');
    setEditingEstimate(true);
    setTimeout(() => { estimateRef.current?.focus(); estimateRef.current?.select(); }, 0);
  }

  function commitEstimate(e) {
    e?.preventDefault();
    const val = parseInt(estimateInput, 10);
    if (!isNaN(val) && val > 0) onSetEstimate(task.id, val);
    setEditingEstimate(false);
  }

  function handleEstimateKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitEstimate(); }
    if (e.key === 'Escape') setEditingEstimate(false);
  }

  return (
    <div className="deep-focus-overlay">
      <div className="deep-focus-card">
        <p className="deep-focus-phrase">{phrase}</p>

        <div className="deep-focus-task">
          <div className="deep-focus-checkbox-wrap" onClick={handleComplete} title="Mark done">
            <span className="deep-focus-check">✓</span>
          </div>
          <span className="deep-focus-title">{task.title}</span>
        </div>

        {/* Estimate row */}
        <div className="deep-focus-meta-row">
          {editingEstimate ? (
            <form onSubmit={commitEstimate} className="deep-focus-estimate-form">
              <input
                ref={estimateRef}
                type="number" min="1" max="480"
                className="estimate-input"
                value={estimateInput}
                onChange={e => setEstimateInput(e.target.value)}
                onBlur={commitEstimate}
                onKeyDown={handleEstimateKeyDown}
                placeholder="minutes"
              />
              <span className="deep-focus-estimate-unit">min</span>
            </form>
          ) : task.estimated_minutes ? (
            <button className="estimate-display" onClick={startEditingEstimate} title="Edit estimate">
              ~{task.estimated_minutes} min estimated
            </button>
          ) : (
            <button className="estimate-display estimate-empty" onClick={startEditingEstimate} title="Set estimate">
              + set time estimate
            </button>
          )}

          {spentLabel && !isActiveTimer && (
            <span className="time-spent deep-focus-spent">
              {spentLabel} spent so far
            </span>
          )}
        </div>

        {/* Timer */}
        {isActiveTimer ? (
          <div className="deep-focus-timer-inline">
            <TimerPanel
              activeTimer={activeTimer}
              taskTitle={task.title}
              onPause={onPauseTimer}
              onStop={onStopTimer}
            />
          </div>
        ) : (
          <div className="deep-focus-actions">
            <button className="deep-focus-timer-btn" onClick={handleTimer}>
              ▷ Start timer
            </button>
          </div>
        )}

        <button className="deep-focus-exit-btn" onClick={onExit}>
          exit focus (Esc)
        </button>
      </div>
    </div>
  );
}
