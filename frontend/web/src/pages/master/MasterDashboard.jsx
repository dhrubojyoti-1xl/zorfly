import { useEffect, useState } from 'react';
import { api, apiError } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

// Platform owner dashboard — headline metrics, growth, revenue, plan mix,
// email health and the busiest tenants. Read-only; tenant content stays private.

// Consistent stroke icons (match the tenant app's iconography — no emoji).
function MIco({ name }) {
  const c = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };
  switch (name) {
    case 'building':
      return (
        <svg {...c}>
          <rect x="4" y="3" width="11" height="18" rx="1.6" />
          <path d="M15 8h5v13h-5" />
          <path d="M7.5 7h4M7.5 11h4M7.5 15h4" />
        </svg>
      );
    case 'check':
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      );
    case 'ban':
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6l12.8 12.8" />
        </svg>
      );
    case 'users':
      return (
        <svg {...c}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" />
          <path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg {...c}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
          <path d="M3 12h18" />
        </svg>
      );
    case 'clipboard':
      return (
        <svg {...c}>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V2.8h6V4" />
          <path d="M8.5 12l2 2 4-4" />
        </svg>
      );
    default:
      return null;
  }
}

function StatCard({ icon, value, label, tone }) {
  return (
    <div className={`master-stat master-stat-${tone || 'primary'}`}>
      <span className="master-stat-icon" aria-hidden="true">
        <MIco name={icon} />
      </span>
      <span className="master-stat-value">{Number(value).toLocaleString('en-GB')}</span>
      <span className="master-stat-label">{label}</span>
    </div>
  );
}

function GrowthChart({ growth }) {
  const max = Math.max(1, ...growth.map((g) => g.signups));
  return (
    <div className="growth-chart" role="img" aria-label="Company signups over the last 6 months">
      {growth.map((g) => (
        <div key={g.month} className="growth-col" title={`${g.signups} signups in ${g.label}`}>
          <div className="growth-bar-track">
            <div className="growth-bar" style={{ height: `${(g.signups / max) * 100}%` }} />
          </div>
          <span className="growth-value">{g.signups}</span>
          <span className="growth-label">{g.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function MasterDashboard() {
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get('/master/dashboard')
      .then((r) => setData(r.data.data))
      .catch((error) => toast.show(apiError(error).message, 'error'));
  }, [toast]);

  if (!data)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  const planMax = Math.max(1, ...data.planDistribution.map((p) => p.count));

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">
          Live health of the whole platform.{' '}
          {data.maintenanceMode && (
            <span className="state-badge state-closed">Maintenance mode is ON</span>
          )}
        </p>
      </div>

      <div className="master-stat-grid">
        <StatCard
          icon="building"
          value={data.totals.totalCompanies}
          label="Companies"
          tone="primary"
        />
        <StatCard icon="check" value={data.totals.activeCompanies} label="Active" tone="success" />
        <StatCard
          icon="ban"
          value={data.totals.suspendedCompanies}
          label="Suspended"
          tone="danger"
        />
        <StatCard icon="users" value={data.totals.totalUsers} label="Users" tone="info" />
        <StatCard
          icon="briefcase"
          value={data.totals.totalEmployees}
          label="Employees"
          tone="teal"
        />
        <StatCard
          icon="clipboard"
          value={data.totals.totalAttempts}
          label="Tests Submitted"
          tone="amber"
        />
      </div>

      <div className="master-two-col">
        <div className="card">
          <h3 className="card-title">Company Signups (last 6 months)</h3>
          <GrowthChart growth={data.growth} />
        </div>

        <div className="card">
          <h3 className="card-title">Monthly Recurring Revenue</h3>
          <div className="revenue-hero">
            <span className="revenue-amount">₹{data.revenue.mrrInr.toLocaleString('en-IN')}</span>
            {data.revenue.mrrUsd > 0 && (
              <span className="revenue-secondary">
                + ${data.revenue.mrrUsd.toLocaleString('en-IN')}
              </span>
            )}
            <span className="revenue-caption">per month</span>
          </div>
          <div className="revenue-breakdown">
            <span>
              <strong>{data.revenue.payingCompanies}</strong> paying
            </span>
            <span>
              <strong>{data.revenue.freeCompanies}</strong> on free plan
            </span>
            <span>
              <strong>{data.revenue.noPlan}</strong> no plan
            </span>
          </div>
        </div>
      </div>

      <div className="master-two-col">
        <div className="card">
          <h3 className="card-title">Plan Distribution</h3>
          {data.planDistribution.length === 0 ? (
            <p className="answer-hint">No subscriptions yet.</p>
          ) : (
            <div className="dist-list">
              {data.planDistribution.map((plan) => (
                <div key={plan.name} className="dist-row">
                  <span className="dist-name">{plan.name}</span>
                  <div className="dist-track">
                    <div
                      className="dist-fill"
                      style={{ width: `${(plan.count / planMax) * 100}%` }}
                    />
                  </div>
                  <span className="dist-count">{plan.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Email Delivery</h3>
          <div className="email-health">
            <span className="health-chip health-sent">{data.email.sent} Sent</span>
            <span className="health-chip health-logged">{data.email.logged} Logged (dev)</span>
            <span className="health-chip health-failed">{data.email.failed} Failed</span>
          </div>
          <h3 className="card-title" style={{ marginTop: '1.2rem' }}>
            Busiest Companies
          </h3>
          {data.topCompanies.length === 0 ? (
            <p className="answer-hint">No test activity yet.</p>
          ) : (
            <ol className="review-list">
              {data.topCompanies.map((c) => (
                <li key={c.name}>
                  {c.name} — {c.attempts} tests
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
