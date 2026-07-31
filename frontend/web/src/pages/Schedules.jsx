import { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';
import { formatDate, formatDateTime } from '../utils/datetime.js';

// Reusable blackout-date picker: add specific dates the schedule should skip.
function BlackoutDatesField({ dates, onChange }) {
  const [newDate, setNewDate] = useState('');
  const add = () => {
    if (!newDate || dates.includes(newDate)) return;
    onChange([...dates, newDate].sort());
    setNewDate('');
  };
  return (
    <div className="field">
      <label className="field-label">Blackout Dates (optional)</label>
      <p className="answer-hint">
        Dates on which this schedule will NOT run (e.g. public holidays).
      </p>
      <div className="blackout-add">
        <input
          type="date"
          className="field-input"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
        />
        <Button variant="secondary" onClick={add} disabled={!newDate}>
          Add Date
        </Button>
      </div>
      {dates.length > 0 && (
        <div className="blackout-chips">
          {dates.map((d) => (
            <span key={d} className="blackout-chip">
              {formatDate(`${d}T00:00:00`)}
              <button
                type="button"
                aria-label={`Remove ${d}`}
                onClick={() => onChange(dates.filter((x) => x !== d))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Recurring Assessment Engine — schedule management UI (SCH-01/02).
const DAY_OPTIONS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' }
];

export default function Schedules() {
  const { role } = useAuth();
  const toast = useToast();
  const list = useList('/schedules');

  const [tests, setTests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    testId: '',
    frequency: 'weekly',
    dayOfWeek: '1',
    dayOfMonth: '1',
    openHour: '9',
    windowHours: '9',
    targetType: role === 'team_leader' ? 'team' : 'company',
    targetId: '',
    blackoutDates: []
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [blackoutTarget, setBlackoutTarget] = useState(null); // schedule being edited
  const [blackoutList, setBlackoutList] = useState([]);
  const [savingBlackout, setSavingBlackout] = useState(false);

  useEffect(() => {
    api
      .get('/tests', { params: { state: 'published', limit: 100 } })
      .then((r) => setTests(r.data.data.rows))
      .catch(() => {});
    api
      .get('/departments', { params: { limit: 100 } })
      .then((r) => setDepartments(r.data.data.rows))
      .catch(() => {});
    api
      .get('/teams', { params: { limit: 100 } })
      .then((r) => setTeams(r.data.data.rows))
      .catch(() => {});
  }, []);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const openAdd = () => {
    setForm((current) => ({ ...current, blackoutDates: [] }));
    setFormError('');
    setAddOpen(true);
  };

  const openBlackout = (row) => {
    setBlackoutTarget(row);
    setBlackoutList(row.blackoutDates || []);
  };

  const saveBlackout = async () => {
    setSavingBlackout(true);
    try {
      const response = await api.patch(`/schedules/${blackoutTarget.id}/blackout-dates`, {
        blackoutDates: blackoutList
      });
      toast.show(response.data.data.message, 'success');
      setBlackoutTarget(null);
      await list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSavingBlackout(false);
    }
  };

  const handleCreate = async () => {
    if (!form.testId) {
      setFormError('Test is required.');
      return;
    }
    if (form.targetType !== 'company' && !form.targetId) {
      setFormError('Select who the schedule targets.');
      return;
    }
    setSaving(true);
    try {
      const response = await api.post('/schedules', {
        testId: form.testId,
        frequency: form.frequency,
        dayOfWeek: Number(form.dayOfWeek),
        dayOfMonth: Number(form.dayOfMonth),
        openHour: Number(form.openHour),
        windowHours: Number(form.windowHours),
        targetType: form.targetType,
        targetId: form.targetId || null,
        blackoutDates: form.blackoutDates
      });
      setAddOpen(false);
      toast.show(response.data.data.message, 'success');
      await list.load();
    } catch (error) {
      setFormError(apiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row) => {
    try {
      const response = await api.patch(`/schedules/${row.id}/toggle`);
      toast.show(response.data.data.message, 'success');
      await list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/schedules/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.show(response.data.data.message, 'success');
      await list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const frequencyLabel = (row) => {
    if (row.frequency === 'daily') return 'Daily';
    if (row.frequency === 'weekly')
      return `Weekly (${DAY_OPTIONS.find((d) => Number(d.value) === row.dayOfWeek)?.label || ''})`;
    return `Monthly (day ${row.dayOfMonth})`;
  };

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Recurring Schedules</h2>
          <p className="page-subtitle">
            Assessments run automatically every cycle — assignment, notification and deadline
            included.
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          Add Schedule
        </Button>
      </div>

      <DataTable
        columns={[
          { key: 'test', label: 'Test' },
          {
            key: 'freq',
            label: 'Frequency',
            filter: {
              type: 'select',
              param: 'frequency',
              options: [
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' }
              ]
            }
          },
          { key: 'window', label: 'Open Window' },
          {
            key: 'target',
            label: 'Target',
            filter: {
              type: 'select',
              param: 'targetType',
              options: [
                { value: 'company', label: 'Whole Company' },
                { value: 'department', label: 'Department' },
                { value: 'team', label: 'Team' },
                { value: 'employee', label: 'Employee' }
              ]
            }
          },
          {
            key: 'status',
            label: 'Status',
            filter: {
              type: 'select',
              param: 'active',
              options: [
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Paused' }
              ]
            }
          },
          { key: 'created', label: 'Created' },
          { key: 'actions', label: 'Actions', className: 'col-actions-wide' }
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">{row.testTitle}</td>
            <td>{frequencyLabel(row)}</td>
            <td>
              {String(row.openHour).padStart(2, '0')}:00 for {row.windowHours}h
            </td>
            <td>{row.targetType === 'company' ? 'Whole Company' : row.targetType}</td>
            <td>
              <span className={`state-badge ${row.active ? 'state-published' : 'state-draft'}`}>
                {row.active ? 'Active' : 'Paused'}
              </span>
            </td>
            <td className="cell-wrap">{formatDateTime(row.createdAt)}</td>
            <td className="col-actions-wide">
              <span className="action-group">
                <Button variant="secondary" onClick={() => handleToggle(row)}>
                  {row.active ? 'Pause' : 'Activate'}
                </Button>
                <button
                  type="button"
                  className={`icon-btn${row.blackoutDates?.length ? ' icon-btn-primary' : ''}`}
                  data-tooltip={
                    row.blackoutDates?.length
                      ? `${row.blackoutDates.length} blackout date(s)`
                      : 'Blackout dates'
                  }
                  aria-label="Manage blackout dates"
                  onClick={() => openBlackout(row)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  data-tooltip="Delete"
                  aria-label={`Delete schedule for ${row.testTitle}`}
                  onClick={() => setDeleteTarget(row)}
                >
                  <TrashIcon />
                </button>
              </span>
            </td>
          </tr>
        )}
      />

      <Modal
        open={addOpen}
        title="Add Schedule"
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
        <SelectField
          label="Test"
          name="sTest"
          value={form.testId}
          onChange={setField('testId')}
          options={tests.map((test) => ({ value: test.id, label: test.title }))}
          required
        />
        <SelectField
          label="Frequency"
          name="sFrequency"
          value={form.frequency}
          onChange={setField('frequency')}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' }
          ]}
          required
        />
        {form.frequency === 'weekly' && (
          <SelectField
            label="Day of Week"
            name="sDay"
            value={form.dayOfWeek}
            onChange={setField('dayOfWeek')}
            options={DAY_OPTIONS}
            required
          />
        )}
        {form.frequency === 'monthly' && (
          <TextField
            label="Day of Month (1–28)"
            name="sDom"
            type="number"
            value={form.dayOfMonth}
            onChange={setField('dayOfMonth')}
            required
          />
        )}
        <div className="editor-two-col">
          <TextField
            label="Opens At (hour, 0–23)"
            name="sOpen"
            type="number"
            value={form.openHour}
            onChange={setField('openHour')}
            required
          />
          <TextField
            label="Window (hours)"
            name="sWindow"
            type="number"
            value={form.windowHours}
            onChange={setField('windowHours')}
            required
          />
        </div>
        <SelectField
          label="Target"
          name="sTargetType"
          value={form.targetType}
          onChange={(event) => setForm({ ...form, targetType: event.target.value, targetId: '' })}
          options={
            role === 'team_leader'
              ? [{ value: 'team', label: 'A Team' }]
              : [
                  { value: 'company', label: 'Whole Company' },
                  { value: 'department', label: 'A Department' },
                  { value: 'team', label: 'A Team' }
                ]
          }
          required
        />
        {form.targetType === 'department' && (
          <SelectField
            label="Department"
            name="sTargetDept"
            value={form.targetId}
            onChange={setField('targetId')}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            required
          />
        )}
        {form.targetType === 'team' && (
          <SelectField
            label="Team"
            name="sTargetTeam"
            value={form.targetId}
            onChange={setField('targetId')}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            required
          />
        )}
        <BlackoutDatesField
          dates={form.blackoutDates}
          onChange={(dates) => setForm((current) => ({ ...current, blackoutDates: dates }))}
        />
        {formError && <p className="field-error">{formError}</p>}
      </Modal>

      <Modal
        open={Boolean(blackoutTarget)}
        title={`Blackout Dates: ${blackoutTarget?.testTitle || ''}`}
        onClose={() => setBlackoutTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlackoutTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveBlackout} disabled={savingBlackout}>
              {savingBlackout ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <BlackoutDatesField dates={blackoutList} onChange={setBlackoutList} />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Schedule"
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
        <p>Are you sure you want to delete the schedule for {deleteTarget?.testTitle}?</p>
      </Modal>
    </div>
  );
}
