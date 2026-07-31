import { useEffect, useMemo, useState } from 'react';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDateTime } from '../utils/datetime.js';

const RestoreIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

// Recycle Bin — archived items from every module, with restore + permanent
// delete. Managers only (route-guarded on the server too).
export default function RecycleBin() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [target, setTarget] = useState(null); // { row, action: 'restore'|'delete' }
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/archive')
      .then((r) => {
        setRows(r.data.data.rows);
        setCounts(r.data.data.counts);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRows = useMemo(
    () => (typeFilter ? rows.filter((r) => r.type === typeFilter) : rows),
    [rows, typeFilter]
  );

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const { row, action } = target;
      const response =
        action === 'delete'
          ? await api.delete(`/archive/${row.type}/${row.id}`)
          : await api.post(`/archive/${row.type}/${row.id}/restore`);
      setTarget(null);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Recycle Bin</h2>
        <p className="page-subtitle">
          Everything you've archived across the platform. Restore an item to bring it back, or
          delete it permanently. Permanent deletion cannot be undone.
        </p>
      </div>

      <div className="filter-row">
        <select
          className="field-input filter-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types ({rows.length})</option>
          {Object.entries(counts).map(([type, info]) => (
            <option key={type} value={type} disabled={info.count === 0}>
              {info.label} ({info.count})
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">SR. No.</th>
                <th>Type</th>
                <th>Name</th>
                <th>Archived</th>
                <th className="col-action">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    Loading…
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No archived items found.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, index) => (
                  <tr key={`${row.type}-${row.id}`}>
                    <td className="col-serial">{index + 1}</td>
                    <td>
                      <span className="state-badge">{row.typeLabel}</span>
                    </td>
                    <td className="cell-wrap">{row.name}</td>
                    <td>{formatDateTime(row.archivedAt)}</td>
                    <td className="col-action">
                      <span className="action-group">
                        <button
                          type="button"
                          className="icon-btn icon-btn-primary"
                          data-tooltip="Restore"
                          aria-label="Restore item"
                          onClick={() => setTarget({ row, action: 'restore' })}
                        >
                          <RestoreIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          data-tooltip="Delete permanently"
                          aria-label="Delete permanently"
                          onClick={() => setTarget({ row, action: 'delete' })}
                        >
                          <TrashIcon />
                        </button>
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
        open={Boolean(target)}
        title={target?.action === 'delete' ? 'Delete Permanently' : 'Restore Item'}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={target?.action === 'delete' ? 'danger' : 'primary'}
              onClick={run}
              disabled={busy}
            >
              {busy ? 'Working…' : target?.action === 'delete' ? 'Delete Permanently' : 'Restore'}
            </Button>
          </>
        }
      >
        {target?.action === 'delete' ? (
          <p>
            Permanently delete this {target?.row?.typeLabel?.toLowerCase()} — "{target?.row?.name}"?
            This <strong>cannot be undone</strong>.
          </p>
        ) : (
          <p>
            Restore this {target?.row?.typeLabel?.toLowerCase()} — "{target?.row?.name}"? It will
            return to its active state.
          </p>
        )}
      </Modal>
    </div>
  );
}
