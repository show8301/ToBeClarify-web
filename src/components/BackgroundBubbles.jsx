const bubbles = [
  { size: '14px', left: '4%', duration: '19s', delay: '-8s', drift: '-26px', opacity: '0.34', color: '#d9a4e5' },
  { size: '28px', left: '11%', duration: '24s', delay: '-18s', drift: '34px', opacity: '0.42', color: '#f29bc3' },
  { size: '18px', left: '19%', duration: '21s', delay: '-4s', drift: '-42px', opacity: '0.36', color: '#93c7e8' },
  { size: '42px', left: '27%', duration: '29s', delay: '-22s', drift: '48px', opacity: '0.28', color: '#d9a4e5' },
  { size: '12px', left: '34%', duration: '17s', delay: '-11s', drift: '-22px', opacity: '0.4', color: '#f29bc3' },
  { size: '24px', left: '42%', duration: '23s', delay: '-2s', drift: '38px', opacity: '0.36', color: '#93c7e8' },
  { size: '34px', left: '49%', duration: '27s', delay: '-15s', drift: '-34px', opacity: '0.32', color: '#d9a4e5' },
  { size: '16px', left: '56%', duration: '20s', delay: '-6s', drift: '26px', opacity: '0.38', color: '#f29bc3' },
  { size: '10px', left: '63%', duration: '16s', delay: '-13s', drift: '-18px', opacity: '0.44', color: '#93c7e8' },
  { size: '22px', left: '69%', duration: '22s', delay: '-9s', drift: '32px', opacity: '0.34', color: '#d9a4e5' },
  { size: '38px', left: '76%', duration: '28s', delay: '-20s', drift: '-44px', opacity: '0.28', color: '#f29bc3' },
  { size: '13px', left: '82%', duration: '18s', delay: '-3s', drift: '22px', opacity: '0.4', color: '#93c7e8' },
  { size: '26px', left: '88%', duration: '25s', delay: '-16s', drift: '-30px', opacity: '0.36', color: '#d9a4e5' },
  { size: '11px', left: '95%', duration: '17s', delay: '-10s', drift: '18px', opacity: '0.44', color: '#f29bc3' },
  { size: '20px', left: '24%', duration: '26s', delay: '-24s', drift: '36px', opacity: '0.3', color: '#93c7e8' },
  { size: '31px', left: '59%', duration: '30s', delay: '-27s', drift: '-38px', opacity: '0.28', color: '#d9a4e5' },
  { size: '15px', left: '72%', duration: '21s', delay: '-19s', drift: '28px', opacity: '0.38', color: '#f29bc3' },
  { size: '9px', left: '38%', duration: '15s', delay: '-1s', drift: '-16px', opacity: '0.46', color: '#93c7e8' },
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
            '--bubble-start-color': bubble.color,
          }}
        />
      ))}
    </div>
  );
}
