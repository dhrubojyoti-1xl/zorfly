import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Assessment calendar (SCH-06): open now, upcoming cycles, past results.
const FREQUENCY_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export default function Calendar() {
  const { company } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get('/calendar')
      .then((response) => setData(response.data.data))
      .catch((error) => toast.show(apiError(error).message, 'error'));
  }, [company?.id, toast]);

  if (!data)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  const formatDate = (value) => new Date(value).toLocaleDateString('en-GB');
  const formatTime = (value) =>
    new Date(value)
      .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
      .toUpperCase();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Assessment Calendar</h2>
        <p className="page-subtitle">
          What is open now, what is coming up and what you have completed.
        </p>
      </div>

      <div className="card">
        <h3 className="card-title">Open Now</h3>
        {data.open.length === 0 ? (
          <p className="answer-hint">No assessments are open at the moment.</p>
        ) : (
          <ul className="calendar-list">
            {data.open.map((item, index) => (
              <li key={index} className="calendar-item">
                <span className="calendar-dot calendar-dot-open" aria-hidden="true" />
                <span className="calendar-text">
                  <strong>{item.title}</strong>
                  {item.dueAt && ` — due ${formatDate(item.dueAt)} ${formatTime(item.dueAt)}`}
                </span>
                <Button variant="primary" onClick={() => navigate('/app/my-tests')}>
                  Open My Tests
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Upcoming Cycles</h3>
        {data.upcoming.length === 0 ? (
          <p className="answer-hint">No recurring assessments are scheduled for you.</p>
        ) : (
          <ul className="calendar-list">
            {data.upcoming.map((item, index) => (
              <li key={index} className="calendar-item">
                <span className="calendar-dot calendar-dot-upcoming" aria-hidden="true" />
                <span className="calendar-text">
                  <strong>{item.title}</strong> — {FREQUENCY_LABELS[item.frequency]} · next on{' '}
                  {formatDate(item.occursAt)} at {formatTime(item.occursAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Past</h3>
        {data.past.length === 0 ? (
          <p className="answer-hint">No completed assessments yet.</p>
        ) : (
          <ul className="calendar-list">
            {data.past.map((item) => (
              <li key={item.attemptId} className="calendar-item">
                <span className="calendar-dot calendar-dot-past" aria-hidden="true" />
                <span className="calendar-text">
                  <strong>{item.title}</strong> — {formatDate(item.submittedAt)} ·{' '}
                  {item.pendingReview ? (
                    <span className="state-badge">Pending review</span>
                  ) : (
                    <span
                      className={`state-badge ${item.passed ? 'state-published' : 'state-closed'}`}
                    >
                      {item.percentage}% · {item.passed ? 'Passed' : 'Failed'}
                    </span>
                  )}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/app/results/${item.attemptId}`)}
                >
                  Review
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
