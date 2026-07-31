import { useEffect, useState } from 'react';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Leaderboard (LDB-01/02): scope + period filters; composite ranking of
// score, accuracy, speed and consistency. Practice never counts.
export default function Leaderboard() {
  const { company } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState('all');
  const [rows, setRows] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get('/leaderboard', { params: { period } })
      .then((response) => {
        setRows(response.data.data.rows);
        setMyRank(response.data.data.myRank);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [period, company?.id, toast]);

  const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank);

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Leaderboard</h2>
          <p className="page-subtitle">
            Ranked by score, accuracy, speed and consistency.
            {myRank && ` Your current rank: ${myRank}.`}
          </p>
        </div>
        <div className="filter-row">
          {[
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'all', label: 'All-Time' }
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn ${period === option.value ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
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
                rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="col-serial">{medal(row.rank)}</td>
                    <td className="cell-wrap">{row.fullName}</td>
                    <td className="cell-wrap">{row.department || '—'}</td>
                    <td className="cell-wrap">{row.team || '—'}</td>
                    <td>{row.attempts}</td>
                    <td>{row.scorePercentage}%</td>
                    <td>{row.accuracy}%</td>
                    <td>{row.points}</td>
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
