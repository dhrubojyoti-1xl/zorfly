import { useState } from 'react';
import Button from '../components/Button.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';

// One page component powers Branches and Teams (name-only CRUD, same
// pattern as Departments). Config decides endpoint + labels.
export default function SimpleOrgPage({ endpoint, singular, plural, subtitle }) {
  const { role } = useAuth();
  const toast = useToast();
  const list = useList(endpoint);
  const isAdmin = role === 'company_admin';

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const validateName = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return `${singular} Name is required.`;
    if (trimmed.length < 2) return `${singular} Name must be at least 2 characters.`;
    if (trimmed.length > 100) return `${singular} Name must not exceed 100 characters.`;
    return '';
  };

  const openAdd = () => {
    setName('');
    setAddError('');
    setAddOpen(true);
  };

  const handleCreate = async () => {
    const error = validateName(name);
    setAddError(error);
    if (error) return;
    setSaving(true);
    try {
      const response = await api.post(endpoint, { name: name.trim() });
      setAddOpen(false);
      toast.show(response.data.data.message, 'success');
      list.setPage(1);
      await list.load();
    } catch (requestError) {
      const parsed = apiError(requestError);
      setAddError(parsed.errors?.name || parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`${endpoint}/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.show(response.data.data.message, 'success');
      await list.load();
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
          <h2 className="page-title">{plural}</h2>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={openAdd}>
            Add {singular}
          </Button>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'name', label: `${singular} Name`, sortKey: 'name' },
          ...(isAdmin ? [{ key: 'action', label: 'Action', className: 'col-action' }] : [])
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
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
        )}
      />

      <Modal
        open={addOpen}
        title={`Add ${singular}`}
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
          label={`${singular} Name`}
          name="orgName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={addError}
          required
          maxLength={100}
        />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title={`Delete ${singular}`}
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
        <p>
          Are you sure you want to delete {singular} {deleteTarget?.name}?
        </p>
      </Modal>
    </div>
  );
}
