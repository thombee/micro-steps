const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDay(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]}, ${MONTHS[m - 1]} ${d}`;
}

function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DayNav({ selectedDay, onPrev, onNext, taskCount, carriedCount }) {
  const today = todayISO();
  const isToday = selectedDay === today;
  const isFuture = selectedDay > today;

  return (
    <div className="day-nav">
      <button
        className="day-nav-btn"
        onClick={onPrev}
        aria-label="Previous day"
      >
        ‹
      </button>

      <div className="day-nav-center">
        <span className="day-nav-label">
          {isToday ? 'Today' : formatDay(selectedDay)}
          {isToday && <span className="day-nav-today-dot" />}
        </span>
        {!isToday && (
          <span className="day-nav-date-sub">{formatDay(selectedDay)}</span>
        )}
        <div className="day-nav-meta">
          {taskCount > 0 && (
            <span className="day-nav-count">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
          )}
          {carriedCount > 0 && (
            <span className="day-nav-carried">· {carriedCount} carried over</span>
          )}
          {taskCount === 0 && carriedCount === 0 && (
            <span className="day-nav-empty">no tasks</span>
          )}
        </div>
      </div>

      <button
        className={`day-nav-btn${isToday ? ' day-nav-btn-disabled' : ''}`}
        onClick={isToday ? undefined : onNext}
        aria-label="Next day"
        aria-disabled={isToday}
      >
        ›
      </button>
    </div>
  );
}
