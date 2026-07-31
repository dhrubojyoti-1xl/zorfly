import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  missed: 'Missed'
};

export default function MyTests() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);
  const [tab, setTab] = useState('assigned');

  useEffect(() => {
    Promise.all([
      api.get('/attempts/my-tests'),
      api.get('/attempts', { params: { mode: 'official', limit: 10 } })
    ])
      .then(([myTestsRes, historyRes]) => {
        setRows(myTestsRes.data.data.rows);
        setHistory(historyRes.data.data.rows);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const startTest = async (row) => {
    setStartingId(row.testId);
    try {
      const response = await api.post('/attempts/start', { testId: row.testId });
      navigate(`/app/attempt/${response.data.data.id}`, { state: response.data.data });
    } catch (error) {
      toast.show(apiError(error).message, 'error');
      setStartingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">My Tests</h2>
        <p className="page-subtitle">Assessments assigned to you, and your recent results.</p>
      </div>

      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'assigned'}
          className={`tab${tab === 'assigned' ? ' active' : ''}`}
          onClick={() => setTab('assigned')}
        >
          Assigned Tests
          {rows.length > 0 && <span className="tab-count">{rows.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'results'}
          className={`tab${tab === 'results' ? ' active' : ''}`}
          onClick={() => setTab('results')}
        >
          Recent Results
          {history.length > 0 && <span className="tab-count">{history.length}</span>}
        </button>
      </div>

      {tab === 'assigned' && (
        <div className="card">
          <h3 className="card-title">Assigned Tests</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-serial">SR. No.</th>
                  <th>Test Title</th>
                  <th>Time Limit</th>
                  <th>Attempts</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Best Score</th>
                  <th className="col-actions-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.testId}>
                      <td className="col-serial">{index + 1}</td>
                      <td className="cell-wrap">{row.title}</td>
                      <td>{row.timeLimitMin ? `${row.timeLimitMin} min` : 'No limit'}</td>
                      <td>
                        {row.attemptsUsed}/{row.attemptsAllowed}
                      </td>
                      <td>{row.dueAt ? new Date(row.dueAt).toLocaleDateString('en-GB') : '—'}</td>
                      <td>
                        <span
                          className={`state-badge state-${row.status === 'completed' ? 'published' : row.status === 'missed' ? 'closed' : 'draft'}`}
                        >
                          {STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td>{row.bestPercentage !== null ? `${row.bestPercentage}%` : '—'}</td>
                      <td className="col-actions-wide">
                        <span className="action-group">
                          {(row.status === 'pending' ||
                            row.status === 'in_progress' ||
                            (row.status === 'completed' &&
                              row.attemptsUsed < row.attemptsAllowed)) && (
                            <Button
                              variant="primary"
                              onClick={() => startTest(row)}
                              disabled={startingId === row.testId}
                            >
                              {startingId === row.testId
                                ? 'Starting…'
                                : row.status === 'in_progress'
                                  ? 'Resume'
                                  : row.status === 'completed'
                                    ? 'Retake'
                                    : 'Start'}
                            </Button>
                          )}
                          {row.lastAttemptId && (
                            <Button
                              variant="secondary"
                              onClick={() => navigate(`/app/results/${row.lastAttemptId}`)}
                            >
                              Review
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'results' && (
        <div className="card">
          <h3 className="card-title">Recent Results</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-serial">SR. No.</th>
                  <th>Test Title</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>Submitted</th>
                  <th className="col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  history.map((attempt, index) => (
                    <tr key={attempt.id}>
                      <td className="col-serial">{index + 1}</td>
                      <td className="cell-wrap">{attempt.testTitle}</td>
                      <td>
                        {attempt.obtained}/{attempt.max} ({attempt.percentage}%)
                      </td>
                      <td>
                        {attempt.pendingReview ? (
                          <span className="state-badge">Pending review</span>
                        ) : (
                          <span
                            className={`state-badge ${attempt.passed ? 'state-published' : 'state-closed'}`}
                          >
                            {attempt.passed ? 'Passed' : 'Failed'}
                          </span>
                        )}
                      </td>
                      <td>{new Date(attempt.submittedAt).toLocaleDateString('en-GB')}</td>
                      <td className="col-action">
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/app/results/${attempt.id}`)}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
