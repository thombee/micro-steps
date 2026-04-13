import { useState, useEffect, useRef } from 'react';

const MILESTONES = [
  { at: 1,   emoji: '✓',   phrase: 'first one done' },
  { at: 2,   emoji: '✓✓',  phrase: 'keep going' },
  { at: 3,   emoji: '🎯',  phrase: 'on a roll' },
  { at: 5,   emoji: '⚡',  phrase: 'momentum building' },
  { at: 7,   emoji: '🔥',  phrase: 'you\'re flowing' },
  { at: 10,  emoji: '💥',  phrase: '10 steps done!' },
  { at: 15,  emoji: '🚀',  phrase: 'unstoppable' },
  { at: 20,  emoji: '👑',  phrase: '20 wins!' },
  { at: 30,  emoji: '🌟',  phrase: '30 steps!' },
  { at: 50,  emoji: '🏆',  phrase: '50. legendary.' },
];

function getMilestone(count) {
  if (count === 0) return null;
  // Find the highest milestone at or below count
  let best = null;
  for (const m of MILESTONES) {
    if (count >= m.at) best = m;
  }
  // Above last milestone: keep last emoji, update phrase
  if (!best) return null;
  if (count > 50) return { emoji: '🏆', phrase: `${count} steps. legend.` };
  return best;
}

export default function CompletionCounter({ count }) {
  const [bump, setBump] = useState(false);
  const [milestoneFlash, setMilestoneFlash] = useState(false);
  const prevCount = useRef(count);

  const isMilestoneCount = MILESTONES.some(m => m.at === count);

  useEffect(() => {
    if (count > prevCount.current) {
      // Always bump on any completion
      setBump(true);
      setTimeout(() => setBump(false), 400);

      // Special flash for milestone
      if (isMilestoneCount) {
        setMilestoneFlash(true);
        setTimeout(() => setMilestoneFlash(false), 800);
      }
    }
    prevCount.current = count;
  }, [count]);

  if (count === 0) return null;

  const milestone = getMilestone(count);

  return (
    <div className={`completion-counter${milestoneFlash ? ' milestone-flash' : ''}`} title={`${count} task${count !== 1 ? 's' : ''} completed this session`}>
      <span className={`counter-number${bump ? ' counter-bump' : ''}`}>
        {count}
      </span>
      {milestone && (
        <div className="counter-meta">
          <span className="counter-emoji">{milestone.emoji}</span>
          <span className="counter-phrase">{milestone.phrase}</span>
        </div>
      )}
    </div>
  );
}
