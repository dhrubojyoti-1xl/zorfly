import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';

// Recruitment drives (REC-01) — Company Admin / HR only.
export default function Drives() {
  const toast = useToast();
  const navigate = useNavigate();
  const list = useList('/drives');
  const [tests, setTests] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    testId: '',
    openFrom: '',
    openTo: '',
    showResultToCandidate: false
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/tests', { params: { state: 'published', limit: 100 } })
      .then((r) => setTests(r.data.data.rows))
      .catch(() => {});
  }, []);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const openAdd = () => {
    setForm({
      title: '',
      description: '',
      testId: '',
      openFrom: '',
      openTo: '',
      showResultToCandidate: false
    });
    setErrors({});
    setAddOpen(true);
  };

  const handleCreate = async () => {
    const nextErrors = {};
    if (!form.title.trim() || form.title.trim().length < 3)
      nextErrors.title = 'Position Title must be at least 3 characters.';
    if (!form.testId) nextErrors.testId = 'Assessment is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      const response = await api.post('/drives', {
        title: form.title.trim(),
        description: form.description.trim(),
        testId: form.testId,
        openFrom: form.openFrom ? new Date(form.openFrom).toISOString() : null,
        openTo: form.openTo ? new Date(form.openTo).toISOString() : null,
        showResultToCandidate: form.showResultToCandidate
      });
      setAddOpen(false);
      toast.show(response.data.data.message, 'success');
      await list.load();
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors);
      toast.show(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (row) => {
    const link = `${window.location.origin}/apply/${row.token}`;
    navigator.clipboard.writeText(link).then(
      () => toast.show('Application link copied successfully.', 'success'),
      () => toast.show('Unable to copy the link. Please copy it manually.', 'error')
    );
  };

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Recruitment Drives</h2>
          <p className="page-subtitle">
            Pre-hire assessments with automatic evaluation and candidate ranking.
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>
          Create Drive
        </Button>
      </div>

      <DataTable
        columns={[
          { key: 'title', label: 'Position', sortKey: 'title' },
          { key: 'test', label: 'Assessment' },
          { key: 'candidates', label: 'Candidates' },
          { key: 'completed', label: 'Completed' },
          {
            key: 'status',
            label: 'Status',
            filter: {
              type: 'select',
              param: 'status',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'closed', label: 'Closed' }
              ]
            }
          },
          { key: 'actions', label: 'Actions', className: 'col-actions-wide' }
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">{row.title}</td>
            <td className="cell-wrap">{row.testTitle}</td>
            <td>{row.candidates}</td>
            <td>{row.completed}</td>
            <td>
              <span
                className={`state-badge ${row.status === 'active' ? 'state-published' : 'state-closed'}`}
              >
                {row.status === 'active' ? 'Active' : 'Closed'}
              </span>
            </td>
            <td className="col-actions-wide">
              <span className="action-group">
                <Button
                  variant="secondary"
                  onClick={() => copyLink(row)}
                  title="Copy application link"
                >
                  Copy Link
                </Button>
                <Button
                  variant="primary"
                  onClick={() => navigate(`/app/drives/${row.id}`)}
                  title="View candidates"
                >
                  Candidates
                </Button>
              </span>
            </td>
          </tr>
        )}
      />

      <Modal
        open={addOpen}
        title="Create Recruitment Drive"
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
          label="Position Title"
          name="drTitle"
          value={form.title}
          onChange={setField('title')}
          error={errors.title}
          required
          maxLength={200}
        />
        <div className="field">
          <label className="field-label" htmlFor="drDescription">
            Description
          </label>
          <textarea
            id="drDescription"
            className="field-input field-textarea"
            placeholder="Enter Description"
            value={form.description}
            maxLength={2000}
            onChange={setField('description')}
          />
        </div>
        <SelectField
          label="Assessment"
          name="drTest"
          value={form.testId}
          onChange={setField('testId')}
          options={tests.map((test) => ({ value: test.id, label: test.title }))}
          error={errors.testId}
          required
        />
        <div className="editor-two-col">
          <div className="field">
            <label className="field-label" htmlFor="drFrom">
              Open From
            </label>
            <input
              id="drFrom"
              type="datetime-local"
              className="field-input"
              value={form.openFrom}
              onChange={setField('openFrom')}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="drTo">
              Open Until
            </label>
            <input
              id="drTo"
              type="datetime-local"
              className="field-input"
              value={form.openTo}
              onChange={setField('openTo')}
            />
          </div>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.showResultToCandidate}
            onChange={(event) => setForm({ ...form, showResultToCandidate: event.target.checked })}
          />
          <span>Show the score to candidates after submission</span>
        </label>
      </Modal>
    </div>
  );
}
