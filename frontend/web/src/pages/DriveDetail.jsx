import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const STATUS_LABELS = {
  applied: 'Applied',
  completed: 'Completed',
  shortlisted: 'Shortlisted',
  hold: 'On Hold',
  rejected: 'Rejected'
};

// Drive detail: ranked candidates + shortlist/hold/reject decisions (REC-03/04).
export default function DriveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [drive, setDrive] = useState(null);
  const [decision, setDecision] = useState(null); // { candidate, status }
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/drives/${id}`)
      .then((response) => setDrive(response.data.data))
      .catch((error) => {
        toast.show(apiError(error).message, 'error');
        navigate('/app/drives');
      });
  }, [id, navigate, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = () => {
    const link = `${window.location.origin}/apply/${drive.token}`;
    navigator.clipboard.writeText(link).then(
      () => toast.show('Application link copied successfully.', 'success'),
      () => toast.show('Unable to copy the link. Please copy it manually.', 'error')
    );
  };

  const saveDecision = async () => {
    setSaving(true);
    try {
      const response = await api.patch(`/drives/${id}/candidates/${decision.candidate.id}`, {
        status: decision.status,
        notes
      });
      setDecision(null);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!drive)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">{drive.title}</h2>
          <p className="page-subtitle">
            Assessment: {drive.testTitle} · {drive.totalCount} candidate(s) ·{' '}
            {drive.status === 'active' ? 'Active' : 'Closed'}
          </p>
        </div>
        <span className="action-group">
          <Button variant="secondary" onClick={copyLink}>
            Copy Link
          </Button>
          <Button variant="secondary" onClick={() => navigate('/app/drives')}>
            Back
          </Button>
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">Rank</th>
                <th>Candidate</th>
                <th>Email ID</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Time</th>
                <th>Status</th>
                <th className="col-actions-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drive.candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                drive.candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="col-serial">{candidate.rank ?? '—'}</td>
                    <td className="cell-wrap">
                      {candidate.fullName}
                      {candidate.notes && <p className="question-pick-meta">{candidate.notes}</p>}
                    </td>
                    <td className="cell-wrap">{candidate.email}</td>
                    <td>
                      {candidate.result
                        ? `${candidate.result.obtained}/${candidate.result.max} (${candidate.result.percentage}%)`
                        : 'Not attempted'}
                    </td>
                    <td>{candidate.result ? `${candidate.result.accuracy}%` : '—'}</td>
                    <td>{candidate.result ? formatTime(candidate.result.timeTakenSec) : '—'}</td>
                    <td>
                      <span
                        className={`state-badge ${candidate.status === 'shortlisted' ? 'state-published' : candidate.status === 'rejected' ? 'state-closed' : ''}`}
                      >
                        {STATUS_LABELS[candidate.status]}
                      </span>
                    </td>
                    <td className="col-actions-wide">
                      <span className="action-group">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setDecision({ candidate, status: 'shortlisted' });
                            setNotes(candidate.notes || '');
                          }}
                        >
                          Shortlist
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setDecision({ candidate, status: 'hold' });
                            setNotes(candidate.notes || '');
                          }}
                        >
                          Hold
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => {
                            setDecision({ candidate, status: 'rejected' });
                            setNotes(candidate.notes || '');
                          }}
                        >
                          Reject
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(decision)}
        title={`${STATUS_LABELS[decision?.status] || ''}: ${decision?.candidate.fullName || ''}`}
        onClose={() => setDecision(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant={decision?.status === 'rejected' ? 'danger' : 'primary'}
              onClick={saveDecision}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to mark Candidate {decision?.candidate.fullName} as{' '}
          {STATUS_LABELS[decision?.status]?.toLowerCase()}?
        </p>
        <div className="field">
          <label className="field-label" htmlFor="decisionNotes">
            Notes
          </label>
          <textarea
            id="decisionNotes"
            className="field-input field-textarea"
            placeholder="Enter Notes"
            value={notes}
            maxLength={2000}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
