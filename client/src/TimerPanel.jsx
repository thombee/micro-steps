import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatTime(seconds) {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getArcColor(elapsed, estimated) {
  if (estimated === 0) return '#4f46e5';
  const pct = elapsed / estimated;
  if (pct >= 1) return '#ef4444';
  if (pct >= 0.75) return '#f59e0b';
  return '#22c55e';
}

function loadPosition() {
  try { return JSON.parse(localStorage.getItem('timerPos')) ?? null; }
  catch { return null; }
}

// ── PiP CSS injected into the floating window ────────────────────────────────
const PIP_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #ffffff;
    color: #111827;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
  }
  .pip-root {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .pip-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    text-align: center;
    line-height: 1.3;
    max-width: 200px;
    word-break: break-word;
  }
  .pip-arc-wrap {
    position: relative;
    width: 110px;
    height: 110px;
    flex-shrink: 0;
  }
  .pip-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .pip-time {
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    color: #111827;
    line-height: 1;
  }
  .pip-time.overtime { color: #ef4444; }
  .pip-sublabel {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
    line-height: 1;
  }
  .pip-sublabel.overtime { color: #ef4444; }
  .pip-status {
    font-size: 11px;
    color: #6b7280;
    text-align: center;
    line-height: 1.3;
  }
  .pip-status.overtime-text { color: #ef4444; }
  .pip-controls {
    display: flex;
    gap: 8px;
    width: 100%;
  }
  .pip-btn {
    flex: 1;
    padding: 9px 0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s;
  }
  .pip-btn:hover { opacity: 0.8; }
  .pip-pause {
    background: #ede9fe;
    color: #4f46e5;
  }
  .pip-pause.is-paused {
    background: #4f46e5;
    color: #fff;
  }
  .pip-stop {
    background: #f3f4f6;
    color: #6b7280;
  }
  .pip-stop:hover {
    background: #fef2f2 !important;
    color: #ef4444 !important;
  }
  @keyframes timerSpin {
    from { transform: rotate(-90deg); }
    to   { transform: rotate(270deg); }
  }
  .pip-spinner {
    transform-origin: 55px 55px;
    animation: timerSpin 2s linear infinite;
  }
  @keyframes overtimePulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    50%       { box-shadow: 0 0 0 6px rgba(239,68,68,0.15); }
  }
  .pip-root.is-overtime { animation: overtimePulse 2s ease-in-out infinite; }
`;

// ── PiP timer content — rendered into the floating window ────────────────────
function PipContent({ activeTimer, taskTitle, onPause, onStop }) {
  const { estimatedSeconds, elapsedSeconds, status } = activeTimer;
  const isOvertime = elapsedSeconds >= estimatedSeconds && estimatedSeconds > 0;
  const isPaused = status === 'paused';
  const hasEstimate = estimatedSeconds > 0;

  const arcColor = getArcColor(elapsedSeconds, estimatedSeconds);
  const R = 44; // slightly larger for PiP
  const CIRC = 2 * Math.PI * R;

  const mainProgress = hasEstimate ? Math.min(elapsedSeconds / estimatedSeconds, 1) : 0;
  const mainOffset = CIRC * mainProgress;

  const overtimeSeconds = isOvertime ? elapsedSeconds - estimatedSeconds : 0;
  const overtimeCap = estimatedSeconds > 0 ? estimatedSeconds : 60;
  const overtimeOffset = CIRC * (1 - Math.min(overtimeSeconds / overtimeCap, 1));

  const timeStr = () => {
    if (!hasEstimate) return formatTime(elapsedSeconds);
    if (isOvertime) return `+${formatTime(overtimeSeconds)}`;
    return formatTime(estimatedSeconds - elapsedSeconds);
  };

  return (
    <div className={`pip-root${isOvertime ? ' is-overtime' : ''}`}>
      <div className="pip-title">{taskTitle}</div>

      <div className="pip-arc-wrap">
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={R} fill="none" stroke="#e5e7eb" strokeWidth="6" />
          {hasEstimate && (
            <circle
              cx="55" cy="55" r={R}
              fill="none"
              stroke={isOvertime ? '#e5e7eb' : arcColor}
              strokeWidth="6"
              strokeDasharray={CIRC}
              strokeDashoffset={mainOffset}
              strokeLinecap="round"
              transform="rotate(-90 55 55)"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
            />
          )}
          {isOvertime && (
            <circle
              cx="55" cy="55" r={R}
              fill="none"
              stroke="#ef4444"
              strokeWidth="6"
              strokeDasharray={CIRC}
              strokeDashoffset={overtimeOffset}
              strokeLinecap="round"
              transform="rotate(-90 55 55)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          )}
          {!hasEstimate && (
            <circle
              cx="55" cy="55" r={R}
              fill="none"
              stroke="#4f46e5"
              strokeWidth="6"
              strokeDasharray={`${CIRC * 0.25} ${CIRC * 0.75}`}
              strokeLinecap="round"
              transform="rotate(-90 55 55)"
              className="pip-spinner"
            />
          )}
        </svg>
        <div className="pip-center">
          <span className={`pip-time${isOvertime ? ' overtime' : ''}`}>{timeStr()}</span>
          {isOvertime && <span className="pip-sublabel overtime">over</span>}
          {isPaused && !isOvertime && <span className="pip-sublabel">paused</span>}
        </div>
      </div>

      {hasEstimate && !isOvertime && !isPaused && (
        <div className="pip-status">{formatTime(estimatedSeconds - elapsedSeconds)} remaining</div>
      )}
      {isOvertime && (
        <div className="pip-status overtime-text">{formatTime(estimatedSeconds)} estimated · keep going</div>
      )}
      {isPaused && (
        <div className="pip-status">paused</div>
      )}

      <div className="pip-controls">
        <button
          className={`pip-btn pip-pause${isPaused ? ' is-paused' : ''}`}
          onClick={onPause}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button className="pip-btn pip-stop" onClick={onStop}>■ Stop</button>
      </div>
    </div>
  );
}

// ── Main TimerPanel component ─────────────────────────────────────────────────
export default function TimerPanel({ activeTimer, taskTitle, onPause, onStop, draggable = false, style: outerStyle }) {
  const panelRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const pipRootRef = useRef(null);
  const pipWindowRef = useRef(null);
  const [position, setPosition] = useState(loadPosition);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPipped, setIsPipped] = useState(false);

  const supportsPiP = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const { estimatedSeconds, elapsedSeconds, status } = activeTimer;
  const isOvertime = elapsedSeconds >= estimatedSeconds && estimatedSeconds > 0;
  const isPaused = status === 'paused';
  const hasEstimate = estimatedSeconds > 0;

  const mainProgress = hasEstimate ? Math.min(elapsedSeconds / estimatedSeconds, 1) : 0;
  const mainOffset = CIRCUMFERENCE * mainProgress;
  const overtimeSeconds = isOvertime ? elapsedSeconds - estimatedSeconds : 0;
  const overtimeCap = estimatedSeconds > 0 ? estimatedSeconds : 60;
  const overtimeProgress = Math.min(overtimeSeconds / overtimeCap, 1);
  const overtimeOffset = CIRCUMFERENCE * (1 - overtimeProgress);
  const arcColor = getArcColor(elapsedSeconds, estimatedSeconds);

  // Keep PiP content in sync with timer state
  useEffect(() => {
    if (pipRootRef.current) {
      pipRootRef.current.render(
        <PipContent
          activeTimer={activeTimer}
          taskTitle={taskTitle}
          onPause={onPause}
          onStop={onStop}
        />
      );
    }
  }, [activeTimer, taskTitle, onPause, onStop]);

  // Close PiP when this component unmounts (timer stopped)
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
        pipRootRef.current = null;
      }
    };
  }, []);

  async function openPiP() {
    // Close if already open
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      pipRootRef.current = null;
      setIsPipped(false);
      return;
    }

    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 260,
        height: 340,
        disallowReturnToOpener: false,
      });

      // Inject styles
      const style = pip.document.createElement('style');
      style.textContent = PIP_CSS;
      pip.document.head.appendChild(style);

      // Container
      const container = pip.document.createElement('div');
      pip.document.body.appendChild(container);

      // React root in PiP window
      const root = createRoot(container);
      root.render(
        <PipContent
          activeTimer={activeTimer}
          taskTitle={taskTitle}
          onPause={onPause}
          onStop={onStop}
        />
      );

      pipRootRef.current = root;
      pipWindowRef.current = pip;
      setIsPipped(true);

      pip.addEventListener('pagehide', () => {
        pipRootRef.current = null;
        pipWindowRef.current = null;
        setIsPipped(false);
      });
    } catch (err) {
      console.warn('PiP failed:', err);
    }
  }

  // Keyboard: space = pause/resume, escape = stop
  useEffect(() => {
    function onKey(e) {
      if (!panelRef.current) return;
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); onPause(); }
      if (e.key === 'Escape') onStop();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPause, onStop]);

  // Re-clamp position on resize
  useEffect(() => {
    if (!draggable) return;
    function onResize() {
      setPosition(prev => {
        if (!prev || !panelRef.current) return prev;
        return {
          x: Math.min(prev.x, window.innerWidth - panelRef.current.offsetWidth),
          y: Math.min(prev.y, window.innerHeight - panelRef.current.offsetHeight),
        };
      });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draggable]);

  function handleDragStart(e) {
    if (!draggable) return;
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
      const pos = {
        x: Math.max(0, Math.min(cx - dragOffset.current.x, window.innerWidth - panelW)),
        y: Math.max(0, Math.min(cy - dragOffset.current.y, window.innerHeight - panelH)),
      };
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
    if (!hasEstimate) return <span className="timer-time-label">{formatTime(elapsedSeconds)}</span>;
    if (isOvertime) return <span className="timer-time-label overtime">+{formatTime(overtimeSeconds)}</span>;
    return <span className="timer-time-label">{formatTime(estimatedSeconds - elapsedSeconds)}</span>;
  };

  const panelClass = [
    'timer-panel',
    isOvertime ? 'timer-overtime' : '',
    isPaused ? 'timer-paused' : '',
    isMinimized ? 'timer-minimized' : '',
    isPipped ? 'timer-pipped' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={panelClass} ref={panelRef} style={positionStyle}>
      {/* Drag handle — only for the floating panel */}
      {draggable && (
        <div
          className="timer-drag-handle"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          title="Drag to move"
        >
          <span className="timer-drag-dots">⠿</span>
          <div className="timer-handle-actions">
            {supportsPiP && (
              <button
                className={`timer-pip-btn${isPipped ? ' is-active' : ''}`}
                onClick={openPiP}
                title={isPipped ? 'Close picture-in-picture' : 'Pop out (picture-in-picture)'}
              >
                {isPipped ? '⊠' : '⧉'}
              </button>
            )}
            <button
              className="timer-minimize-btn"
              onClick={() => setIsMinimized(v => !v)}
              title={isMinimized ? 'Expand timer' : 'Minimize timer'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>
          </div>
        </div>
      )}

      {/* Minimized pill */}
      {isMinimized && (
        <div className="timer-pill-content" onClick={() => setIsMinimized(false)}>
          <span className="timer-pill-dot" style={{ background: isOvertime ? '#ef4444' : arcColor }} />
          <span className={`timer-pill-time${isOvertime ? ' overtime' : ''}`}>
            {timeDisplay()}
          </span>
        </div>
      )}

      {/* Full panel — hidden when pipped or minimized */}
      {!isMinimized && !isPipped && (
        <>
          <div className="timer-arc-wrap">
            <svg width="88" height="88" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="5" />
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
            <div className="timer-center">
              {timeLabel()}
              {isOvertime && <span className="timer-over-label">over</span>}
              {isPaused && !isOvertime && <span className="timer-paused-label">paused</span>}
            </div>
          </div>

          <div className="timer-task-title" title={taskTitle}>{taskTitle}</div>

          {hasEstimate && !isOvertime && !isPaused && (
            <div className="timer-sublabel">{formatTime(estimatedSeconds - elapsedSeconds)} remaining</div>
          )}
          {isOvertime && (
            <div className="timer-sublabel overtime-label">
              {formatTime(estimatedSeconds)} estimated · keep going
            </div>
          )}
          {isPaused && <div className="timer-sublabel">paused · space to resume</div>}

          <div className="timer-controls">
            <button
              className={`timer-btn timer-pause-btn${isPaused ? ' is-paused' : ''}`}
              onClick={onPause}
              title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button className="timer-btn timer-stop-btn" onClick={onStop} title="Stop (Esc)">
              ■ Stop
            </button>
          </div>
        </>
      )}

      {/* PiP active state — collapsed indicator */}
      {isPipped && !isMinimized && (
        <div className="timer-pip-active" onClick={openPiP} title="Close picture-in-picture">
          <span className="timer-pill-dot" style={{ background: isOvertime ? '#ef4444' : arcColor }} />
          <span className={`timer-pill-time${isOvertime ? ' overtime' : ''}`}>{timeDisplay()}</span>
          <span className="timer-pip-label">floating ⊠</span>
        </div>
      )}
    </div>
  );
}
