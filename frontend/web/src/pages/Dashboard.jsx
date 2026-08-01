import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Sparkles,
  Target,
  Users
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/dashboard.css';

const METRIC = {
  mint: { accent: 'var(--accent-mint)', tint: 'var(--tint-mint)' },
  coral: { accent: 'var(--accent-coral)', tint: 'var(--tint-coral)' },
  lavender: { accent: 'var(--accent-lavender)', tint: 'var(--tint-lavender)' },
  golden: { accent: 'var(--accent-golden)', tint: 'var(--tint-golden)' }
};

const clampPercentage = (value) => Math.max(0, Math.min(100, Number(value) || 0));

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ value, label, icon: Icon, accent, tint, onClick, title, sub, delay = 0 }) {
  return (
    <button
      type="button"
      className="executive-stat dashboard-reveal"
      style={{ '--stat-accent': accent, '--stat-tint': tint, '--reveal-delay': `${delay}ms` }}
      onClick={onClick}
      disabled={!onClick}
      title={title || label}
    >
      <span className="executive-stat-icon" aria-hidden="true">
        <Icon size={21} strokeWidth={1.9} />
      </span>
      <span className="executive-stat-copy">
        <span className="executive-stat-label">{label}</span>
        <span className="executive-stat-value">{value}</span>
        {sub && <span className="executive-stat-sub">{sub}</span>}
      </span>
      {onClick && (
        <span className="executive-stat-arrow" aria-hidden="true">
          <ArrowUpRight size={16} />
        </span>
      )}
      <span className="executive-stat-glow" aria-hidden="true" />
    </button>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="executive-section-heading dashboard-reveal">
      <div>
        <span className="executive-eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Progress({ value, label }) {
  const percentage = clampPercentage(value);
  return (
    <div className="executive-progress" aria-label={`${label}: ${percentage}%`}>
      <span className="executive-progress-track">
        <span style={{ '--progress': `${percentage}%` }} />
      </span>
      <strong>{percentage}%</strong>
    </div>
  );
}

function TrendBars({ trend }) {
  if (!trend?.length) return null;
  const recent = trend.slice(-12);
  return (
    <div className="executive-trend" role="img" aria-label="Score trend across recent attempts">
      <div className="executive-trend-grid" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="executive-trend-bars">
        {recent.map((point, index) => (
          <div
            key={`${point.date}-${index}`}
            className="executive-trend-column"
            title={`${point.percentage}% on ${new Date(point.date).toLocaleDateString('en-GB')}`}
          >
            <span
              className="executive-trend-value"
              style={{
                '--bar-height': `${Math.max(5, clampPercentage(point.percentage))}%`,
                '--bar-delay': `${index * 55}ms`
              }}
            />
            <small>{new Date(point.date).toLocaleDateString('en-GB', { month: 'short' })}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return <p className="executive-empty">{children}</p>;
}

export default function Dashboard() {
  const { user, company, role } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState(null);
  const [org, setOrg] = useState(null);
  const [rewards, setRewards] = useState(null);

  const isManager = role === 'company_admin' || role === 'hr';
  const isLeader = role === 'team_leader';
  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }).format(new Date()),
    []
  );

  useEffect(() => {
    setMine(null);
    setOrg(null);
    setRewards(null);
    api
      .get('/dashboard/me')
      .then((response) => setMine(response.data.data))
      .catch(() => setMine({}));
    api
      .get('/badges/mine')
      .then((response) => setRewards(response.data.data))
      .catch(() => {});
    if (isManager) {
      api
        .get('/dashboard/company')
        .then((response) => setOrg(response.data.data))
        .catch(() => {});
    }
    if (isLeader) {
      api
        .get('/dashboard/team')
        .then((response) => setOrg(response.data.data))
        .catch(() => {});
    }
  }, [company?.id, isManager, isLeader]);

  const spotlightValue = isManager || isLeader ? org?.avgPercentage : mine?.avgPercentage;
  const spotlightLabel = isManager
    ? 'Company quality score'
    : isLeader
      ? 'Team quality score'
      : 'Your quality score';
  const spotlightPercentage = clampPercentage(spotlightValue);

  return (
    <div className="page dash executive-dashboard" aria-busy={mine === null}>
      <section className="executive-hero dashboard-reveal" aria-labelledby="dashboard-title">
        <div className="executive-hero-glow executive-hero-glow-one" aria-hidden="true" />
        <div className="executive-hero-glow executive-hero-glow-two" aria-hidden="true" />
        <div className="executive-hero-copy">
          <div className="executive-status-pill">
            <Sparkles size={14} aria-hidden="true" />
            <span>Performance workspace</span>
          </div>
          <p className="executive-date">
            <CalendarDays size={15} aria-hidden="true" />
            {today}
          </p>
          <h1 id="dashboard-title">
            {getGreeting()}, <span>{firstName}.</span>
          </h1>
          <p className="executive-hero-subtitle">
            A focused view of learning, assessment quality and progress across{' '}
            <strong>{company?.name || 'your organization'}</strong>.
          </p>
          <div className="executive-hero-actions">
            <button
              type="button"
              className="executive-primary-action"
              onClick={() => navigate('/app/my-tests')}
            >
              Continue learning
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="executive-secondary-action"
              onClick={() => navigate('/app/reports')}
            >
              View insights
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="executive-hero-visual"
          aria-label={`${spotlightLabel}: ${spotlightPercentage}%`}
        >
          <div
            className="executive-score-orbit"
            style={{ '--score-angle': `${spotlightPercentage * 3.6}deg` }}
          >
            <div className="executive-score-core">
              <span>
                {spotlightValue === null || spotlightValue === undefined
                  ? '—'
                  : `${spotlightPercentage}%`}
              </span>
              <small>{spotlightLabel}</small>
            </div>
          </div>
          <div className="executive-live-chip">
            <span aria-hidden="true" />
            Live organization data
          </div>
        </div>
      </section>

      {(isManager || isLeader) && org && (
        <section className="executive-section" aria-labelledby="organization-overview-title">
          <SectionHeading
            eyebrow="Organization pulse"
            title={isManager ? 'Company overview' : 'Team overview'}
            description="The essential indicators for participation, performance and momentum."
          />
          <div className="executive-stat-grid">
            <Stat
              value={org.totalEmployees ?? org.teamSize ?? '—'}
              label={isManager ? 'Employees' : 'Team members'}
              icon={Users}
              {...METRIC.mint}
              onClick={() => navigate('/app/employees')}
              sub="Active learning community"
              delay={40}
            />
            <Stat
              value={org.totalAttempts ?? '—'}
              label="Tests taken"
              icon={ClipboardCheck}
              {...METRIC.coral}
              onClick={() => navigate('/app/tests')}
              sub="Completed submissions"
              delay={90}
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
              sub="Across assigned tests"
              delay={140}
            />
            <Stat
              value={
                org.avgPercentage !== null && org.avgPercentage !== undefined
                  ? `${org.avgPercentage}%`
                  : '—'
              }
              label="Quality score"
              icon={Award}
              {...METRIC.golden}
              sub="Organization average"
              delay={190}
            />
          </div>

          {isManager && org.departmentAverages?.length > 0 && (
            <div className="executive-card executive-department-card dashboard-reveal">
              <div className="executive-card-heading">
                <div>
                  <span className="executive-eyebrow">Capability map</span>
                  <h3>Department performance</h3>
                </div>
                <span className="executive-card-meta">Average score</span>
              </div>
              <div className="executive-department-list">
                {org.departmentAverages.map((entry, index) => (
                  <div key={entry.department} className="executive-department-row">
                    <span className="executive-row-index">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <strong>{entry.department}</strong>
                    {entry.avgPercentage !== null ? (
                      <Progress value={entry.avgPercentage} label={entry.department} />
                    ) : (
                      <span className="executive-muted">No attempts yet</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isManager && org.topPerformers?.length > 0 && (
            <div className="executive-split-grid">
              <div className="executive-card dashboard-reveal">
                <div className="executive-card-heading">
                  <div>
                    <span className="executive-eyebrow">Recognition</span>
                    <h3>Top performers</h3>
                  </div>
                  <Award size={19} aria-hidden="true" />
                </div>
                <ol className="executive-rank-list">
                  {org.topPerformers.map((performer, index) => (
                    <li key={performer.employeeId}>
                      <span className={`executive-rank-number rank-${index + 1}`}>{index + 1}</span>
                      <span className="executive-avatar" aria-hidden="true">
                        {(performer.fullName || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="executive-rank-name">{performer.fullName}</span>
                      <strong className="executive-score-positive">
                        {performer.avgPercentage}%
                      </strong>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="executive-card dashboard-reveal">
                <div className="executive-card-heading">
                  <div>
                    <span className="executive-eyebrow">Coaching opportunity</span>
                    <h3>Needs attention</h3>
                  </div>
                  <Target size={19} aria-hidden="true" />
                </div>
                <ol className="executive-rank-list">
                  {org.needsAttention?.map((performer) => (
                    <li key={performer.employeeId}>
                      <span className="executive-avatar" aria-hidden="true">
                        {(performer.fullName || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="executive-rank-name">{performer.fullName}</span>
                      <strong
                        className={
                          performer.avgPercentage < 60
                            ? 'executive-score-risk'
                            : 'executive-score-watch'
                        }
                      >
                        {performer.avgPercentage}%
                      </strong>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {isLeader && org.members?.length > 0 && (
            <div className="executive-card dashboard-reveal">
              <div className="executive-card-heading">
                <div>
                  <span className="executive-eyebrow">Team detail</span>
                  <h3>Member performance</h3>
                </div>
                <span className="executive-card-meta">{org.members.length} members</span>
              </div>
              <div className="table-wrap">
                <table className="data-table executive-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Tests taken</th>
                      <th>Average score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {org.members.map((member, index) => (
                      <tr key={`${member.fullName}-${index}`}>
                        <td>{member.fullName}</td>
                        <td>{member.attempts}</td>
                        <td>{member.avgPercentage !== null ? `${member.avgPercentage}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="executive-section" aria-labelledby="personal-performance-title">
        <SectionHeading
          eyebrow="Personal momentum"
          title="My performance"
          description="Your latest learning activity and quality indicators in one place."
          action={
            <button
              type="button"
              className="executive-text-action"
              onClick={() => navigate('/app/my-tests')}
            >
              Open my tests <ArrowUpRight size={15} aria-hidden="true" />
            </button>
          }
        />
        <div className="executive-stat-grid">
          <Stat
            value={mine?.testsAttempted ?? '—'}
            label="Tests attempted"
            icon={ClipboardCheck}
            {...METRIC.mint}
            onClick={() => navigate('/app/my-tests')}
            sub="All submitted attempts"
            delay={40}
          />
          <Stat
            value={
              mine?.avgPercentage !== null && mine?.avgPercentage !== undefined
                ? `${mine.avgPercentage}%`
                : '—'
            }
            label="Average score"
            icon={Award}
            {...METRIC.coral}
            sub="Across completed tests"
            delay={90}
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
            sub="Correct response rate"
            delay={140}
          />
          <Stat
            value={mine?.practiceTests ?? '—'}
            label="Practice sessions"
            icon={BookOpen}
            {...METRIC.golden}
            onClick={() => navigate('/app/practice')}
            sub="Self-directed learning"
            delay={190}
          />
        </div>

        <div className="executive-content-grid">
          {mine?.trend?.length > 0 && (
            <div className="executive-card executive-trend-card dashboard-reveal">
              <div className="executive-card-heading">
                <div>
                  <span className="executive-eyebrow">Trajectory</span>
                  <h3>Improvement trend</h3>
                </div>
                <Activity size={19} aria-hidden="true" />
              </div>
              <TrendBars trend={mine.trend} />
            </div>
          )}

          {rewards && (rewards.badges.length > 0 || rewards.totalPoints > 0) && (
            <div className="executive-card executive-rewards-card dashboard-reveal">
              <div className="executive-card-heading">
                <div>
                  <span className="executive-eyebrow">Recognition</span>
                  <h3>Badges &amp; points</h3>
                </div>
                <strong className="executive-points">{rewards.totalPoints} pts</strong>
              </div>
              <div className="executive-badges">
                {rewards.badges.map((badge) => (
                  <span key={badge.id} className="executive-badge" title={badge.description}>
                    <span aria-hidden="true">{badge.icon}</span>
                    {badge.name}
                  </span>
                ))}
                {rewards.badges.length === 0 && (
                  <EmptyState>Complete assessments to earn your first badge.</EmptyState>
                )}
              </div>
            </div>
          )}
        </div>

        {(mine?.strengths?.length > 0 || mine?.weaknesses?.length > 0) && (
          <div className="executive-split-grid">
            <div className="executive-card dashboard-reveal">
              <div className="executive-card-heading">
                <div>
                  <span className="executive-eyebrow">Strong signals</span>
                  <h3>Strengths</h3>
                </div>
              </div>
              <ul className="executive-skill-list">
                {mine.strengths?.map((entry) => (
                  <li key={entry.categoryId}>
                    <span>{entry.category}</span>
                    <Progress value={entry.percentage} label={entry.category} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="executive-card dashboard-reveal">
              <div className="executive-card-heading">
                <div>
                  <span className="executive-eyebrow">Next best action</span>
                  <h3>Focus areas</h3>
                </div>
              </div>
              <ul className="executive-skill-list executive-skill-list-focus">
                {mine.weaknesses?.map((entry) => (
                  <li key={entry.categoryId}>
                    <span>{entry.category}</span>
                    <Progress value={entry.percentage} label={entry.category} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {(mine?.subStrengths?.length > 0 || mine?.subWeaknesses?.length > 0) && (
          <div className="executive-split-grid executive-subcategory-grid">
            <div className="executive-card dashboard-reveal">
              <div className="executive-card-heading">
                <div>
                  <span className="executive-eyebrow">Detailed capability</span>
                  <h3>Sub-category strengths</h3>
                </div>
              </div>
              <ul className="executive-compact-list">
                {mine.subStrengths?.map((entry) => (
                  <li key={entry.subCategoryId}>
                    <span>{entry.subCategory}</span>
                    <strong>{entry.percentage}%</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="executive-card dashboard-reveal">
              <div className="executive-card-heading">
                <div>
                  <span className="executive-eyebrow">Detailed opportunity</span>
                  <h3>Sub-category focus</h3>
                </div>
              </div>
              <ul className="executive-compact-list">
                {mine.subWeaknesses?.map((entry) => (
                  <li key={entry.subCategoryId}>
                    <span>{entry.subCategory}</span>
                    <strong>{entry.percentage}%</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mine && mine.testsAttempted === 0 && (
          <div className="executive-onboarding dashboard-reveal">
            <div className="executive-onboarding-icon" aria-hidden="true">
              <Sparkles size={22} />
            </div>
            <div>
              <span className="executive-eyebrow">Your next chapter</span>
              <h3>Get started with Zorfly</h3>
              <ol>
                {isManager ? (
                  <>
                    <li>Add your departments, teams and employees.</li>
                    <li>Build questions in the Question Bank.</li>
                    <li>Create, publish and assign your first test.</li>
                    <li>Add a recurring schedule for automatic assessments.</li>
                  </>
                ) : (
                  <>
                    <li>Open My Tests to see assessments assigned to you.</li>
                    <li>Use Practice to sharpen your focus areas.</li>
                    <li>Review mistakes and explanations after every test.</li>
                  </>
                )}
              </ol>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
