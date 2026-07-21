import { useEffect, useRef } from 'react';

const REQUIRED_TAPS = 5;
const TAP_WINDOW_MS = 2000;

export function AdminEasterEgg({ onActivate }) {
  const tapCount = useRef(0);
  const firstTapAt = useRef(0);
  const resetTimer = useRef(null);

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  const handleTap = (event) => {
    event.preventDefault();
    const now = Date.now();

    if (!firstTapAt.current || now - firstTapAt.current > TAP_WINDOW_MS) {
      firstTapAt.current = now;
      tapCount.current = 0;
    }

    tapCount.current += 1;
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      tapCount.current = 0;
      firstTapAt.current = 0;
    }, TAP_WINDOW_MS);

    if (tapCount.current >= REQUIRED_TAPS) {
      tapCount.current = 0;
      firstTapAt.current = 0;
      window.clearTimeout(resetTimer.current);
      onActivate();
    }
  };

  return (
    <button
      className="adminEasterEgg"
      type="button"
      aria-label="裝飾光點"
      onClick={handleTap}
    />
  );
}
