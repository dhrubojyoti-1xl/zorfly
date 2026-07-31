import { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';
import { DIFFICULTY_OPTIONS } from '../utils/constants.js';

// Learning path management (TRN-04) — Company Admin / HR.
// A path = ordered steps: material → practice → final test.
export default function Paths() {
  const toast = useToast();
  const list = useList('/paths');
  const [materials, setMaterials] = useState([]);
  const [tests, setTests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });
  const [steps, setSteps] = useState([]);
  const [builderError, setBuilderError] = useState('');
  const [saving, setSaving] = useState(false);

  const [assignTarget, setAssignTarget] = useState(null);
  const [assignForm, setAssignForm] = useState({ targetType: 'company', targetId: '' });
  const [assignError, setAssignError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get('/learning', { params: { limit: 100 } })
      .then((r) => setMaterials(r.data.data.rows))
      .catch(() => {});
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

  const addStep = (kind) => {
    const defaults = {
      material: { kind, title: '', materialId: '' },
      test: { kind, title: '', testId: '' },
      practice: { kind, title: '', practice: { categoryId: '', difficulty: '', count: 5 } }
    };
    setSteps((current) => [...current, defaults[kind]]);
  };
  const setStep = (index, patch) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  const removeStep = (index) => setSteps((current) => current.filter((_, i) => i !== index));

  const openBuilder = () => {
    setForm({ title: '', description: '' });
    setSteps([]);
    setBuilderError('');
    setBuilderOpen(true);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || form.title.trim().length < 3) {
      setBuilderError('Path Title must be at least 3 characters.');
      return;
    }
    if (steps.length === 0) {
      setBuilderError('Add at least one step.');
      return;
    }
    for (const step of steps) {
      if (!step.title.trim()) return setBuilderError('Every step needs a title.');
      if (step.kind === 'material' && !step.materialId)
        return setBuilderError('Select the material for every material step.');
      if (step.kind === 'test' && !step.testId)
        return setBuilderError('Select the test for every test step.');
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        steps: steps.map((step) => {
          if (step.kind === 'material')
            return { kind: 'material', title: step.title.trim(), materialId: step.materialId };
          if (step.kind === 'test')
            return { kind: 'test', title: step.title.trim(), testId: step.testId };
          return {
            kind: 'practice',
            title: step.title.trim(),
            practice: {
              categoryId: step.practice.categoryId || null,
              difficulty: step.practice.difficulty || null,
              count: Number(step.practice.count) || 5
            }
          };
        })
      };
      const response = await api.post('/paths', payload);
      setBuilderOpen(false);
      toast.show(response.data.data.message, 'success');
      await list.load();
    } catch (error) {
      setBuilderError(apiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (assignForm.targetType !== 'company' && !assignForm.targetId) {
      setAssignError('Select who to assign the path to.');
      return;
    }
    setAssigning(true);
    try {
      const response = await api.post(`/paths/${assignTarget.id}/assign`, {
        targetType: assignForm.targetType,
        targetId: assignForm.targetId || null
      });
      setAssignTarget(null);
      toast.show(response.data.data.message, 'success');
    } catch (error) {
      setAssignError(apiError(error).message);
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/paths/${deleteTarget.id}`);
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
          <h2 className="page-title">Learning Paths</h2>
          <p className="page-subtitle">
            Ordered journeys: read the material, practise, then pass the final test.
          </p>
        </div>
        <Button variant="primary" onClick={openBuilder}>
          Create Path
        </Button>
      </div>

      <DataTable
        columns={[
          { key: 'title', label: 'Path Title', sortKey: 'title' },
          { key: 'steps', label: 'Steps' },
          { key: 'created', label: 'Created', sortKey: 'createdAt' },
          { key: 'actions', label: 'Actions', className: 'col-actions-wide' }
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">
              {row.title}
              {row.description && <p className="question-pick-meta">{row.description}</p>}
            </td>
            <td>{row.stepCount}</td>
            <td>{new Date(row.createdAt).toLocaleDateString('en-GB')}</td>
            <td className="col-actions-wide">
              <span className="action-group">
                <Button
                  variant="primary"
                  onClick={() => {
                    setAssignForm({ targetType: 'company', targetId: '' });
                    setAssignError('');
                    setAssignTarget(row);
                  }}
                >
                  Assign
                </Button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  data-tooltip="Delete"
                  aria-label={`Delete ${row.title}`}
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
        open={builderOpen}
        title="Create Learning Path"
        onClose={() => setBuilderOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBuilderOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <TextField
          label="Path Title"
          name="pathTitle"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          required
          maxLength={200}
        />
        <div className="field">
          <label className="field-label" htmlFor="pathDescription">
            Description
          </label>
          <textarea
            id="pathDescription"
            className="field-input field-textarea"
            placeholder="Enter Description"
            value={form.description}
            maxLength={2000}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </div>

        <span className="field-label">Steps (in order)</span>
        {steps.map((step, index) => (
          <div key={index} className="path-step-editor">
            <div className="editor-row">
              <span className="sequence-number">{index + 1}.</span>
              <span className="state-badge">
                {step.kind === 'material' ? 'Material' : step.kind === 'test' ? 'Test' : 'Practice'}
              </span>
              <input
                type="text"
                className="field-input"
                placeholder="Enter Step Title"
                value={step.title}
                maxLength={200}
                onChange={(event) => setStep(index, { title: event.target.value })}
              />
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                data-tooltip="Remove step"
                aria-label="Remove step"
                onClick={() => removeStep(index)}
              >
                ✕
              </button>
            </div>
            {step.kind === 'material' && (
              <SelectField
                label="Material"
                name={`stepMaterial${index}`}
                value={step.materialId}
                onChange={(event) => setStep(index, { materialId: event.target.value })}
                options={materials.map((material) => ({
                  value: material.id,
                  label: material.title
                }))}
                required
              />
            )}
            {step.kind === 'test' && (
              <SelectField
                label="Test"
                name={`stepTest${index}`}
                value={step.testId}
                onChange={(event) => setStep(index, { testId: event.target.value })}
                options={tests.map((test) => ({ value: test.id, label: test.title }))}
                required
              />
            )}
            {step.kind === 'practice' && (
              <div className="editor-two-col">
                <SelectField
                  label="Difficulty"
                  name={`stepDifficulty${index}`}
                  value={step.practice.difficulty}
                  onChange={(event) =>
                    setStep(index, {
                      practice: { ...step.practice, difficulty: event.target.value }
                    })
                  }
                  options={DIFFICULTY_OPTIONS}
                  placeholder="Any difficulty"
                />
                <TextField
                  label="Questions"
                  name={`stepCount${index}`}
                  type="number"
                  value={step.practice.count}
                  onChange={(event) =>
                    setStep(index, { practice: { ...step.practice, count: event.target.value } })
                  }
                />
              </div>
            )}
          </div>
        ))}
        <div className="action-group">
          <Button variant="secondary" onClick={() => addStep('material')}>
            + Material
          </Button>
          <Button variant="secondary" onClick={() => addStep('practice')}>
            + Practice
          </Button>
          <Button variant="secondary" onClick={() => addStep('test')}>
            + Test
          </Button>
        </div>
        {builderError && <p className="field-error">{builderError}</p>}
      </Modal>

      <Modal
        open={Boolean(assignTarget)}
        title={`Assign Path: ${assignTarget?.title || ''}`}
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
          name="pathAssignType"
          value={assignForm.targetType}
          onChange={(event) => setAssignForm({ targetType: event.target.value, targetId: '' })}
          options={[
            { value: 'company', label: 'Whole Company' },
            { value: 'department', label: 'A Department' },
            { value: 'team', label: 'A Team' }
          ]}
          required
        />
        {assignForm.targetType === 'department' && (
          <SelectField
            label="Department"
            name="pathAssignDept"
            value={assignForm.targetId}
            onChange={(event) => setAssignForm({ ...assignForm, targetId: event.target.value })}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            required
          />
        )}
        {assignForm.targetType === 'team' && (
          <SelectField
            label="Team"
            name="pathAssignTeam"
            value={assignForm.targetId}
            onChange={(event) => setAssignForm({ ...assignForm, targetId: event.target.value })}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            required
          />
        )}
        {assignError && <p className="field-error">{assignError}</p>}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Learning Path"
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
        <p>Are you sure you want to delete Learning Path {deleteTarget?.title}?</p>
      </Modal>
    </div>
  );
}
