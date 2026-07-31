import { useCallback, useEffect, useState } from 'react';
import SelectField from '../components/SelectField.jsx';
import TrendChart from '../components/TrendChart.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { downloadFile } from '../utils/download.js';
import { REPORT_KIND_OPTIONS } from '../utils/constants.js';

const pct = (value) => (value === null || value === undefined ? '—' : `${value}%`);

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: new Date(2000, i, 1).toLocaleString('en-GB', { month: 'long' })
}));
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
  value: String(CURRENT_YEAR - i),
  label: String(CURRENT_YEAR - i)
}));

// Analytics & Reports hub (ANL-01/02, RPT-01/02). Six report kinds, each
// exportable as PDF/Excel/CSV; a second tab covers ANL-02's per-question
// difficulty/discrimination analytics.
export default function Reports() {
  const toast = useToast();
  const [tab, setTab] = useState('reports'); // 'reports' | 'questions'

  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [drives, setDrives] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tests, setTests] = useState([]);

  const [kind, setKind] = useState('company_performance');
  const [params, setParams] = useState({
    userId: '',
    teamId: '',
    departmentId: '',
    driveId: '',
    period: 'monthly',
    month: String(new Date().getMonth()),
    year: String(CURRENT_YEAR),
    scope: 'company',
    scopeId: '',
    ldbPeriod: 'all'
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  const [qFilters, setQFilters] = useState({ testId: '', categoryId: '', flaggedOnly: false });
  const [qRows, setQRows] = useState([]);
  const [qTotalCount, setQTotalCount] = useState(0);
  const [qPage, setQPage] = useState(1);
  const [qLoading, setQLoading] = useState(false);

  useEffect(() => {
    api
      .get('/employees', { params: { limit: 100 } })
      .then((r) => setEmployees(r.data.data.rows))
      .catch(() => {});
    api
      .get('/teams', { params: { limit: 100 } })
      .then((r) => setTeams(r.data.data.rows))
      .catch(() => {});
    api
      .get('/departments', { params: { limit: 100 } })
      .then((r) => setDepartments(r.data.data.rows))
      .catch(() => {});
    api
      .get('/drives', { params: { limit: 100 } })
      .then((r) => setDrives(r.data.data.rows))
      .catch(() => {});
    api
      .get('/categories', { params: { limit: 100 } })
      .then((r) => setCategories(r.data.data.rows))
      .catch(() => {});
    api
      .get('/tests', { params: { limit: 100 } })
      .then((r) => setTests(r.data.data.rows))
      .catch(() => {});
  }, []);

  const selectKind = (nextKind) => {
    // Clear the preview in the SAME state update as the kind change — if this
    // were a separate effect, React would paint one intermediate frame where
    // `kind` is already the new value but `preview` still holds the old
    // kind's shape, and renderPreview() would crash reading fields that
    // don't exist on it (e.g. individual's `.strengths` on a
    // company_performance preview).
    setKind(nextKind);
    setPreview(null);
  };

  const setParam = (name) => (event) =>
    setParams((current) => ({ ...current, [name]: event.target.value }));

  const buildQuery = () => {
    if (kind === 'individual') return { userId: params.userId };
    if (kind === 'team') return { teamId: params.teamId };
    if (kind === 'department') return { departmentId: params.departmentId };
    if (kind === 'recruitment_drive') return { driveId: params.driveId };
    if (kind === 'company_performance')
      return { period: params.period, month: params.month, year: params.year };
    if (kind === 'leaderboard')
      return { scope: params.scope, scopeId: params.scopeId, period: params.ldbPeriod };
    return {};
  };

  const canGenerate = () => {
    if (kind === 'individual') return Boolean(params.userId);
    if (kind === 'team') return Boolean(params.teamId);
    if (kind === 'department') return Boolean(params.departmentId);
    if (kind === 'recruitment_drive') return Boolean(params.driveId);
    if (kind === 'leaderboard') return params.scope === 'company' || Boolean(params.scopeId);
    return true;
  };

  const generate = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const response = await api.get(`/reports/${kind}`, { params: buildQuery() });
      setPreview(response.data.data);
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    setExporting(format);
    try {
      await downloadFile(`/reports/${kind}/export`, `zorfly-${kind}-report.${format}`, {
        ...buildQuery(),
        format
      });
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setExporting('');
    }
  };

  const loadQuestions = useCallback(() => {
    setQLoading(true);
    api
      .get('/reports/analytics/questions', {
        params: {
          testId: qFilters.testId || undefined,
          categoryId: qFilters.categoryId || undefined,
          flaggedOnly: qFilters.flaggedOnly || undefined,
          page: qPage,
          limit: 20
        }
      })
      .then((response) => {
        setQRows(response.data.data.rows);
        setQTotalCount(response.data.data.totalCount);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setQLoading(false));
  }, [qFilters, qPage, toast]);

  useEffect(() => {
    if (tab === 'questions') loadQuestions();
  }, [tab, loadQuestions]);

  const renderParamsForm = () => {
    if (kind === 'individual') {
      return (
        <SelectField
          label="Employee"
          name="repUserId"
          value={params.userId}
          onChange={setParam('userId')}
          options={employees.map((e) => ({ value: e.userId, label: e.fullName }))}
          required
        />
      );
    }
    if (kind === 'team') {
      return (
        <SelectField
          label="Team"
          name="repTeamId"
          value={params.teamId}
          onChange={setParam('teamId')}
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
          required
        />
      );
    }
    if (kind === 'department') {
      return (
        <SelectField
          label="Department"
          name="repDeptId"
          value={params.departmentId}
          onChange={setParam('departmentId')}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          required
        />
      );
    }
    if (kind === 'recruitment_drive') {
      return (
        <SelectField
          label="Recruitment Drive"
          name="repDriveId"
          value={params.driveId}
          onChange={setParam('driveId')}
          options={drives.map((d) => ({ value: d.id, label: d.title }))}
          required
        />
      );
    }
    if (kind === 'company_performance') {
      return (
        <>
          <div className="view-toggle" style={{ marginBottom: '0.8rem' }}>
            <button
              type="button"
              className={`view-toggle-btn${params.period === 'monthly' ? ' active' : ''}`}
              onClick={() => setParams({ ...params, period: 'monthly' })}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`view-toggle-btn${params.period === 'annual' ? ' active' : ''}`}
              onClick={() => setParams({ ...params, period: 'annual' })}
            >
              Annual
            </button>
            <button
              type="button"
              className={`view-toggle-btn${params.period === 'all' ? ' active' : ''}`}
              onClick={() => setParams({ ...params, period: 'all' })}
            >
              All Time
            </button>
          </div>
          {params.period === 'monthly' && (
            <div className="editor-two-col">
              <SelectField
                label="Month"
                name="repMonth"
                value={params.month}
                onChange={setParam('month')}
                options={MONTH_OPTIONS}
              />
              <SelectField
                label="Year"
                name="repYear"
                value={params.year}
                onChange={setParam('year')}
                options={YEAR_OPTIONS}
              />
            </div>
          )}
          {params.period === 'annual' && (
            <SelectField
              label="Year"
              name="repYear2"
              value={params.year}
              onChange={setParam('year')}
              options={YEAR_OPTIONS}
            />
          )}
        </>
      );
    }
    if (kind === 'leaderboard') {
      return (
        <>
          <div className="editor-two-col">
            <SelectField
              label="Scope"
              name="repScope"
              value={params.scope}
              onChange={(event) => setParams({ ...params, scope: event.target.value, scopeId: '' })}
              options={[
                { value: 'company', label: 'Whole Company' },
                { value: 'department', label: 'Department' },
                { value: 'team', label: 'Team' }
              ]}
            />
            {params.scope === 'department' && (
              <SelectField
                label="Department"
                name="repScopeDept"
                value={params.scopeId}
                onChange={setParam('scopeId')}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                required
              />
            )}
            {params.scope === 'team' && (
              <SelectField
                label="Team"
                name="repScopeTeam"
                value={params.scopeId}
                onChange={setParam('scopeId')}
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
                required
              />
            )}
          </div>
          <div className="view-toggle">
            {[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'all', label: 'All-Time' }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={`view-toggle-btn${params.ldbPeriod === option.value ? ' active' : ''}`}
                onClick={() => setParams({ ...params, ldbPeriod: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      );
    }
    return null;
  };

  const renderPreview = () => {
    if (!preview) return null;

    if (kind === 'individual') {
      const trendData = preview.trend.map((t) => ({
        avgPercentage: t.percentage,
        label: t.date
          ? new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : ''
      }));
      return (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{preview.testsAttempted}</span>
                <span className="kpi-label">Tests Attempted</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.avgPercentage)}</span>
                <span className="kpi-label">Avg Quality</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.avgAccuracy)}</span>
                <span className="kpi-label">Avg Accuracy</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.passRate)}</span>
                <span className="kpi-label">Pass Rate</span>
              </span>
            </div>
          </div>
          <div className="dash-two-col">
            <div className="card">
              <h3 className="card-title">Strengths</h3>
              <ol className="rank-list">
                {preview.strengths.map((s) => (
                  <li key={s.categoryId} className="rank-item">
                    <span className="rank-main">
                      <span className="rank-name">{s.category}</span>
                    </span>
                    <span className="rank-score good">{pct(s.percentage)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="card">
              <h3 className="card-title">Weaknesses</h3>
              <ol className="rank-list">
                {preview.weaknesses.map((s) => (
                  <li key={s.categoryId} className="rank-item">
                    <span className="rank-main">
                      <span className="rank-name">{s.category}</span>
                    </span>
                    <span className="rank-score bad">{pct(s.percentage)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title">Improvement Trend</h3>
            <TrendChart
              data={trendData}
              ariaLabel="Improvement trend"
              emptyLabel="Not enough attempts yet to chart a trend."
            />
          </div>
        </>
      );
    }

    if (kind === 'team' || kind === 'department') {
      const name = kind === 'team' ? preview.teamName : preview.departmentName;
      const size = kind === 'team' ? preview.teamSize : preview.totalEmployees;
      return (
        <>
          <h3 className="card-title">{name}</h3>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{size}</span>
                <span className="kpi-label">{kind === 'team' ? 'Team Size' : 'Employees'}</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{preview.totalAttempts}</span>
                <span className="kpi-label">Total Attempts</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.participationRate)}</span>
                <span className="kpi-label">Participation</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.avgPercentage)}</span>
                <span className="kpi-label">Avg Quality</span>
              </span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Attempts</th>
                  <th>Avg %</th>
                  <th>Avg Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {preview.members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  preview.members.map((m) => (
                    <tr key={m.employeeId}>
                      <td className="cell-wrap">{m.fullName}</td>
                      <td>{m.attempts}</td>
                      <td>{pct(m.avgPercentage)}</td>
                      <td>{pct(m.avgAccuracy)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (kind === 'recruitment_drive') {
      return (
        <>
          <h3 className="card-title">{preview.driveTitle}</h3>
          <p className="answer-hint">{preview.testTitle}</p>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{preview.totalCandidates}</span>
                <span className="kpi-label">Candidates</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{preview.completed}</span>
                <span className="kpi-label">Completed</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.successRate)}</span>
                <span className="kpi-label">Success Rate</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{preview.status}</span>
                <span className="kpi-label">Status</span>
              </span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-serial">Rank</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>%</th>
                  <th>Accuracy</th>
                  <th>Time (s)</th>
                </tr>
              </thead>
              <tbody>
                {preview.candidates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  preview.candidates.map((c) => (
                    <tr key={c.rank}>
                      <td className="col-serial">{c.rank}</td>
                      <td className="cell-wrap">{c.fullName}</td>
                      <td className="cell-wrap">{c.email}</td>
                      <td>{c.status}</td>
                      <td>{pct(c.percentage)}</td>
                      <td>{pct(c.accuracy)}</td>
                      <td>{c.timeTakenSec}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (kind === 'company_performance') {
      return (
        <>
          <h3 className="card-title">{preview.period}</h3>
          <div className="kpi-grid">
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.avgPercentage)}</span>
                <span className="kpi-label">Overall Quality</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.participationRate)}</span>
                <span className="kpi-label">Participation</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{pct(preview.avgAccuracy)}</span>
                <span className="kpi-label">Avg Accuracy</span>
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-body">
                <span className="kpi-value">{preview.totalAttempts}</span>
                <span className="kpi-label">Total Attempts</span>
              </span>
            </div>
          </div>
          <TrendChart data={preview.trend} />
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
                {preview.departmentAverages.map((d) => (
                  <tr key={d.department}>
                    <td className="cell-wrap">
                      <strong>{d.department}</strong>
                    </td>
                    <td>{d.avgPercentage !== null ? pct(d.avgPercentage) : 'No attempts'}</td>
                    <td>{d.participation}%</td>
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
          <div className="dash-two-col">
            <div className="card">
              <h3 className="card-title">Top Performers</h3>
              <ol className="rank-list">
                {preview.topPerformers.map((p, i) => (
                  <li key={p.employeeId} className="rank-item">
                    <span className={`rank-no${i < 3 ? ` rank-no-${i + 1}` : ''}`}>{i + 1}</span>
                    <span className="rank-main">
                      <span className="rank-name">{p.fullName}</span>
                      {p.department && <span className="rank-sub">{p.department}</span>}
                    </span>
                    <span className="rank-score good">{pct(p.avgPercentage)}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="card">
              <h3 className="card-title">Needs Attention</h3>
              <ol className="rank-list">
                {preview.needsAttention.map((p) => {
                  const critical = p.avgPercentage !== null && p.avgPercentage < 60;
                  return (
                    <li key={p.employeeId} className="rank-item">
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
                        {pct(p.avgPercentage)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </>
      );
    }

    if (kind === 'leaderboard') {
      return (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">Rank</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Team</th>
                <th>Tests</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                preview.rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="col-serial">{row.rank}</td>
                    <td className="cell-wrap">{row.fullName}</td>
                    <td className="cell-wrap">{row.department || '—'}</td>
                    <td className="cell-wrap">{row.team || '—'}</td>
                    <td>{row.attempts}</td>
                    <td>{pct(row.scorePercentage)}</td>
                    <td>{pct(row.accuracy)}</td>
                    <td>{row.points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    }
    return null;
  };

  const qTotalPages = Math.max(1, Math.ceil(qTotalCount / 20));

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Reports &amp; Analytics</h2>
        <p className="page-subtitle">
          Standard reports, exportable to PDF/Excel/CSV, plus question-level analytics.
        </p>
      </div>

      <div className="view-toggle" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`view-toggle-btn${tab === 'reports' ? ' active' : ''}`}
          onClick={() => setTab('reports')}
          style={{ width: 'auto', padding: '0 1rem' }}
        >
          Reports
        </button>
        <button
          type="button"
          className={`view-toggle-btn${tab === 'questions' ? ' active' : ''}`}
          onClick={() => setTab('questions')}
          style={{ width: 'auto', padding: '0 1rem' }}
        >
          Question Analytics
        </button>
      </div>

      {tab === 'reports' ? (
        <>
          <div className="report-kind-grid">
            {REPORT_KIND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`report-kind-card${kind === option.value ? ' active' : ''}`}
                onClick={() => selectKind(option.value)}
              >
                <span className="report-kind-card-label">{option.label}</span>
                <span className="report-kind-card-description">{option.description}</span>
              </button>
            ))}
          </div>

          <div className="card">
            {renderParamsForm()}
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canGenerate() || loading}
                onClick={generate}
              >
                {loading ? 'Generating…' : 'Generate Preview'}
              </button>
            </div>
          </div>

          {preview && (
            <div className="card">
              <div className="card-head-row">
                <h3 className="card-title">Report Preview</h3>
                <span className="action-group report-export-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={Boolean(exporting)}
                    onClick={() => exportReport('pdf')}
                  >
                    {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={Boolean(exporting)}
                    onClick={() => exportReport('xlsx')}
                  >
                    {exporting === 'xlsx' ? 'Exporting…' : 'Export Excel'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={Boolean(exporting)}
                    onClick={() => exportReport('csv')}
                  >
                    {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
                  </button>
                </span>
              </div>
              {renderPreview()}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="filter-row">
            <SelectField
              label="Test"
              name="qTest"
              value={qFilters.testId}
              onChange={(e) => {
                setQFilters({ ...qFilters, testId: e.target.value });
                setQPage(1);
              }}
              options={tests.map((t) => ({ value: t.id, label: t.title }))}
            />
            <SelectField
              label="Category"
              name="qCategory"
              value={qFilters.categoryId}
              onChange={(e) => {
                setQFilters({ ...qFilters, categoryId: e.target.value });
                setQPage(1);
              }}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <label
              className="checkbox-label"
              style={{ alignSelf: 'flex-end', marginBottom: '0.6rem' }}
            >
              <input
                type="checkbox"
                checked={qFilters.flaggedOnly}
                onChange={(e) => {
                  setQFilters({ ...qFilters, flaggedOnly: e.target.checked });
                  setQPage(1);
                }}
              />
              <span>Flagged only</span>
            </label>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Category</th>
                    <th>Attempts</th>
                    <th>Correctness %</th>
                    <th>Discrimination</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {qLoading ? (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        Loading…
                      </td>
                    </tr>
                  ) : qRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    qRows.map((row) => (
                      <tr key={row.questionId}>
                        <td className="cell-wrap">{row.title}</td>
                        <td className="cell-wrap">{row.categoryName}</td>
                        <td>{row.attempts}</td>
                        <td>{row.insufficientData ? 'Insufficient data' : pct(row.correctPct)}</td>
                        <td>{row.insufficientData ? '—' : row.discriminationIndex}</td>
                        <td>
                          {row.flagged ? (
                            <span
                              className="priority-chip priority-high"
                              title={row.flagReasons.join(' ')}
                            >
                              Review
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span className="table-count">{qTotalCount} question(s)</span>
              <div className="pager">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={qPage <= 1}
                  onClick={() => setQPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="pager-info">
                  Page {qPage} of {qTotalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={qPage >= qTotalPages}
                  onClick={() => setQPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
