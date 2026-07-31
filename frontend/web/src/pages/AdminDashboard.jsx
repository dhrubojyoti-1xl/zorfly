import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ClipboardCheck,
  Activity,
  Award,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import TrendChart from '../components/TrendChart.jsx';

// Company Admin / HR dashboard (DSH-01). Same API (/dashboard/company, /me,
// /badges/mine) — this component only re-presents that data as an at-a-glance
// company overview: dynamic insights, KPIs, a quality trend and department roll-up.

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const fmt = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-GB'));

const DASH_ICONS = {
  users: Users,
  clipboard: ClipboardCheck,
  pulse: Activity,
  award: Award,
  alert: AlertTriangle,
  check: CheckCircle2,
  trophy: Trophy,
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown
};

// Consistent iconography (Lucide, matches the sidebar).
function DIco({ name }) {
  const Cmp = DASH_ICONS[name];
  if (!Cmp) return null;
  const small = name === 'arrow-up' || name === 'arrow-down';
  return <Cmp size={small ? 14 : 20} strokeWidth={1.9} aria-hidden="true" />;
}

// Tiny inline sparkline for a KPI card — only rendered where the card already
// has a real monthly series behind it (never fabricated for cards without one).
function KpiSparkline({ series }) {
  const points = (series || []).map((m) => m.avgPercentage ?? m.attempts ?? 0);
  if (points.length < 2) return null;
  const W = 72;
  const H = 22;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const x = (i) => (i * W) / (points.length - 1);
  const y = (v) => H - ((v - min) / range) * (H - 4) - 2;
  const line = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      className="kpi-sparkline"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
    >
      <path d={line} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Derive human insight cards from the raw company figures. Every card is backed
// by real data — nothing is fabricated when the data isn't there.
function buildInsights(org) {
  if (!org) return [];
  const cards = [];
  const attention = (org.needsAttention || []).filter(
    (p) => p.avgPercentage !== null && p.avgPercentage !== undefined && p.avgPercentage < 60
  );
  if (attention.length > 0) {
    cards.push({
      tone: 'crit',
      icon: 'alert',
      kicker: 'Needs attention',
      title: `${attention.length} employee${attention.length > 1 ? 's' : ''} below 60%`,
      body: `Lowest: ${attention[attention.length - 1].fullName} at ${attention[attention.length - 1].avgPercentage}%.`,
      action: { label: 'Review employees', to: '/app/employees' }
    });
  } else if (org.totalAttempts > 0) {
    cards.push({
      tone: 'good',
      icon: 'check',
      kicker: 'On track',
      title: 'Everyone is above 60%',
      body: 'No employees are currently in the at-risk band.',
      action: { label: 'View leaderboard', to: '/app/leaderboard' }
    });
  }

  const participation = org.participationRate;
  if (participation !== null && participation !== undefined) {
    const low = participation < 60;
    cards.push({
      tone: low ? 'warn' : 'good',
      icon: 'users',
      kicker: low ? 'Low participation' : 'Participation',
      title: `${participation}% have taken a test`,
      body: low
        ? 'Assign or schedule assessments to lift coverage.'
        : 'Healthy assessment coverage across the company.',
      action: low
        ? { label: 'Schedule tests', to: '/app/schedules' }
        : { label: 'View schedules', to: '/app/schedules' }
    });
  }

  const series = (org.monthly || []).filter((m) => m.attempts > 0);
  if (series.length >= 2) {
    const last = series[series.length - 1].avgPercentage;
    const prev = series[series.length - 2].avgPercentage;
    const delta = Math.round((last - prev) * 10) / 10;
    if (delta !== 0) {
      cards.push({
        tone: delta > 0 ? 'good' : 'warn',
        icon: delta > 0 ? 'trend-up' : 'trend-down',
        kicker: 'Quality trend',
        title: `${delta > 0 ? '+' : ''}${delta} pts month over month`,
        body: `Average quality moved from ${prev}% to ${last}%.`,
        action: { label: 'See reports', to: '/app/tests' }
      });
    }
  }

  const ranked = (org.departmentAverages || []).filter((d) => d.avgPercentage !== null);
  if (ranked.length > 0) {
    const top = [...ranked].sort((a, b) => b.avgPercentage - a.avgPercentage)[0];
    cards.push({
      tone: 'good',
      icon: 'trophy',
      kicker: 'Top department',
      title: `${top.department} leads at ${top.avgPercentage}%`,
      body: `Top performer: ${top.topPerformer}.`,
      action: { label: 'View departments', to: '/app/departments' }
    });
  }

  return cards.slice(0, 4);
}

// Clickable KPI card (stat cards navigate to their list pages — QA standard).
function KpiCard({ icon, accent, tint, label, value, to, trend, sub, series, navigate }) {
  return (
    <button
      type="button"
      className="kpi"
      style={{ '--kpi-accent': accent, '--kpi-tint': tint }}
      onClick={() => to && navigate(to)}
      title={`Open ${label}`}
    >
      <span className="kpi-icon" aria-hidden="true">
        <DIco name={icon} />
      </span>
      <span className="kpi-body">
        <span className="kpi-value">{value}</span>
        <span className="kpi-label">{label}</span>
        {sub && <span className="kpi-sub">{sub}</span>}
        {trend && (
          <span className={`trend-pill trend-pill-${trend.dir}`}>
            <DIco name={trend.dir === 'up' ? 'arrow-up' : 'arrow-down'} />
            {trend.text}
          </span>
        )}
        {series && <KpiSparkline series={series} />}
      </span>
    </button>
  );
}

export default function AdminDashboard() {
  const { user, company } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [mine, setMine] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api
        .get('/dashboard/company')
        .then((r) => r.data.data)
        .catch(() => null),
      api
        .get('/dashboard/me')
        .then((r) => r.data.data)
        .catch(() => null),
      api
        .get('/badges/mine')
        .then((r) => r.data.data)
        .catch(() => null)
    ]).then(([o, m, rw]) => {
      if (!active) return;
      setOrg(o);
      setMine(m);
      setRewards(rw);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [company?.id]);

  const insights = useMemo(() => buildInsights(org), [org]);

  // Honest KPI deltas — only where history actually exists in the monthly series.
  const attemptDelta = useMemo(() => {
    const m = org?.monthly || [];
    if (m.length < 2) return null;
    return m[m.length - 1].attempts - m[m.length - 2].attempts;
  }, [org]);
  const qualityDelta = useMemo(() => {
    const s = (org?.monthly || []).filter((x) => x.attempts > 0);
    if (s.length < 2) return null;
    return Math.round((s[s.length - 1].avgPercentage - s[s.length - 2].avgPercentage) * 10) / 10;
  }, [org]);

  return (
    <div className="page dash">
      {/* Everything sits inside one white panel (per the reference layout)
          rather than floating as separate cards on the page background. */}
      <div className="dash-panel">
        <div className="dash-head">
          <div className="dash-head-main">
            <h2 className="dash-title">Company Overview</h2>
            <p className="dash-subtitle">
              Welcome back, {user?.fullName?.split(' ')[0] || 'there'}. Here’s how {company?.name}{' '}
              is performing.
            </p>
          </div>
          <div className="dash-head-actions">
            <span className="dash-period">Last 6 months</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/app/employees')}
            >
              Manage employees
            </button>
          </div>
        </div>

        {loading && <div className="card dash-loading">Loading company overview…</div>}

        {!loading && !org && (
          <div className="card">
            <h3 className="card-title">Company overview unavailable</h3>
            <p className="page-subtitle">
              We couldn’t load company statistics right now. Please refresh to try again.
            </p>
          </div>
        )}

        {!loading && org && (
          <>
            {insights.length > 0 && (
              <div className="insight-grid">
                {insights.map((card, i) => (
                  <div key={i} className={`insight insight-${card.tone}`}>
                    <span className="insight-badge" aria-hidden="true">
                      <DIco name={card.icon} />
                    </span>
                    <div className="insight-content">
                      <span className="insight-kicker">{card.kicker}</span>
                      <span className="insight-title">{card.title}</span>
                      <span className="insight-body">{card.body}</span>
                      {card.action && (
                        <button
                          type="button"
                          className="insight-action"
                          onClick={() => navigate(card.action.to)}
                        >
                          {card.action.label}{' '}
                          <span className="insight-arrow" aria-hidden="true">
                            →
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="kpi-grid">
              <KpiCard
                navigate={navigate}
                icon="users"
                accent="var(--accent-mint)"
                tint="var(--tint-mint)"
                label="Active Employees"
                value={fmt(org.totalEmployees)}
                to="/app/employees"
                sub="in your workforce"
              />
              <KpiCard
                navigate={navigate}
                icon="clipboard"
                accent="var(--accent-coral)"
                tint="var(--tint-coral)"
                label="Assessments Taken"
                value={fmt(org.totalAttempts)}
                to="/app/tests"
                trend={
                  attemptDelta !== null
                    ? {
                        dir: attemptDelta >= 0 ? 'up' : 'down',
                        text: `${attemptDelta >= 0 ? '+' : ''}${fmt(attemptDelta)} vs last month`
                      }
                    : null
                }
                sub={attemptDelta === null ? 'official submissions' : undefined}
              />
              <KpiCard
                navigate={navigate}
                icon="pulse"
                accent="var(--accent-lavender)"
                tint="var(--tint-lavender)"
                label="Participation"
                value={pct(org.participationRate)}
                to="/app/employees"
                sub="have taken ≥ 1 test"
              />
              <KpiCard
                navigate={navigate}
                icon="award"
                accent="var(--accent-golden)"
                tint="var(--tint-golden)"
                label="Average Quality"
                value={pct(org.avgPercentage)}
                to="/app/leaderboard"
                series={org.monthly}
                trend={
                  qualityDelta !== null
                    ? {
                        dir: qualityDelta >= 0 ? 'up' : 'down',
                        text: `${qualityDelta >= 0 ? '+' : ''}${qualityDelta} pts`
                      }
                    : null
                }
                sub={qualityDelta === null ? 'across all assessments' : undefined}
              />
            </div>

            <div className="dash-grid">
              <div className="card dash-chart-card">
                <div className="card-head-row">
                  <h3 className="card-title">Quality Trend</h3>
                  <span className="card-hint">Average score per month</span>
                </div>
                <TrendChart data={org.monthly} ariaLabel="Quality trend, last 6 months" />
              </div>

              <div className="card dash-activity-card">
                <div className="card-head-row">
                  <h3 className="card-title">Recent Activity</h3>
                  <button type="button" className="link-btn" onClick={() => navigate('/app/tests')}>
                    View all
                  </button>
                </div>
                {org.recentActivity?.length ? (
                  <ul className="activity">
                    {org.recentActivity.map((a, i) => (
                      <li key={i} className="activity-item">
                        <span className="activity-avatar" aria-hidden="true">
                          {(a.name || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="activity-main">
                          <span className="activity-text">
                            <strong>{a.name}</strong> completed {a.test}
                          </span>
                          <span className="activity-time">{timeAgo(a.submittedAt)}</span>
                        </span>
                        <span className={`score-pill ${a.passed ? 'score-pass' : 'score-fail'}`}>
                          {a.percentage}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dash-empty">No assessments have been submitted yet.</p>
                )}
              </div>
            </div>

            {org.departmentAverages?.length > 0 && (
              <div className="card">
                <div className="card-head-row">
                  <h3 className="card-title">Department Performance</h3>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => navigate('/app/departments')}
                  >
                    Manage
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table dept-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Avg Quality</th>
                        <th>Participation</th>
                        <th>Top Performer</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {org.departmentAverages.map((d) => (
                        <tr key={d.department}>
                          <td className="cell-wrap">
                            <strong>{d.department}</strong>
                          </td>
                          <td>
                            {d.avgPercentage !== null ? `${d.avgPercentage}%` : 'No attempts'}
                          </td>
                          <td>
                            <span className="pbar" aria-label={`${d.participation}% participation`}>
                              <span
                                className="pbar-fill"
                                style={{ width: `${d.participation}%` }}
                              />
                            </span>
                            <span className="pbar-num">{d.participation}%</span>
                          </td>
                          <td className="cell-wrap">{d.topPerformer}</td>
                          <td>
                            <span className={`trend-tag trend-${d.trend}`}>
                              {d.trend === 'up' ? '▲' : '▼'} {d.trend}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(org.topPerformers?.length > 0 || org.needsAttention?.length > 0) && (
              <div className="dash-two-col">
                <div className="card">
                  <h3 className="card-title">Top Performers</h3>
                  <ol className="rank-list">
                    {org.topPerformers.map((p, i) => (
                      <li key={p.employeeId} className="rank-item">
                        <span className={`rank-no${i < 3 ? ` rank-no-${i + 1}` : ''}`}>
                          {i + 1}
                        </span>
                        <span className="rank-avatar" aria-hidden="true">
                          {(p.fullName || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="rank-main">
                          <span className="rank-name">{p.fullName}</span>
                          {p.department && <span className="rank-sub">{p.department}</span>}
                        </span>
                        <span className="rank-score good">{p.avgPercentage}%</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="card">
                  <h3 className="card-title">Needs Attention</h3>
                  <ol className="rank-list">
                    {org.needsAttention.map((p) => {
                      const critical = p.avgPercentage !== null && p.avgPercentage < 60;
                      return (
                        <li key={p.employeeId} className="rank-item">
                          <span className="rank-avatar" aria-hidden="true">
                            {(p.fullName || '?').charAt(0).toUpperCase()}
                          </span>
                          <span className="rank-main">
                            <span className="rank-name">{p.fullName}</span>
                            {p.department && <span className="rank-sub">{p.department}</span>}
                          </span>
                          <span
                            className={`priority-chip ${critical ? 'priority-high' : 'priority-medium'}`}
                          >
                            {critical ? 'High' : 'Medium'}
                          </span>
                          <span className={`rank-score ${critical ? 'bad' : 'warn'}`}>
                            {p.avgPercentage !== null ? `${p.avgPercentage}%` : '—'}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            )}

            <div className="card my-strip">
              <div className="card-head-row">
                <h3 className="card-title">Your Performance</h3>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => navigate('/app/my-tests')}
                >
                  My tests
                </button>
              </div>
              <div className="my-strip-grid">
                <div className="mini-stat">
                  <span className="mini-value">{mine?.testsAttempted ?? '—'}</span>
                  <span className="mini-label">Tests taken</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-value">{pct(mine?.avgPercentage)}</span>
                  <span className="mini-label">Avg score</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-value">{pct(mine?.avgAccuracy)}</span>
                  <span className="mini-label">Accuracy</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-value">{mine?.practiceTests ?? '—'}</span>
                  <span className="mini-label">Practice</span>
                </div>
              </div>
              {rewards && (rewards.badges?.length > 0 || rewards.totalPoints > 0) && (
                <div className="my-badges">
                  <span className="my-points">{rewards.totalPoints} points</span>
                  {rewards.badges.slice(0, 6).map((b) => (
                    <span key={b.id} className="badge-chip" title={b.description}>
                      <span aria-hidden="true">{b.icon}</span> {b.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
