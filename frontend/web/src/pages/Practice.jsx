import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { DIFFICULTY_OPTIONS } from '../utils/constants.js';

// Practice mode (TRN-02): unlimited, untimed, never affects official scores.
export default function Practice() {
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ categoryId: '', difficulty: '', count: '5' });
  const [starting, setStarting] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Only categories that actually have Study Library practice content, so a
    // user never picks a category that would start an empty session.
    api
      .get('/study/practice-categories')
      .then((r) => setCategories(r.data.data.rows))
      .catch(() => {});
    api
      .get('/attempts', { params: { mode: 'practice', limit: 10 } })
      .then((r) => setHistory(r.data.data.rows))
      .catch(() => {});
  }, []);

  const start = async () => {
    setStarting(true);
    try {
      const response = await api.post('/attempts/practice/start', {
        categoryId: form.categoryId || null,
        difficulty: form.difficulty || null,
        count: Number(form.count) || 5
      });
      navigate(`/app/attempt/${response.data.data.id}`, { state: response.data.data });
    } catch (error) {
      toast.show(apiError(error).message, 'error');
      setStarting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Practice</h2>
        <p className="page-subtitle">
          Unlimited, untimed practice drawn from the{' '}
          <Link to="/app/study" className="text-link">
            Study Library
          </Link>{' '}
          — not the test question bank — so you never see the exact questions used in official
          tests. Practice scores never affect your official results or rank.
        </p>
      </div>

      <div className="card">
        <h3 className="card-title">Start a Practice Session</h3>
        <div className="editor-two-col">
          <SelectField
            label="Category"
            name="pCategory"
            value={form.categoryId}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            options={categories.map((category) => ({
              value: category.id,
              label: `${category.name} (${category.questionCount})`
            }))}
            placeholder={
              categories.length ? 'Any category with content' : 'No practice content yet'
            }
          />
          <SelectField
            label="Difficulty"
            name="pDifficulty"
            value={form.difficulty}
            onChange={(event) => setForm({ ...form, difficulty: event.target.value })}
            options={DIFFICULTY_OPTIONS}
            placeholder="Any difficulty"
          />
          <TextField
            label="Number of Questions"
            name="pCount"
            type="number"
            value={form.count}
            onChange={(event) => setForm({ ...form, count: event.target.value })}
            placeholder="5"
          />
        </div>
        <Button variant="primary" onClick={start} disabled={starting}>
          {starting ? 'Starting…' : 'Start Practice'}
        </Button>
      </div>

      <div className="card">
        <h3 className="card-title">Recent Practice Sessions</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">SR. No.</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Date</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                history.map((attempt, index) => (
                  <tr key={attempt.id}>
                    <td className="col-serial">{index + 1}</td>
                    <td>
                      {attempt.obtained}/{attempt.max}
                    </td>
                    <td>{attempt.percentage}%</td>
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
    </div>
  );
}
