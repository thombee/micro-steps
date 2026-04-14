import { useState, useEffect } from 'react';
import { QUOTES } from './quotes';

export default function QuoteRotator({ className = 'app-subtitle' }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 500);
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className={className}
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease' }}
    >
      {QUOTES[index]}
    </p>
  );
}
