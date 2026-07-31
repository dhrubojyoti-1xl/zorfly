import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_TARGET_TYPE_LABELS } from '../utils/constants.js';

// Assignment History (TST-06): a test is reusable and can be assigned any
// number of times to different targets with different schedules — every
// assignment is its own independent, permanent record. This page lists all
// of them for one test, most recent first; nothing here is ever overwritten
// by a later assignment. This is also the audit trail for revocations —
// every Revoke here is logged with the acting admin and an optional reason.
export default function TestAssignments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/tests/${id}/assignments`)
      .then((response) => setRows(response.data.data.rows))
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDateTime = (value) =>
    value
      ? new Date(value).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '—';

  const openRevoke = (row) => {
    setRevokeTarget(row);
    setRevokeReason('');
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const response = await api.patch(`/tests/${id}/assignments/${revokeTarget.id}/revoke`, {
        reason: revokeReason.trim() || null
      });
      setRevokeTarget(null);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Assignment History</h2>
          <p className="page-subtitle">
            {loading
              ? 'Every assignment ever made for this test.'
              : `${rows.length} assignment${rows.length === 1 ? '' : 's'} — the same test can be assigned any number of times to different targets.`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/app/tests')}>
          Back to Tests
        </Button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">SR. No.</th>
                <th>Assigned On</th>
                <th>Assigned To</th>
                <th>Target Name</th>
                <th>Due Date</th>
                <th>Employees Assigned</th>
                <th>Completed</th>
                <th>Pending</th>
                <th>Completion %</th>
                <th>Status</th>
                <th>Created By</th>
                <th className="col-actions-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="table-empty">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="table-empty">
                    This test has not been assigned to anyone yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="col-serial">{index + 1}</td>
                    <td className="cell-wrap">{formatDateTime(row.assignedAt)}</td>
                    <td>{ASSIGNMENT_TARGET_TYPE_LABELS[row.targetType] || row.targetType}</td>
                    <td className="cell-wrap">
                      {row.targetLabel}
                      {row.recurring && <div className="question-pick-meta">Recurring</div>}
                    </td>
                    <td className="cell-wrap">{formatDateTime(row.dueAt)}</td>
                    <td>{row.employeesAssigned}</td>
                    <td>{row.completed}</td>
                    <td>{row.pending}</td>
                    <td>{row.completionPct}%</td>
                    <td>
                      <span className={`state-badge state-assign-${row.status}`}>
                        {ASSIGNMENT_STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                    <td className="cell-wrap">{row.createdBy}</td>
                    <td className="col-actions-wide">
                      <span className="action-group">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/app/tests/${id}/assignments/${row.id}/results`)}
                        >
                          View Results
                        </button>
                        {row.status === 'active' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openRevoke(row)}
                          >
                            Revoke
                          </button>
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

      <Modal
        open={Boolean(revokeTarget)}
        title="Revoke Assignment"
        onClose={() => setRevokeTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={handleRevoke} disabled={revoking}>
              {revoking ? 'Revoking…' : 'Revoke Assignment'}
            </Button>
          </>
        }
      >
        <p>
          Withdraw the assignment to <strong>{revokeTarget?.targetLabel}</strong>? Only employees
          who haven&apos;t started the test yet lose access — anyone already in progress or finished
          keeps their attempt untouched. This record stays in the history, marked Revoked.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="revokeReason">
            Reason (optional)
          </label>
          <textarea
            id="revokeReason"
            className="field-input field-textarea"
            placeholder="e.g. assigned by mistake, wrong due date, employee transferred…"
            maxLength={500}
            value={revokeReason}
            onChange={(event) => setRevokeReason(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
