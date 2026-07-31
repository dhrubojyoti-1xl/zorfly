// Lightweight area chart for a monthly quality trend (0–100 scale). Extracted
// from AdminDashboard.jsx so the Reports page's company_performance preview
// can reuse the exact same chart instead of forking it — the only chart type
// in the app, hand-rolled inline SVG (no charting library anywhere).
export default function TrendChart({
  data,
  emptyLabel = 'Not enough submitted assessments yet to chart a trend.',
  ariaLabel = 'Quality trend'
}) {
  const points = (data || []).map((d) => d.avgPercentage);
  const hasData = points.some((v) => v > 0);
  const W = 640;
  const H = 200;
  const padX = 28;
  const padY = 22;
  const n = points.length;
  if (!hasData || n < 2) {
    return <p className="dash-empty">{emptyLabel}</p>;
  }
  const x = (i) => padX + (i * (W - padX * 2)) / (n - 1);
  const y = (v) => H - padY - (Math.max(0, Math.min(100, v)) / 100) * (H - padY * 2);
  const line = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H - padY} L ${x(0).toFixed(1)} ${H - padY} Z`;
  return (
    <svg
      className="dash-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--colour-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--colour-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 50, 100].map((g) => (
        <line key={g} className="chart-grid" x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} />
      ))}
      <path d={area} fill="url(#trendFill)" />
      <path d={line} className="dash-line" fill="none" />
      {points.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === n - 1 ? 4.5 : 3}
          className={i === n - 1 ? 'dash-dot dash-dot-last' : 'dash-dot'}
        />
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 4} className="dash-xlabel" textAnchor="middle">
          {d.label}
        </text>
      ))}
    </svg>
  );
}
