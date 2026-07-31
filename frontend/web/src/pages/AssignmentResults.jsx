import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { ASSIGNMENT_TARGET_TYPE_LABELS } from '../utils/constants.js';

// Results for ONE assignment — unlike the test-wide Results view, this is
// always scoped to a single assignment's own audience, so it's unambiguous
// which "25 assigned, 20 completed" a number belongs to.
export default function AssignmentResults() {
  const { id, assignmentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/tests/${id}/assignments/${assignmentId}/results`),
      api.get(`/tests/${id}/assignments`).catch(() => null)
    ])
      .then(([resultsResponse, assignmentsResponse]) => {
        setSummary(resultsResponse.data.data.summary);
        setRows(resultsResponse.data.data.rows);
        if (assignmentsResponse) {
          const match = assignmentsResponse.data.data.rows.find((row) => row.id === assignmentId);
          if (match) setAssignment(match);
        }
      })
      .catch((error) => {
        toast.show(apiError(error).message, 'error');
        navigate(`/app/tests/${id}/assignments`);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Assignment Results</h2>
          <p className="page-subtitle">
            {assignment
              ? `${ASSIGNMENT_TARGET_TYPE_LABELS[assignment.targetType] || assignment.targetType}: ${assignment.targetLabel}`
              : 'Results scoped to this one assignment.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/app/tests/${id}/assignments`)}>
          Back to Assignment History
        </Button>
      </div>

      {summary && (
        <div className="kpi-grid">
          <div className="kpi">
            <span className="kpi-body">
              <span className="kpi-value">{summary.assigned}</span>
              <span className="kpi-label">Assigned</span>
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-body">
              <span className="kpi-value">{summary.completed}</span>
              <span className="kpi-label">Completed</span>
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-body">
              <span className="kpi-value">{summary.pending}</span>
              <span className="kpi-label">Pending</span>
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-body">
              <span className="kpi-value">{summary.completionPct}%</span>
              <span className="kpi-label">Completion</span>
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">SR. No.</th>
                <th>Employee</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Result</th>
                <th>Accuracy</th>
                <th>Detection</th>
                <th>Time Taken</th>
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
                    No one has completed this assignment yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="col-serial">{index + 1}</td>
                    <td className="cell-wrap">
                      {row.employeeName}
                      {row.email && <div className="question-pick-meta">{row.email}</div>}
                    </td>
                    <td>
                      {row.obtained}/{row.max}
                    </td>
                    <td>{row.percentage}%</td>
                    <td>
                      <span
                        className={`state-badge ${row.passed ? 'state-published' : 'state-closed'}`}
                      >
                        {row.passed ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                    <td>{row.accuracy}%</td>
                    <td>{row.detectionRate !== null ? `${row.detectionRate}%` : '—'}</td>
                    <td>{formatTime(row.timeTakenSec)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
