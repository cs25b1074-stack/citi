import { useState, useEffect } from 'react';

export function useCountUp(target: number, step = 1, intervalMs = 150): number {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target <= current) {
      setCurrent(target);
      return;
    }

    const timer = setInterval(() => {
      setCurrent((prev) => {
        const next = prev + step;
        if (next >= target) {
          clearInterval(timer);
          return target;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [target, step, intervalMs]);

  return current;
}