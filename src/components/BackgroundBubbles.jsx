const bubbles = [
  { size: '14px', left: '7%', duration: '19s', delay: '-8s', drift: '-26px', opacity: '0.24' },
  { size: '28px', left: '16%', duration: '24s', delay: '-18s', drift: '34px', opacity: '0.3' },
  { size: '18px', left: '29%', duration: '21s', delay: '-4s', drift: '-42px', opacity: '0.22' },
  { size: '42px', left: '41%', duration: '29s', delay: '-22s', drift: '48px', opacity: '0.18' },
  { size: '12px', left: '53%', duration: '17s', delay: '-11s', drift: '-22px', opacity: '0.28' },
  { size: '24px', left: '62%', duration: '23s', delay: '-2s', drift: '38px', opacity: '0.25' },
  { size: '34px', left: '73%', duration: '27s', delay: '-15s', drift: '-34px', opacity: '0.2' },
  { size: '16px', left: '84%', duration: '20s', delay: '-6s', drift: '26px', opacity: '0.26' },
  { size: '10px', left: '92%', duration: '16s', delay: '-13s', drift: '-18px', opacity: '0.3' },
];

export function BackgroundBubbles() {
  return (
    <div className="backgroundBubbles" aria-hidden="true">
      {bubbles.map((bubble, index) => (
        <span
          className="backgroundBubble"
          key={`${bubble.left}-${index}`}
          style={{
            '--bubble-size': bubble.size,
            '--bubble-left': bubble.left,
            '--bubble-duration': bubble.duration,
            '--bubble-delay': bubble.delay,
            '--bubble-drift': bubble.drift,
            '--bubble-opacity': bubble.opacity,
          }}
        />
      ))}
    </div>
  );
}
