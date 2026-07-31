import { useEffect, useMemo, useState } from 'react';
import Button from '../components/Button.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import Modal from '../components/Modal.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const slug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// Grouped permission checkboxes shared by the built-in editor and the create modal.
function PermissionGrid({ catalog, enabled, disabled, onToggle }) {
  return (
    <div className="perm-catalog">
      {catalog.map((group) => (
        <div key={group.group} className="perm-group">
          <p className="perm-group-title">{group.group}</p>
          <div className="perm-grid">
            {group.permissions.map((permission) => (
              <label key={permission.key} className={`perm${disabled ? ' perm-disabled' : ''}`}>
                <input
                  type="checkbox"
                  checked={enabled.has(permission.key)}
                  disabled={disabled}
                  onChange={() => onToggle(permission.key)}
                />
                <span className="perm-main">
                  <span className="perm-key">{permission.key}</span>
                  <span className="perm-desc">{permission.label}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BuiltInRow({ role, catalog, onSaved }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState(() => new Set(role.permissions));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPerms(new Set(role.permissions));
    setDirty(false);
  }, [role.permissions]);

  const toggle = (key) => {
    setPerms((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const response = await api.put(`/roles/builtin/${role.key}`, { permissions: [...perms] });
      toast.show(response.data.data.message, 'success');
      setDirty(false);
      onSaved();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    setBusy(true);
    try {
      const response = await api.delete(`/roles/builtin/${role.key}`);
      toast.show(response.data.data.message, 'success');
      onSaved();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`role-row${open ? ' open' : ''}`}>
      <button type="button" className="role-row-head" onClick={() => setOpen((v) => !v)}>
        <span className="role-row-grow">
          <span className="role-row-title">
            {role.name}
            {role.fixed && <span className="chip chip-fixed">Fixed</span>}
            {role.customised && <span className="chip chip-custom">Customised</span>}
            {dirty && <span className="chip chip-unsaved">Unsaved</span>}
          </span>
          <span className="role-row-meta">{perms.size} permissions enabled</span>
        </span>
        <span className="role-caret" aria-hidden="true">
          ▸
        </span>
      </button>
      {open && (
        <div className="role-row-body">
          <p className="role-row-note">
            {role.fixed
              ? 'Company Admin always has every permission — this role cannot be limited.'
              : 'Tick the features members of this role can access.'}
          </p>
          <PermissionGrid
            catalog={catalog}
            enabled={perms}
            disabled={role.fixed}
            onToggle={toggle}
          />
          {!role.fixed && (dirty || role.customised) && (
            <div className="role-row-actions">
              {role.customised && (
                <Button variant="secondary" onClick={revert} disabled={busy}>
                  Revert to defaults
                </Button>
              )}
              <Button variant="primary" onClick={save} disabled={busy || !dirty}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = { name: '', key: '', description: '', rank: 5 };

export default function RolesPermissions() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [keyTouched, setKeyTouched] = useState(false);
  const [perms, setPerms] = useState(() => new Set());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get('/roles')
      .then((r) => setData(r.data.data))
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const catalog = data?.catalog || [];
  const derivedKey = useMemo(
    () => (keyTouched ? slug(form.key) : slug(form.name)),
    [form.key, form.name, keyTouched]
  );

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setKeyTouched(false);
    setPerms(new Set());
    setErrors({});
    setAddOpen(true);
  };

  const togglePerm = (key) => {
    setPerms((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const createRole = async () => {
    if (!form.name.trim()) {
      setErrors({ name: 'Role name is required.' });
      return;
    }
    setSaving(true);
    try {
      const response = await api.post('/roles/custom', {
        name: form.name.trim(),
        key: derivedKey,
        description: form.description.trim(),
        rank: Number(form.rank),
        permissions: [...perms]
      });
      toast.show(response.data.data.message, 'success');
      setAddOpen(false);
      load();
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors || {});
      toast.show(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!deleteTarget) return;
    try {
      const response = await api.delete(`/roles/custom/${deleteTarget.id}`);
      toast.show(response.data.data.message, 'success');
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Roles &amp; Permissions</h2>
        <p className="page-subtitle">
          Define who can do what in your company. Built-in roles cover the basics; custom roles
          tailor access to how your team works.
        </p>
      </div>

      {/* Custom roles */}
      <div className="card">
        <div className="card-head-row">
          <div>
            <h3 className="card-title">Custom Roles</h3>
            <p className="answer-hint">
              Create org-specific titles (e.g. “Compliance Lead”). They appear in employee invites
              and the role picker.
            </p>
          </div>
          <Button variant="primary" onClick={openAdd}>
            ＋ Add custom role
          </Button>
        </div>

        {loading ? (
          <p className="answer-hint">Loading…</p>
        ) : data?.custom?.length ? (
          <div className="role-list">
            {data.custom.map((role) => (
              <div key={role.id} className="role-row role-row-static">
                <div className="role-row-head role-row-head-static">
                  <span className="role-row-grow">
                    <span className="role-row-title">
                      {role.name}
                      <span className="chip chip-custom">Custom</span>
                    </span>
                    <span className="role-row-meta">
                      <code className="role-key-code">{role.key}</code> · {role.permissions.length}{' '}
                      permissions · rank {role.rank}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    data-tooltip="Delete role"
                    aria-label={`Delete ${role.name}`}
                    onClick={() => setDeleteTarget(role)}
                  >
                    <TrashIcon />
                  </button>
                </div>
                {role.description && <p className="role-row-desc">{role.description}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="roles-empty">
            <strong>No custom roles yet.</strong>
            <span>
              Add a role tailored to your company and pick exactly which features it can touch.
            </span>
          </div>
        )}
      </div>

      {/* Built-in roles */}
      <div className="card">
        <div className="card-head-row">
          <div>
            <h3 className="card-title">Built-in Roles</h3>
            <p className="answer-hint">
              Expand a role to edit what its members can do. Company Admin is fixed; every other
              role can be customised and reverted.
            </p>
          </div>
        </div>
        {loading ? (
          <p className="answer-hint">Loading…</p>
        ) : (
          <div className="role-list">
            {(data?.builtIn || []).map((role) => (
              <BuiltInRow key={role.key} role={role} catalog={catalog} onSaved={load} />
            ))}
          </div>
        )}
      </div>

      {/* Add custom role modal */}
      <Modal
        open={addOpen}
        title="Add custom role"
        size="lg"
        onClose={() => setAddOpen(false)}
        footer={
          <div className="modal-foot-split">
            <span className="answer-hint">
              {perms.size} permission{perms.size === 1 ? '' : 's'} selected
            </span>
            <div className="action-group">
              <Button variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={createRole} disabled={saving}>
                {saving ? 'Creating…' : 'Create role'}
              </Button>
            </div>
          </div>
        }
      >
        <p className="answer-hint" style={{ marginBottom: '1rem' }}>
          Define a new role for your organisation and pick its permissions from the catalog below.
        </p>
        <div className="form-grid-2">
          <TextField
            label="Role Name"
            name="roleName"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
            required
            maxLength={60}
            placeholder="e.g. Compliance Lead"
          />
          <div className="field">
            <label className="field-label" htmlFor="roleKey">
              Internal Key
            </label>
            <input
              id="roleKey"
              name="roleKey"
              className="field-input"
              value={keyTouched ? form.key : derivedKey}
              maxLength={60}
              placeholder="compliance_lead"
              onChange={(e) => {
                setKeyTouched(true);
                setForm({ ...form, key: e.target.value });
              }}
            />
            <p className="answer-hint">
              <code className="role-key-code">{derivedKey || 'compliance_lead'}</code> — snake_case,
              used in code &amp; APIs.
            </p>
            {errors.key && <p className="field-error">{errors.key}</p>}
          </div>
        </div>
        <TextField
          label="Description"
          name="roleDesc"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={200}
          placeholder="Short description shown in the role picker tooltip."
        />
        <div className="field">
          <label className="field-label" htmlFor="roleRank">
            Rank: <strong>{form.rank}</strong>
          </label>
          <input
            id="roleRank"
            type="range"
            min="1"
            max="9"
            value={form.rank}
            className="rank-slider"
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
          />
          <p className="answer-hint">
            Used to compute a member’s primary role when they hold several. Higher = more senior.
          </p>
        </div>
        <div className="field">
          <label className="field-label">
            Permissions <span className="answer-hint">({perms.size} selected)</span>
          </label>
          <PermissionGrid catalog={catalog} enabled={perms} onToggle={togglePerm} />
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Custom Role"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteRole}>
              Delete
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to delete the role {deleteTarget?.name}? Members holding only this
          role will fall back to their built-in role.
        </p>
      </Modal>
    </div>
  );
}
