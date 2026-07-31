import { useCallback, useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { mediaUrl } from '../utils/media.js';

// Manual review queue (SCR-03): typed answers wait here for a reviewer.
// Saving the last pending question publishes the final score to the employee.
export default function Reviews() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // { id, rows }
  const [marks, setMarks] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(() => {
    api
      .get('/reviews')
      .then((response) => setRows(response.data.data.rows))
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (row) => {
    try {
      const response = await api.get(`/reviews/${row.id}`);
      setDetail(response.data.data);
      setMarks(
        Object.fromEntries(
          response.data.data.rows.map((entry) => [
            entry.questionId,
            String(entry.suggestedObtained ?? 0)
          ])
        )
      );
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  const saveMarks = async (entry) => {
    setSavingId(entry.questionId);
    try {
      const response = await api.post(`/reviews/${detail.id}/${entry.questionId}`, {
        obtained: Number(marks[entry.questionId]) || 0
      });
      toast.show(response.data.data.message, 'success');
      if (response.data.data.pendingReview) {
        await openDetail({ id: detail.id });
      } else {
        setDetail(null);
      }
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Review Queue</h2>
        <p className="page-subtitle">
          Typed answers waiting for marks. Scores are provisional until every question is reviewed.
        </p>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">SR. No.</th>
                <th>Employee</th>
                <th>Test</th>
                <th>Submitted</th>
                <th>Pending Questions</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="col-serial">{index + 1}</td>
                    <td className="cell-wrap">{row.employeeName}</td>
                    <td className="cell-wrap">{row.testTitle}</td>
                    <td>{new Date(row.submittedAt).toLocaleDateString('en-GB')}</td>
                    <td>{row.pendingCount}</td>
                    <td className="col-action">
                      <Button variant="primary" onClick={() => openDetail(row)}>
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

      <Modal
        open={Boolean(detail)}
        title="Review Typed Answers"
        onClose={() => setDetail(null)}
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Close
          </Button>
        }
      >
        {(detail?.rows || []).map((entry) => (
          <div key={entry.questionId} className="review-entry">
            <h3 className="player-question-title">{entry.title}</h3>
            {entry.imageUrl && (
              <img src={mediaUrl(entry.imageUrl)} alt="Creative" className="question-image" />
            )}
            <div className="editor-two-col">
              <div>
                <span className="field-label">Candidate typed:</span>
                <ul className="review-list">
                  {entry.typedAnswers.filter(Boolean).map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="field-label">Actual mistakes:</span>
                <ul className="review-list">
                  {entry.mistakes.map((label, index) => (
                    <li key={index}>{label}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="editor-row">
              <label className="field-label" htmlFor={`marks-${entry.questionId}`}>
                Marks (out of {entry.max}, suggested {entry.suggestedObtained})
              </label>
              <input
                id={`marks-${entry.questionId}`}
                type="number"
                className="field-input review-marks-input"
                min={0}
                max={entry.max}
                value={marks[entry.questionId] ?? ''}
                onChange={(event) =>
                  setMarks((current) => ({ ...current, [entry.questionId]: event.target.value }))
                }
              />
              <Button
                variant="primary"
                onClick={() => saveMarks(entry)}
                disabled={savingId === entry.questionId}
              >
                {savingId === entry.questionId ? 'Saving…' : 'Save Marks'}
              </Button>
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}
