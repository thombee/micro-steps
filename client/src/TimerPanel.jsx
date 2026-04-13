import { useEffect, useRef, useState } from 'react';

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 226.2

function formatTime(seconds) {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getArcColor(elapsed, estimated) {
  if (estimated === 0) return '#4f46e5';
  const pct = elapsed / estimated;
  if (pct >= 1) return '#ef4444';       // overtime — red
  if (pct >= 0.75) return '#f59e0b';    // < 25% left — amber
  return '#22c55e';                      // plenty — green
}

function loadPosition() {
  try { return JSON.parse(localStorage.getItem('timerPos')) ?? null; }
  catch { return null; }
}

export default function TimerPanel({ activeTimer, taskTitle, onPause, onStop, draggable = false, style: outerStyle }) {
  const panelRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const [position, setPosition] = useState(loadPosition);
  const [isMinimized, setIsMinimized] = useState(false);

  const { estimatedSeconds, elapsedSeconds, status } = activeTimer;
  const isOvertime = elapsedSeconds >= estimatedSeconds && estimatedSeconds > 0;
  const isPaused = status === 'paused';
  const hasEstimate = estimatedSeconds > 0;

  // Main arc: drains from full to 0 over estimatedSeconds
  const mainProgress = hasEstimate
    ? Math.min(elapsedSeconds / estimatedSeconds, 1)
    : 0;
  const mainOffset = CIRCUMFERENCE * mainProgress;

  // Overtime arc: fills from 0 as time goes over
  const overtimeSeconds = isOvertime ? elapsedSeconds - estimatedSeconds : 0;
  const overtimeCap = estimatedSeconds > 0 ? estimatedSeconds : 60;
  const overtimeProgress = Math.min(overtimeSeconds / overtimeCap, 1);
  const overtimeOffset = CIRCUMFERENCE * (1 - overtimeProgress);

  const arcColor = getArcColor(elapsedSeconds, estimatedSeconds);

  // Keyboard: space = pause/resume, escape = stop
  useEffect(() => {
    function onKey(e) {
      if (!panelRef.current) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        onPause();
      }
      if (e.key === 'Escape') {
        onStop();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPause, onStop]);

  // Re-clamp position if window resizes and panel would go off-screen
  useEffect(() => {
    if (!draggable) return;
    function onResize() {
      setPosition(prev => {
        if (!prev || !panelRef.current) return prev;
        const panelW = panelRef.current.offsetWidth;
        const panelH = panelRef.current.offsetHeight;
        return {
          x: Math.min(prev.x, window.innerWidth - panelW),
          y: Math.min(prev.y, window.innerHeight - panelH),
        };
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draggable]);

  function handleDragStart(e) {
    if (!draggable) return;
    // Ignore right-click
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };

    function onMove(ev) {
      if (!isDragging.current) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const panelW = panelRef.current.offsetWidth;
      const panelH = panelRef.current.offsetHeight;
      const newX = Math.max(0, Math.min(cx - dragOffset.current.x, window.innerWidth - panelW));
      const newY = Math.max(0, Math.min(cy - dragOffset.current.y, window.innerHeight - panelH));
      const pos = { x: newX, y: newY };
      setPosition(pos);
      localStorage.setItem('timerPos', JSON.stringify(pos));
    }

    function onUp() {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  const positionStyle = {
    ...(draggable && position ? { top: position.y, left: position.x, bottom: 'auto', right: 'auto' } : {}),
    ...outerStyle,
  };

  const timeDisplay = () => {
    if (!hasEstimate) return formatTime(elapsedSeconds);
    if (isOvertime) return `+${formatTime(overtimeSeconds)}`;
    return formatTime(estimatedSeconds - elapsedSeconds);
  };

  const timeLabel = () => {
    if (!hasEstimate) {
      return <span className="timer-time-label">{formatTime(elapsedSeconds)}</span>;
    }
    if (isOvertime) {
      return (
        <span className="timer-time-label overtime">
          +{formatTime(overtimeSeconds)}
        </span>
      );
    }
    const remaining = estimatedSeconds - elapsedSeconds;
    return <span className="timer-time-label">{formatTime(remaining)}</span>;
  };

  const panelClass = [
    'timer-panel',
    isOvertime ? 'timer-overtime' : '',
    isPaused ? 'timer-paused' : '',
    isMinimized ? 'timer-minimized' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={panelClass} ref={panelRef} style={positionStyle}>
      {/* Drag handle + minimize — only when draggable (floating panel) */}
      {draggable && (
        <div
          className="timer-drag-handle"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          title="Drag to move"
        >
          <span className="timer-drag-dots">⠿</span>
          <button
            className="timer-minimize-btn"
            onClick={() => setIsMinimized(v => !v)}
            title={isMinimized ? 'Expand timer' : 'Minimize timer'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      )}

      {/* Minimized pill: just the dot + time */}
      {isMinimized && (
        <div className="timer-pill-content" onClick={() => setIsMinimized(false)}>
          <span className="timer-pill-dot" style={{ background: isOvertime ? '#ef4444' : arcColor }} />
          <span className={`timer-pill-time${isOvertime ? ' overtime' : ''}`}>
            {timeDisplay()}
          </span>
        </div>
      )}

      {/* Full panel content — hidden when minimized */}
      {!isMinimized && (
        <>
          {/* SVG arc countdown */}
          <div className="timer-arc-wrap">
            <svg width="88" height="88" viewBox="0 0 88 88">
              {/* Track */}
              <circle
                cx="44" cy="44" r={RADIUS}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="5"
              />
              {/* Main countdown arc */}
              {hasEstimate && (
                <circle
                  cx="44" cy="44" r={RADIUS}
                  fill="none"
                  stroke={isOvertime ? '#e5e7eb' : arcColor}
                  strokeWidth="5"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={mainOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
                />
              )}
              {/* Overtime fill arc */}
              {isOvertime && (
                <circle
                  cx="44" cy="44" r={RADIUS}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="5"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={overtimeOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              )}
              {/* No-estimate spinner */}
              {!hasEstimate && (
                <circle
                  cx="44" cy="44" r={RADIUS}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="5"
                  strokeDasharray={`${CIRCUMFERENCE * 0.25} ${CIRCUMFERENCE * 0.75}`}
                  strokeLinecap="round"
                  transform="rotate(-90 44 44)"
                  className="timer-spinner"
                />
              )}
            </svg>
            {/* Center time */}
            <div className="timer-center">
              {timeLabel()}
              {isOvertime && <span className="timer-over-label">over</span>}
              {isPaused && !isOvertime && <span className="timer-paused-label">paused</span>}
            </div>
          </div>

          {/* Task title */}
          <div className="timer-task-title" title={taskTitle}>{taskTitle}</div>

          {/* Sub-label */}
          {hasEstimate && !isOvertime && !isPaused && (
            <div className="timer-sublabel">
              {formatTime(estimatedSeconds - elapsedSeconds)} remaining
            </div>
          )}
          {isOvertime && (
            <div className="timer-sublabel overtime-label">
              {formatTime(estimatedSeconds)} estimated · keep going
            </div>
          )}
          {isPaused && (
            <div className="timer-sublabel">paused · space to resume</div>
          )}

          {/* Controls */}
          <div className="timer-controls">
            <button
              className={`timer-btn timer-pause-btn${isPaused ? ' is-paused' : ''}`}
              onClick={onPause}
              title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              className="timer-btn timer-stop-btn"
              onClick={onStop}
              title="Stop (Esc)"
            >
              ■ Stop
            </button>
          </div>
        </>
      )}
    </div>
  );
}
