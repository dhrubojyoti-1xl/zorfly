import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import SelectField from '../components/SelectField.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  ROLE_LABELS,
  ROLE_OPTIONS
} from '../utils/constants.js';
import { validateContactNumber, validateEmail, validateFullName } from '../utils/validators.js';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  contactNumber: '',
  role: 'employee',
  departmentId: '',
  teamId: '',
  branchId: '',
  difficultyLevel: 'fresher'
};

// A select that also lets the user create a new option inline (no data yet →
// "＋ New" reveals a name field; on save it is created, added and auto-selected).
function CreatableSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select',
  onCreate
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const newId = await onCreate(text.trim());
    setBusy(false);
    if (newId) {
      onChange({ target: { value: newId } });
      setText('');
      setAdding(false);
    }
  };

  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label" htmlFor={name}>
          {label}
        </label>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setAdding((a) => !a);
            setText('');
          }}
        >
          {adding ? 'Cancel' : `＋ New ${label}`}
        </button>
      </div>
      <select id={name} name={name} className="field-input" value={value} onChange={onChange}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {adding && (
        <div className="inline-create">
          <input
            type="text"
            className="field-input"
            value={text}
            maxLength={100}
            autoFocus
            placeholder={`New ${label.toLowerCase()} name`}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAdd();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAdd}
            disabled={busy || !text.trim()}
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Employees() {
  const { role, can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const list = useList('/employees');
  const canWrite = can('employees:create');
  const canEdit = can('employees:update');
  const canDelete = can('employees:delete');

  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [branches, setBranches] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [roleLabels, setRoleLabels] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // employee being edited
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Custom role names for the list column (built-in labels merged with custom).
  useEffect(() => {
    api
      .get('/roles/assignable')
      .then((r) => {
        const all = [...r.data.data.builtIn, ...r.data.data.custom];
        setRoleOptions(all.map((role) => ({ value: role.key, label: role.name })));
        setRoleLabels(Object.fromEntries(all.map((role) => [role.key, role.name])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canWrite) return;
    Promise.all([
      api.get('/departments', { params: { limit: 100 } }),
      api.get('/teams', { params: { limit: 100 } }),
      api.get('/branches', { params: { limit: 100 } })
    ])
      .then(([departmentsRes, teamsRes, branchesRes]) => {
        setDepartments(departmentsRes.data.data.rows);
        setTeams(teamsRes.data.data.rows);
        setBranches(branchesRes.data.data.rows);
      })
      .catch(() => {});
  }, [canWrite]);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setTempPassword(null);
    setEditTarget(null);
    setAddOpen(true);
  };

  const openEdit = (employee) => {
    setForm({
      fullName: employee.fullName || '',
      email: employee.email || '',
      contactNumber: employee.contactNumber || '',
      role: employee.role || 'employee',
      departmentId: employee.departmentId || '',
      teamId: employee.teamId || '',
      branchId: employee.branchId || '',
      difficultyLevel: employee.difficultyLevel || 'fresher'
    });
    setErrors({});
    setTempPassword(null);
    setAddOpen(false);
    setEditTarget(employee);
  };

  const closeModal = () => {
    setAddOpen(false);
    setEditTarget(null);
  };

  const handleCreate = async () => {
    const nextErrors = {
      fullName: validateFullName(form.fullName),
      email: validateEmail(form.email),
      contactNumber: form.contactNumber ? validateContactNumber(form.contactNumber) : ''
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSaving(true);
    try {
      const response = await api.post('/employees', {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber.trim(),
        role: form.role,
        departmentId: form.departmentId || null,
        teamId: form.teamId || null,
        branchId: form.branchId || null,
        difficultyLevel: form.difficultyLevel
      });
      toast.show(response.data.data.message, 'success');
      if (response.data.data.temporaryPassword) {
        setTempPassword(response.data.data.temporaryPassword);
      } else {
        setAddOpen(false);
      }
      list.setPage(1);
      await list.load();
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors);
      toast.show(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const nextErrors = {
      fullName: validateFullName(form.fullName),
      contactNumber: form.contactNumber ? validateContactNumber(form.contactNumber) : ''
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSaving(true);
    try {
      const response = await api.patch(`/employees/${editTarget.id}`, {
        fullName: form.fullName.trim(),
        contactNumber: form.contactNumber.trim(),
        role: form.role,
        departmentId: form.departmentId || null,
        teamId: form.teamId || null,
        branchId: form.branchId || null,
        difficultyLevel: form.difficultyLevel
      });
      toast.show(response.data.data.message, 'success');
      setEditTarget(null);
      await list.load();
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors || {});
      toast.show(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => (editTarget ? handleUpdate() : handleCreate());

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/employees/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.show(response.data.data.message, 'success');
      await list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toOptions = (rowsArray) => rowsArray.map((row) => ({ value: row.id, label: row.name }));

  // Inline-create an org entity from a dropdown; returns its new id (or null).
  const createEntity = async (endpoint, entityName, setList) => {
    try {
      const response = await api.post(endpoint, { name: entityName });
      const created = { id: response.data.data.id, name: response.data.data.name };
      setList((current) => [created, ...current]);
      toast.show(response.data.data.message, 'success');
      return created.id;
    } catch (error) {
      toast.show(apiError(error).message, 'error');
      return null;
    }
  };

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Employees</h2>
          <p className="page-subtitle">
            {role === 'team_leader'
              ? 'Members of your teams.'
              : 'Manage the people in your company.'}
          </p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={openAdd}>
            Add Employee
          </Button>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Full Name', sortKey: 'fullName' },
          { key: 'email', label: 'Email ID' },
          { key: 'role', label: 'Role' },
          {
            key: 'dept',
            label: 'Department',
            filter: canWrite
              ? { type: 'select', param: 'departmentId', options: toOptions(departments) }
              : undefined
          },
          {
            key: 'team',
            label: 'Team',
            filter: canWrite
              ? { type: 'select', param: 'teamId', options: toOptions(teams) }
              : undefined
          },
          {
            key: 'level',
            label: 'Level',
            filter: { type: 'select', param: 'difficultyLevel', options: DIFFICULTY_OPTIONS }
          },
          ...(canEdit || canDelete
            ? [
                {
                  key: 'action',
                  label: canEdit && canDelete ? 'Actions' : 'Action',
                  className: 'col-action'
                }
              ]
            : [])
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">{row.fullName}</td>
            <td className="cell-wrap">{row.email}</td>
            <td>{roleLabels[row.role] || ROLE_LABELS[row.role] || row.role}</td>
            <td className="cell-wrap">{row.department || '—'}</td>
            <td className="cell-wrap">{row.team || '—'}</td>
            <td>{DIFFICULTY_LABELS[row.difficultyLevel] || row.difficultyLevel}</td>
            {(canEdit || canDelete) && (
              <td className="col-action">
                <span className="action-group">
                  {canEdit && (
                    <button
                      type="button"
                      className="icon-btn"
                      data-tooltip="Edit"
                      aria-label={`Edit ${row.fullName}`}
                      onClick={() => openEdit(row)}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      data-tooltip="Delete"
                      aria-label={`Delete ${row.fullName}`}
                      onClick={() => setDeleteTarget(row)}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </span>
              </td>
            )}
          </tr>
        )}
      />

      <Modal
        open={addOpen || Boolean(editTarget)}
        title={editTarget ? 'Edit Employee' : 'Add Employee'}
        size={tempPassword ? 'md' : 'lg'}
        onClose={closeModal}
        footer={
          tempPassword ? (
            <Button variant="primary" onClick={closeModal}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )
        }
      >
        {tempPassword ? (
          <div>
            <p>
              Employee added successfully. Share these login details securely — the password is
              shown only once.
            </p>
            <p className="temp-password">
              Email ID: <strong>{form.email}</strong>
              <br />
              Temporary Password: <strong>{tempPassword}</strong>
            </p>
          </div>
        ) : (
          <div className="form-grid">
            <p className="form-section-label">Personal Details</p>
            <div className="form-grid-2">
              <TextField
                label="Full Name"
                name="empFullName"
                value={form.fullName}
                onChange={setField('fullName')}
                error={errors.fullName}
                required
                maxLength={100}
              />
              <TextField
                label="Email ID"
                name="empEmail"
                type="email"
                value={form.email}
                onChange={setField('email')}
                error={errors.email}
                required
                maxLength={254}
                disabled={Boolean(editTarget)}
              />
              <TextField
                label="Contact Number"
                name="empContact"
                value={form.contactNumber}
                onChange={setField('contactNumber')}
                error={errors.contactNumber}
                maxLength={15}
                inputMode="numeric"
              />
              <div className="field">
                <div className="field-label-row">
                  <label className="field-label" htmlFor="empRole">
                    Role<span className="required-mark">*</span>
                  </label>
                  {can('roles:manage') && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => navigate('/app/roles')}
                      title="Create a custom role"
                    >
                      ＋ New Role
                    </button>
                  )}
                </div>
                <select
                  id="empRole"
                  name="empRole"
                  className="field-input"
                  value={form.role}
                  onChange={setField('role')}
                >
                  {(roleOptions.length ? roleOptions : ROLE_OPTIONS).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="form-section-label">Placement</p>
            <div className="form-grid-2">
              <CreatableSelect
                label="Department"
                name="empDept"
                value={form.departmentId}
                onChange={setField('departmentId')}
                options={toOptions(departments)}
                onCreate={(entityName) => createEntity('/departments', entityName, setDepartments)}
              />
              <CreatableSelect
                label="Team"
                name="empTeam"
                value={form.teamId}
                onChange={setField('teamId')}
                options={toOptions(teams)}
                onCreate={(entityName) => createEntity('/teams', entityName, setTeams)}
              />
              <CreatableSelect
                label="Branch"
                name="empBranch"
                value={form.branchId}
                onChange={setField('branchId')}
                options={toOptions(branches)}
                onCreate={(entityName) => createEntity('/branches', entityName, setBranches)}
              />
              <SelectField
                label="Difficulty Level"
                name="empLevel"
                value={form.difficultyLevel}
                onChange={setField('difficultyLevel')}
                options={DIFFICULTY_OPTIONS}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Remove Employee"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing…' : 'Remove'}
            </Button>
          </>
        }
      >
        <p>Are you sure you want to remove Employee {deleteTarget?.fullName} from this company?</p>
      </Modal>
    </div>
  );
}
