import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Send, CalendarClock, PenLine, FileText, Shuffle, Zap } from 'lucide-react';
import ActionMenu from '../components/ActionMenu.jsx';
import {
  EyeIcon,
  EditIcon,
  PublishIcon,
  AssignIcon,
  ResultsIcon,
  HistoryIcon,
  SuspendIcon,
  ArchiveIcon
} from '../components/ActionIcons.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import SelectField from '../components/SelectField.jsx';
import AiGenerateModal from '../components/AiGenerateModal.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';
import { DIFFICULTY_LABELS, ROLE_OPTIONS } from '../utils/constants.js';

const STATE_LABELS = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived'
};
// Status filter dropdown: the real stored states, minus Archived (those
// live in Recycle Bin, not this list) and plus Active — a derived lifecycle
// status the backend resolves specially since it isn't a stored value.
const STATE_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' }
];
// Display labels include the derived lifecycle states shown on the badge.
const LIFECYCLE_LABELS = { ...STATE_LABELS, scheduled: 'Scheduled', active: 'Active' };
const DIFFICULTY_OPTIONS = Object.entries(DIFFICULTY_LABELS).map(([value, label]) => ({
  value,
  label
}));

export default function Tests() {
  const { role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const list = useList('/tests');

  const [assignTarget, setAssignTarget] = useState(null); // test being assigned
  const [assignForm, setAssignForm] = useState({
    targetType: 'company',
    targetIds: [],
    targetKeys: [],
    dueAt: ''
  });
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const canAi = role === 'company_admin' || role === 'hr';
  const [lifecycleTarget, setLifecycleTarget] = useState(null); // { test, action: 'close'|'archive' }
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // draft test being permanently deleted
  const [deleting, setDeleting] = useState(false);
  const [summary, setSummary] = useState(null);

  // Summary counts for the cards above the table. Reuses the same /tests
  // endpoint the table already calls (no new backend route) with a higher
  // page size just to derive a breakdown by lifecycle status — Total Tests
  // comes from the response's real totalCount (always accurate); the rest
  // are counted from the up-to-100 rows that come back with it, so on a
  // company with more tests than that they under-count rather than lie. No
  // trend/percentage is shown on these cards since there's no historical
  // series to back one — same "never fabricate" rule the rest of the
  // dashboards follow.
  const loadSummary = useCallback(async () => {
    try {
      const response = await api.get('/tests', { params: { limit: 100 } });
      const { rows, totalCount } = response.data.data;
      setSummary({
        total: totalCount,
        published: rows.filter((r) => r.lifecycleStatus === 'published').length,
        active: rows.filter((r) => r.lifecycleStatus === 'active').length,
        scheduled: rows.filter((r) => r.lifecycleStatus === 'scheduled').length,
        drafts: rows.filter((r) => r.state === 'draft').length
      });
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const runLifecycle = async () => {
    if (!lifecycleTarget) return;
    setLifecycleBusy(true);
    try {
      const { test, action } = lifecycleTarget;
      const response = await api.post(`/tests/${test.id}/${action}`);
      setLifecycleTarget(null);
      toast.show(response.data.data.message, 'success');
      await list.load();
      loadSummary();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const handleDeleteTest = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/tests/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.show(response.data.data.message, 'success');
      await list.load();
      loadSummary();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get('/departments', { params: { limit: 100 } }).catch(() => null),
      api.get('/teams', { params: { limit: 100 } }).catch(() => null),
      api.get('/employees', { params: { limit: 100 } }).catch(() => null),
      api.get('/categories').catch(() => null)
    ]).then(([departmentsRes, teamsRes, employeesRes, categoriesRes]) => {
      if (departmentsRes) setDepartments(departmentsRes.data.data.rows);
      if (teamsRes) setTeams(teamsRes.data.data.rows);
      if (employeesRes) setEmployees(employeesRes.data.data.rows);
      if (categoriesRes) setCategories(categoriesRes.data.data.rows);
    });
  }, []);

  const categoryOptions = categories
    .filter((category) => !category.parentId)
    .map((category) => ({ value: category.id, label: category.name }));
  const subCategoryOptions = categories
    .filter((category) => category.parentId)
    .map((category) => ({ value: category.id, label: category.name }));

  const handlePublish = async (test) => {
    setBusyId(test.id);
    try {
      const response = await api.post(`/tests/${test.id}/publish`);
      toast.show(response.data.data.message, 'success');
      await list.load();
      loadSummary();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openAssign = (test) => {
    setAssignForm({
      targetType: role === 'team_leader' ? 'team' : 'company',
      targetIds: [],
      targetKeys: [],
      dueAt: ''
    });
    setAssignError('');
    setAssignTarget(test);
  };

  const isKeyTarget = assignForm.targetType === 'role' || assignForm.targetType === 'difficulty';

  const toggleTarget = (value) => {
    const field = isKeyTarget ? 'targetKeys' : 'targetIds';
    setAssignForm((current) => {
      const current_list = current[field];
      const next = current_list.includes(value)
        ? current_list.filter((item) => item !== value)
        : [...current_list, value];
      return { ...current, [field]: next };
    });
  };

  const handleAssign = async () => {
    const needsTarget = assignForm.targetType !== 'company';
    const chosen = isKeyTarget ? assignForm.targetKeys : assignForm.targetIds;
    if (needsTarget && chosen.length === 0) {
      setAssignError('Select at least one target.');
      return;
    }
    setAssigning(true);
    try {
      const response = await api.post(`/tests/${assignTarget.id}/assign`, {
        targetType: assignForm.targetType,
        targetIds: isKeyTarget ? [] : assignForm.targetIds,
        targetKeys: isKeyTarget ? assignForm.targetKeys : [],
        dueAt: assignForm.dueAt ? new Date(assignForm.dueAt).toISOString() : null
      });
      setAssignTarget(null);
      toast.show(response.data.data.message, 'success');
    } catch (error) {
      const parsed = apiError(error);
      setAssignError(parsed.message);
    } finally {
      setAssigning(false);
    }
  };

  const targetOptions = () => {
    if (assignForm.targetType === 'department')
      return departments.map((d) => ({ value: d.id, label: d.name }));
    if (assignForm.targetType === 'team') return teams.map((t) => ({ value: t.id, label: t.name }));
    if (assignForm.targetType === 'employee')
      return employees.map((e) => ({ value: e.userId, label: e.fullName }));
    if (assignForm.targetType === 'role') return ROLE_OPTIONS;
    if (assignForm.targetType === 'difficulty') return DIFFICULTY_OPTIONS;
    return [];
  };

  const targetTypeLabel =
    {
      department: 'Departments',
      team: 'Teams',
      employee: 'Employees',
      role: 'Roles',
      difficulty: 'Difficulty Levels'
    }[assignForm.targetType] || '';

  const targetTypeOptions =
    role === 'team_leader'
      ? [{ value: 'team', label: 'Teams' }]
      : [
          { value: 'company', label: 'Whole Company' },
          { value: 'department', label: 'Departments' },
          { value: 'team', label: 'Teams' },
          { value: 'employee', label: 'Employees' },
          { value: 'role', label: 'Roles' },
          { value: 'difficulty', label: 'Difficulty Levels' }
        ];

  // Context menu items per test — replaces the old inline icon row. What's
  // offered depends on lifecycle state, same as the icons did before.
  const menuItemsFor = (row) => {
    const items = [
      {
        label: 'View Details',
        icon: EyeIcon,
        onClick: () => navigate(`/app/tests/${row.id}/details`)
      }
    ];
    if (row.state === 'draft') {
      items.push(
        { label: 'Edit', icon: EditIcon, onClick: () => navigate(`/app/tests/${row.id}`) },
        {
          label: busyId === row.id ? 'Publishing…' : 'Publish',
          icon: PublishIcon,
          onClick: () => handlePublish(row)
        },
        { label: 'Delete Test', icon: TrashIcon, danger: true, onClick: () => setDeleteTarget(row) }
      );
    }
    if (row.state === 'published') {
      items.push(
        { label: 'Assign Test', icon: AssignIcon, onClick: () => openAssign(row) },
        {
          label: 'Assignment History',
          icon: HistoryIcon,
          onClick: () => navigate(`/app/tests/${row.id}/assignments`)
        },
        {
          label: 'View Results',
          icon: ResultsIcon,
          onClick: () => navigate(`/app/tests/${row.id}/results`)
        },
        {
          label: 'Close Assignment',
          icon: SuspendIcon,
          onClick: () => setLifecycleTarget({ test: row, action: 'close' })
        },
        {
          label: 'Archive Test',
          icon: ArchiveIcon,
          onClick: () => setLifecycleTarget({ test: row, action: 'archive' })
        }
      );
    }
    if (row.state === 'closed') {
      items.push(
        {
          label: 'Assignment History',
          icon: HistoryIcon,
          onClick: () => navigate(`/app/tests/${row.id}/assignments`)
        },
        {
          label: 'View Results',
          icon: ResultsIcon,
          onClick: () => navigate(`/app/tests/${row.id}/results`)
        },
        {
          label: 'Archive Test',
          icon: ArchiveIcon,
          onClick: () => setLifecycleTarget({ test: row, action: 'archive' })
        }
      );
    }
    if (row.state === 'archived') {
      items.push({
        label: 'View Results',
        icon: ResultsIcon,
        onClick: () => navigate(`/app/tests/${row.id}/results`)
      });
    }
    return items;
  };

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Tests</h2>
          <p className="page-subtitle">Create, publish and assign assessments.</p>
        </div>
        <span className="action-group">
          {canAi && (
            <Button
              variant="secondary"
              onClick={() => setAiOpen(true)}
              title="Generate a full test with AI"
            >
              ✨ Generate with AI
            </Button>
          )}
          <Button variant="primary" onClick={() => navigate('/app/tests/new')}>
            Create Test
          </Button>
        </span>
      </div>

      {summary && (
        <div className="kpi-grid kpi-grid-tests">
          {/* Total isn't a status itself, so it keeps a neutral colour distinct
              from the four below — each of which now matches its status
              capsule exactly (see .test-status-* in styles.css). */}
          <div
            className="kpi"
            style={{ '--kpi-accent': 'var(--accent-sky)', '--kpi-tint': 'var(--tint-sky)' }}
          >
            <span className="kpi-icon" aria-hidden="true">
              <ClipboardList size={20} strokeWidth={1.9} />
            </span>
            <span className="kpi-body">
              <span className="kpi-value">{summary.total}</span>
              <span className="kpi-label">Total Tests</span>
            </span>
          </div>
          <div
            className="kpi"
            style={{ '--kpi-accent': 'var(--accent-mint)', '--kpi-tint': 'var(--tint-mint)' }}
          >
            <span className="kpi-icon" aria-hidden="true">
              <Send size={20} strokeWidth={1.9} />
            </span>
            <span className="kpi-body">
              <span className="kpi-value">{summary.published}</span>
              <span className="kpi-label">Published</span>
            </span>
          </div>
          <div
            className="kpi"
            style={{
              '--kpi-accent': 'var(--accent-lavender)',
              '--kpi-tint': 'var(--tint-lavender)'
            }}
          >
            <span className="kpi-icon" aria-hidden="true">
              <Zap size={20} strokeWidth={1.9} />
            </span>
            <span className="kpi-body">
              <span className="kpi-value">{summary.active}</span>
              <span className="kpi-label">Active</span>
            </span>
          </div>
          <div
            className="kpi"
            style={{ '--kpi-accent': 'var(--accent-coral)', '--kpi-tint': 'var(--tint-coral)' }}
          >
            <span className="kpi-icon" aria-hidden="true">
              <CalendarClock size={20} strokeWidth={1.9} />
            </span>
            <span className="kpi-body">
              <span className="kpi-value">{summary.scheduled}</span>
              <span className="kpi-label">Scheduled</span>
            </span>
          </div>
          <div
            className="kpi"
            style={{ '--kpi-accent': 'var(--accent-golden)', '--kpi-tint': 'var(--tint-golden)' }}
          >
            <span className="kpi-icon" aria-hidden="true">
              <PenLine size={20} strokeWidth={1.9} />
            </span>
            <span className="kpi-body">
              <span className="kpi-value">{summary.drafts}</span>
              <span className="kpi-label">Drafts</span>
            </span>
          </div>
        </div>
      )}

      {canAi && (
        <AiGenerateModal
          open={aiOpen}
          mode="test"
          categories={categories}
          onClose={() => setAiOpen(false)}
          onDone={(result) => result?.testId && navigate(`/app/tests/${result.testId}`)}
        />
      )}

      <DataTable
        columns={[
          { key: 'title', label: 'Test Title', sortKey: 'title' },
          {
            key: 'category',
            label: 'Category',
            filter: {
              type: 'select',
              param: 'categoryId',
              label: 'Categories',
              options: categoryOptions
            }
          },
          {
            key: 'subcategory',
            label: 'Sub-category',
            filter: {
              type: 'select',
              param: 'subCategoryId',
              label: 'Sub-categories',
              options: subCategoryOptions
            }
          },
          {
            key: 'difficulty',
            label: 'Difficulty',
            filter: { type: 'select', param: 'difficulty', options: DIFFICULTY_OPTIONS }
          },
          { key: 'questions', label: 'Questions' },
          { key: 'marks', label: 'Total Marks', sortKey: 'totalMarks' },
          { key: 'assignments', label: 'Assignments' },
          {
            key: 'state',
            label: 'Status',
            filter: { type: 'select', param: 'state', options: STATE_OPTIONS }
          },
          { key: 'availability', label: 'Availability' },
          { key: 'actions', label: 'Actions', className: 'col-action' }
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">
              <span className="test-title-cell">
                <span
                  className="test-type-icon"
                  style={{
                    background: row.mode === 'random' ? 'var(--tint-coral)' : 'var(--tint-mint)',
                    color: row.mode === 'random' ? 'var(--accent-coral)' : 'var(--accent-mint-deep)'
                  }}
                  data-tooltip={row.mode === 'random' ? 'Random paper' : 'Fixed paper'}
                  aria-hidden="true"
                >
                  {row.mode === 'random' ? (
                    <Shuffle size={14} strokeWidth={2} />
                  ) : (
                    <FileText size={14} strokeWidth={2} />
                  )}
                </span>
                <span className="test-title-text" title={row.title}>
                  {row.title}
                </span>
              </span>
            </td>
            <td className="cell-wrap">{row.category || '—'}</td>
            <td className="cell-wrap">{row.subCategory || '—'}</td>
            <td>{DIFFICULTY_LABELS[row.difficulty] || '—'}</td>
            <td>{row.questionCount}</td>
            <td>{row.totalMarks || '—'}</td>
            <td>
              {row.assignmentsTotal === 0 ? (
                <span className="question-pick-meta">None yet</span>
              ) : (
                <button
                  type="button"
                  className="reach-badge"
                  data-tooltip={`${row.assignmentsActive} active${row.assignmentsScheduled ? `, ${row.assignmentsScheduled} recurring` : ''} — click for full history`}
                  aria-label={`${row.assignmentsTotal} assignments total, ${row.assignmentsActive} active`}
                  onClick={() => navigate(`/app/tests/${row.id}/assignments`)}
                >
                  <strong>{row.assignmentsTotal}</strong>
                  <span className="reach-sep">total</span>
                </button>
              )}
            </td>
            <td>
              <span className={`test-status-badge test-status-${row.lifecycleStatus || row.state}`}>
                {LIFECYCLE_LABELS[row.lifecycleStatus || row.state]}
              </span>
            </td>
            <td className="cell-wrap">{row.scheduleText || '—'}</td>
            <td className="col-action">
              <ActionMenu items={menuItemsFor(row)} />
            </td>
          </tr>
        )}
      />

      <Modal
        open={Boolean(lifecycleTarget)}
        title={lifecycleTarget?.action === 'archive' ? 'Archive Test' : 'Close Assignment'}
        onClose={() => setLifecycleTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLifecycleTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={runLifecycle} disabled={lifecycleBusy}>
              {lifecycleBusy
                ? 'Working…'
                : lifecycleTarget?.action === 'archive'
                  ? 'Archive'
                  : 'Close'}
            </Button>
          </>
        }
      >
        {lifecycleTarget?.action === 'archive' ? (
          <p>
            Archive "{lifecycleTarget?.test?.title}"? It moves to the <strong>Recycle Bin</strong>{' '}
            (Company → Recycle Bin), where you can restore it or delete it permanently. This is a
            soft delete — nothing is destroyed yet.
          </p>
        ) : (
          <p>
            Close "{lifecycleTarget?.test?.title}"? Employees will no longer be able to take it, but
            existing results are kept.
          </p>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Test"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteTest} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p>
          Permanently delete the draft "{deleteTarget?.title}"? It was never published, so there's
          nothing to lose — this can't be undone.
        </p>
      </Modal>

      <Modal
        open={Boolean(assignTarget)}
        title={`Assign Test: ${assignTarget?.title || ''}`}
        onClose={() => setAssignTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAssign} disabled={assigning}>
              {assigning ? 'Assigning…' : 'Assign'}
            </Button>
          </>
        }
      >
        <SelectField
          label="Assign To"
          name="assignType"
          value={assignForm.targetType}
          onChange={(event) =>
            setAssignForm({
              ...assignForm,
              targetType: event.target.value,
              targetIds: [],
              targetKeys: []
            })
          }
          options={targetTypeOptions}
          required
          placeholder="Select"
        />
        {assignForm.targetType !== 'company' && (
          <div className="field">
            <label className="field-label">{targetTypeLabel} — select one or more</label>
            <div className="assign-target-picklist">
              {targetOptions().length === 0 ? (
                <p className="answer-hint">No options available.</p>
              ) : (
                targetOptions().map((option) => (
                  <label key={option.value} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={(isKeyTarget
                        ? assignForm.targetKeys
                        : assignForm.targetIds
                      ).includes(option.value)}
                      onChange={() => toggleTarget(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
        <div className="field">
          <label className="field-label" htmlFor="assignDue">
            Due Date &amp; Time
          </label>
          <input
            id="assignDue"
            type="datetime-local"
            className="field-input"
            value={assignForm.dueAt}
            onChange={(event) => setAssignForm({ ...assignForm, dueAt: event.target.value })}
          />
        </div>
        {assignError && <p className="field-error">{assignError}</p>}
      </Modal>
    </div>
  );
}
