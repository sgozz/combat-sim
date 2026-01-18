import { useState, useEffect } from 'react';

export const useCountdown = (
  initialSeconds: number,
  startTimestamp: number | undefined,
  onComplete: () => void
): number => {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (!startTimestamp) {
      queueMicrotask(() => setTimeRemaining(initialSeconds));
      return;
    }

    const updateTimer = () => {
      const elapsed = (Date.now() - startTimestamp) / 1000;
      const remaining = Math.max(0, initialSeconds - elapsed);
      setTimeRemaining(Math.ceil(remaining));
      
      if (remaining <= 0) {
        onComplete();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [initialSeconds, startTimestamp, onComplete]);

  return timeRemaining;
};
