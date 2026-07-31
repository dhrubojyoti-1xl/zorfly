import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ClipboardCheck, Activity, Award, BookOpen, Target } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// Role-aware dashboard with REAL data (DSH-01/02):
// - employee: own stats, strengths/weaknesses, trend
// - team_leader: adds team stats
// - company_admin / hr: adds company stats

// Same metric-card language as the admin dashboard: tinted surface, solid
// accent icon circle, figure + label. Clickable cards still navigate.
function Stat({ value, label, icon: Icon, accent, tint, onClick, title, sub }) {
  return (
    <button
      type="button"
      className="kpi"
      style={{ '--kpi-accent': accent, '--kpi-tint': tint }}
      onClick={onClick}
      disabled={!onClick}
      title={title || label}
    >
      <span className="kpi-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.9} />
      </span>
      <span className="kpi-body">
        <span className="kpi-value">{value}</span>
        <span className="kpi-label">{label}</span>
        {sub && <span className="kpi-sub">{sub}</span>}
      </span>
    </button>
  );
}

const METRIC = {
  mint: { accent: 'var(--accent-mint)', tint: 'var(--tint-mint)' },
  coral: { accent: 'var(--accent-coral)', tint: 'var(--tint-coral)' },
  lavender: { accent: 'var(--accent-lavender)', tint: 'var(--tint-lavender)' },
  golden: { accent: 'var(--accent-golden)', tint: 'var(--tint-golden)' }
};

function TrendBars({ trend }) {
  if (!trend?.length) return null;
  const recent = trend.slice(-12);
  return (
    <div className="trend-bars" role="img" aria-label="Score trend">
      {recent.map((point, index) => (
        <div
          key={index}
          className="trend-bar-wrap"
          title={`${point.percentage}% on ${new Date(point.date).toLocaleDateString('en-GB')}`}
        >
          <div className="trend-bar" style={{ height: `${Math.max(4, point.percentage)}%` }} />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, company, role } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState(null);
  const [org, setOrg] = useState(null);
  const [rewards, setRewards] = useState(null);

  const isManager = role === 'company_admin' || role === 'hr';
  const isLeader = role === 'team_leader';

  useEffect(() => {
    setMine(null);
    setOrg(null);
    setRewards(null);
    api
      .get('/dashboard/me')
      .then((r) => setMine(r.data.data))
      .catch(() => setMine({}));
    api
      .get('/badges/mine')
      .then((r) => setRewards(r.data.data))
      .catch(() => {});
    if (isManager)
      api
        .get('/dashboard/company')
        .then((r) => setOrg(r.data.data))
        .catch(() => {});
    if (isLeader)
      api
        .get('/dashboard/team')
        .then((r) => setOrg(r.data.data))
        .catch(() => {});
  }, [company?.id, isManager, isLeader]);

  return (
    <div className="page dash">
      <div className="dash-panel">
        <div className="dash-head">
          <div className="dash-head-main">
            <h2 className="dash-title">Dashboard</h2>
            <p className="dash-subtitle">
              Welcome back, {user?.fullName?.split(' ')[0] || 'there'}. You are viewing{' '}
              {company?.name}.
            </p>
          </div>
          <div className="dash-head-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/app/my-tests')}
            >
              My tests
            </button>
          </div>
        </div>

        {(isManager || isLeader) && org && (
          <>
            <h3 className="section-title">{isManager ? 'Company Overview' : 'Team Overview'}</h3>
            <div className="kpi-grid">
              <Stat
                value={org.totalEmployees ?? org.teamSize ?? '—'}
                label={isManager ? 'Employees' : 'Team Members'}
                icon={Users}
                {...METRIC.mint}
                onClick={() => navigate('/app/employees')}
              />
              <Stat
                value={org.totalAttempts ?? '—'}
                label="Tests Taken"
                icon={ClipboardCheck}
                {...METRIC.coral}
                onClick={() => navigate('/app/tests')}
              />
              <Stat
                value={
                  org.participationRate !== null && org.participationRate !== undefined
                    ? `${org.participationRate}%`
                    : '—'
                }
                label="Participation"
                icon={Activity}
                {...METRIC.lavender}
              />
              <Stat
                value={
                  org.avgPercentage !== null && org.avgPercentage !== undefined
                    ? `${org.avgPercentage}%`
                    : '—'
                }
                label="Average Quality Score"
                icon={Award}
                {...METRIC.golden}
              />
            </div>

            {isManager && org.departmentAverages?.length > 0 && (
              <div className="card">
                <h3 className="card-title">Department Averages</h3>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-serial">SR. No.</th>
                        <th>Department</th>
                        <th>Average Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {org.departmentAverages.map((entry, index) => (
                        <tr key={entry.department}>
                          <td className="col-serial">{index + 1}</td>
                          <td className="cell-wrap">{entry.department}</td>
                          <td>
                            {entry.avgPercentage !== null
                              ? `${entry.avgPercentage}%`
                              : 'No attempts yet'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isManager && org.topPerformers?.length > 0 && (
              <div className="editor-two-col">
                <div className="card">
                  <h3 className="card-title">Top Performers</h3>
                  <ol className="rank-list">
                    {org.topPerformers.map((performer, i) => (
                      <li key={performer.employeeId} className="rank-item">
                        <span className={`rank-no${i < 3 ? ` rank-no-${i + 1}` : ''}`}>
                          {i + 1}
                        </span>
                        <span className="rank-avatar" aria-hidden="true">
                          {(performer.fullName || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="rank-main">
                          <span className="rank-name">{performer.fullName}</span>
                        </span>
                        <span className="rank-score good">{performer.avgPercentage}%</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="card">
                  <h3 className="card-title">Needs Attention</h3>
                  <ol className="rank-list">
                    {org.needsAttention.map((performer) => (
                      <li key={performer.employeeId} className="rank-item">
                        <span className="rank-avatar" aria-hidden="true">
                          {(performer.fullName || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="rank-main">
                          <span className="rank-name">{performer.fullName}</span>
                        </span>
                        <span
                          className={`rank-score ${performer.avgPercentage < 60 ? 'bad' : 'warn'}`}
                        >
                          {performer.avgPercentage}%
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {isLeader && org.members?.length > 0 && (
              <div className="card">
                <h3 className="card-title">Team Members</h3>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="col-serial">SR. No.</th>
                        <th>Member</th>
                        <th>Tests Taken</th>
                        <th>Average Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {org.members.map((member, index) => (
                        <tr key={member.fullName + index}>
                          <td className="col-serial">{index + 1}</td>
                          <td className="cell-wrap">{member.fullName}</td>
                          <td>{member.attempts}</td>
                          <td>
                            {member.avgPercentage !== null ? `${member.avgPercentage}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <h3 className="section-title">My Performance</h3>
        <div className="kpi-grid">
          <Stat
            value={mine?.testsAttempted ?? '—'}
            label="Tests Attempted"
            icon={ClipboardCheck}
            {...METRIC.mint}
            onClick={() => navigate('/app/my-tests')}
          />
          <Stat
            value={
              mine?.avgPercentage !== null && mine?.avgPercentage !== undefined
                ? `${mine.avgPercentage}%`
                : '—'
            }
            label="Average Score"
            icon={Award}
            {...METRIC.coral}
          />
          <Stat
            value={
              mine?.avgAccuracy !== null && mine?.avgAccuracy !== undefined
                ? `${mine.avgAccuracy}%`
                : '—'
            }
            label="Accuracy"
            icon={Target}
            {...METRIC.lavender}
          />
          <Stat
            value={mine?.practiceTests ?? '—'}
            label="Practice Sessions"
            icon={BookOpen}
            {...METRIC.golden}
            onClick={() => navigate('/app/practice')}
          />
        </div>

        {rewards && (rewards.badges.length > 0 || rewards.totalPoints > 0) && (
          <div className="card">
            <h3 className="card-title">My Badges &amp; Points — {rewards.totalPoints} points</h3>
            <div className="badge-strip">
              {rewards.badges.map((badge) => (
                <span key={badge.id} className="badge-chip" title={badge.description}>
                  <span aria-hidden="true">{badge.icon}</span> {badge.name}
                </span>
              ))}
              {rewards.badges.length === 0 && (
                <p className="answer-hint">No badges yet — complete assessments to earn them.</p>
              )}
            </div>
          </div>
        )}

        {mine?.trend?.length > 0 && (
          <div className="card">
            <h3 className="card-title">Improvement Trend</h3>
            <TrendBars trend={mine.trend} />
          </div>
        )}

        {(mine?.strengths?.length > 0 || mine?.weaknesses?.length > 0) && (
          <div className="editor-two-col">
            <div className="card">
              <h3 className="card-title">Strengths</h3>
              <ul className="rank-list">
                {mine.strengths.map((entry) => (
                  <li key={entry.categoryId} className="rank-item">
                    <span className="rank-main">
                      <span className="rank-name">{entry.category}</span>
                    </span>
                    <span className="rank-score good">{entry.percentage}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 className="card-title">Weaknesses (practise these)</h3>
              <ul className="rank-list">
                {mine.weaknesses.map((entry) => (
                  <li key={entry.categoryId} className="rank-item">
                    <span className="rank-main">
                      <span className="rank-name">{entry.category}</span>
                    </span>
                    <span className={`rank-score ${entry.percentage < 60 ? 'bad' : 'warn'}`}>
                      {entry.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {(mine?.subStrengths?.length > 0 || mine?.subWeaknesses?.length > 0) && (
          <div className="editor-two-col">
            <div className="card">
              <h3 className="card-title">Strengths (by sub-category)</h3>
              <ul className="review-list">
                {mine.subStrengths.map((entry) => (
                  <li key={entry.subCategoryId}>
                    {entry.subCategory} — {entry.percentage}%
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 className="card-title">Weaknesses by sub-category</h3>
              <ul className="review-list">
                {mine.subWeaknesses.map((entry) => (
                  <li key={entry.subCategoryId}>
                    {entry.subCategory} — {entry.percentage}%
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mine && mine.testsAttempted === 0 && (
          <div className="card">
            <h3 className="card-title">Getting Started</h3>
            <ol className="getting-started">
              {isManager ? (
                <>
                  <li>Add your departments, teams and employees.</li>
                  <li>Build questions in the Question Bank (8 types supported).</li>
                  <li>Create a test, publish it and assign it.</li>
                  <li>Add a recurring schedule so assessments run automatically.</li>
                </>
              ) : (
                <>
                  <li>Open My Tests to see assessments assigned to you.</li>
                  <li>
                    Use Practice to sharpen your weak categories — it never affects your official
                    score.
                  </li>
                  <li>After each test, review every mistake and read the explanations.</li>
                </>
              )}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
