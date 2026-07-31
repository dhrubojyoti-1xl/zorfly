import { useCallback, useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import TextField from '../components/TextField.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { validateDepartmentName } from '../utils/validators.js';

// Reference tenant-scoped list page, QA-standards compliant:
// SR. No. column · table search with clear icon · pagination 10/20/50/100
// (rows + totalCount from ONE call) · consistent "No records found." ·
// descriptive delete confirmation in a system modal · red destructive action ·
// success toasts only after the server confirms.
const PAGE_SIZES = [10, 20, 50, 100];

export default function Departments() {
  const { role } = useAuth();
  const toast = useToast();
  const isAdmin = role === 'company_admin';

  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/departments', { params: { page, limit, search } });
      setRows(response.data.data.rows);
      setTotalCount(response.data.data.totalCount);
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const openAdd = () => {
    // Reopening the popup must not show previous errors (team QA standard).
    setNewName('');
    setAddError('');
    setAddOpen(true);
  };

  const handleCreate = async () => {
    const error = validateDepartmentName(newName);
    setAddError(error);
    if (error) return;
    setSaving(true);
    try {
      const response = await api.post('/departments', { name: newName.trim() });
      setAddOpen(false);
      toast.show(response.data.data.message, 'success');
      setPage(1);
      await load();
    } catch (requestError) {
      const parsed = apiError(requestError);
      setAddError(parsed.errors.name || parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/departments/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.show(response.data.data.message, 'success');
      await load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Departments</h2>
          <p className="page-subtitle">Organise your company into departments.</p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={openAdd}>
            Add Department
          </Button>
        )}
      </div>

      <div className="card">
        <div className="table-toolbar">
          <div className="search-wrap">
            <input
              type="text"
              className="field-input search-input"
              placeholder="Search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              maxLength={100}
            />
            {search && (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
              >
                ✕
              </button>
            )}
          </div>
          <label className="page-size-label">
            Rows per page:{' '}
            <select
              className="page-size-select"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-serial">SR. No.</th>
                <th>Department Name</th>
                {isAdmin && <th className="col-action">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 3 : 2} className="table-empty">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 3 : 2} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="col-serial">{(page - 1) * limit + index + 1}</td>
                    <td className="cell-wrap">{row.name}</td>
                    {isAdmin && (
                      <td className="col-action">
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          data-tooltip="Delete"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => setDeleteTarget(row)}
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span className="table-count">
            {totalCount === 0
              ? '0 records'
              : `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} records`}
          </span>
          <div className="pager">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </button>
            <span className="pager-info">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={addOpen}
        title="Add Department"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <TextField
          label="Department Name"
          name="departmentName"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          error={addError}
          required
          maxLength={100}
        />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Department"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete Department {deleteTarget?.name}?</p>
      </Modal>
    </div>
  );
}
