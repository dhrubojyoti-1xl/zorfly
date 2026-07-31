import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { downloadCsv } from '../utils/download.js';

// Manager view: everyone's results for one test (SCR-01).
export default function TestResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/tests/${id}/results`)
      .then((response) => setRows(response.data.data.rows))
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Test Results</h2>
          <p className="page-subtitle">
            {loading
              ? 'Official submitted attempts for this test.'
              : `${rows.length} employee${rows.length === 1 ? '' : 's'} attempted this test (official submissions).`}
          </p>
        </div>
        <span className="action-group">
          <Button
            variant="secondary"
            onClick={() => downloadCsv(`/tests/${id}/results/export`, 'zorfly-results.csv')}
            title="Export results to CSV"
          >
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => navigate('/app/tests')}>
            Back to Tests
          </Button>
        </span>
      </div>

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
                    No records found.
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
