import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import FileUpload from '../components/FileUpload.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import Modal from '../components/Modal.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';
import { mediaUrl } from '../utils/media.js';

const TYPE_ICONS = { article: '📄', video: '🎬', pdf: '📚', link: '🔗' };

// Assigned learning paths with live progress (TRN-04).
function MyPaths() {
  const toast = useToast();
  const navigate = useNavigate();
  const { company } = useAuth();
  const [paths, setPaths] = useState([]);
  const [materialsById, setMaterialsById] = useState(new Map());

  const load = useCallback(() => {
    api
      .get('/paths/mine')
      .then((r) => setPaths(r.data.data.rows))
      .catch(() => {});
    api
      .get('/learning', { params: { limit: 100 } })
      .then((r) => setMaterialsById(new Map(r.data.data.rows.map((m) => [m.id, m]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load, company?.id]);

  const completeMaterial = async (path, step) => {
    const material = materialsById.get(step.materialId);
    if (material) window.open(mediaUrl(material.url), '_blank', 'noopener');
    try {
      const response = await api.post(`/paths/${path.id}/steps/${step.index}/complete`);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  const startPractice = async (step) => {
    try {
      const response = await api.post('/attempts/practice/start', {
        categoryId: step.practice?.categoryId || null,
        difficulty: step.practice?.difficulty || null,
        count: step.practice?.count || 5
      });
      navigate(`/app/attempt/${response.data.data.id}`, { state: response.data.data });
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  if (paths.length === 0) return null;

  return (
    <div className="card">
      <h3 className="card-title">My Learning Paths</h3>
      {paths.map((path) => (
        <div key={path.id} className="path-block">
          <div className="path-head">
            <strong>{path.title}</strong>
            <span className="state-badge">
              {path.completedCount}/{path.totalSteps} steps
            </span>
          </div>
          {path.description && <p className="question-pick-meta">{path.description}</p>}
          <ol className="path-steps">
            {path.steps.map((step) => (
              <li key={step.index} className={`path-step${step.completed ? ' completed' : ''}`}>
                <span className="path-step-mark" aria-hidden="true">
                  {step.completed ? '✓' : step.index + 1}
                </span>
                <span className="path-step-title">{step.title}</span>
                {!step.completed && step.kind === 'material' && (
                  <Button variant="secondary" onClick={() => completeMaterial(path, step)}>
                    Open &amp; Complete
                  </Button>
                )}
                {!step.completed && step.kind === 'practice' && (
                  <Button variant="secondary" onClick={() => startPractice(step)}>
                    Start Practice
                  </Button>
                )}
                {!step.completed && step.kind === 'test' && (
                  <Button variant="secondary" onClick={() => navigate('/app/my-tests')}>
                    Go to My Tests
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

// Learning library (TRN-03): everyone browses; admin/HR manage.
export default function Learning() {
  const { role } = useAuth();
  const toast = useToast();
  const canWrite = role === 'company_admin' || role === 'hr';
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const list = useList('/learning', categoryFilter ? { categoryId: categoryFilter } : {});

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    type: 'link',
    url: ''
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get('/categories')
      .then((r) => setCategories(r.data.data.rows))
      .catch(() => {});
  }, []);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const openAdd = () => {
    setForm({ title: '', description: '', categoryId: '', type: 'link', url: '' });
    setErrors({});
    setAddOpen(true);
  };

  const handleCreate = async () => {
    const nextErrors = {};
    if (!form.title.trim() || form.title.trim().length < 2)
      nextErrors.title = 'Title must be at least 2 characters.';
    if (!form.url.trim()) nextErrors.url = 'Provide a link or upload a file.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      const response = await api.post('/learning', {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId || null,
        type: form.type,
        url: form.url.trim()
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/learning/${deleteTarget.id}`);
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
          <h2 className="page-title">Learning Library</h2>
          <p className="page-subtitle">Training material to sharpen your quality skills.</p>
        </div>
        {canWrite && (
          <Button variant="primary" onClick={openAdd}>
            Add Material
          </Button>
        )}
      </div>

      <MyPaths />

      <div className="filter-row">
        <div className="search-wrap">
          <input
            type="text"
            className="field-input search-input"
            placeholder="Search"
            value={list.search}
            maxLength={100}
            onChange={(event) => list.setSearch(event.target.value)}
          />
          {list.search && (
            <button
              type="button"
              className="search-clear"
              aria-label="Clear search"
              title="Clear search"
              onClick={() => list.setSearch('')}
            >
              ✕
            </button>
          )}
        </div>
        <select
          className="field-input filter-select"
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            list.setPage(1);
          }}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {list.loading ? (
        <p className="loading-text">Loading…</p>
      ) : list.rows.length === 0 ? (
        <div className="card">
          <p className="table-empty">No records found.</p>
        </div>
      ) : (
        <div className="material-grid">
          {list.rows.map((material) => (
            <div key={material.id} className="card material-card">
              <div className="material-head">
                <span className="material-icon" aria-hidden="true">
                  {TYPE_ICONS[material.type]}
                </span>
                {canWrite && (
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    data-tooltip="Delete"
                    aria-label={`Delete ${material.title}`}
                    onClick={() => setDeleteTarget(material)}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
              <h3 className="card-title">{material.title}</h3>
              {material.category && <span className="state-badge">{material.category}</span>}
              {material.description && (
                <p className="material-description">{material.description}</p>
              )}
              <a
                className="btn btn-secondary btn-sm"
                href={mediaUrl(material.url)}
                target="_blank"
                rel="noreferrer"
                title={`Open ${material.title}`}
              >
                Open Material
              </a>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        title="Add Material"
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
          label="Title"
          name="lmTitle"
          value={form.title}
          onChange={setField('title')}
          error={errors.title}
          required
          maxLength={200}
        />
        <div className="field">
          <label className="field-label" htmlFor="lmDescription">
            Description
          </label>
          <textarea
            id="lmDescription"
            className="field-input field-textarea"
            placeholder="Enter Description"
            value={form.description}
            maxLength={2000}
            onChange={setField('description')}
          />
        </div>
        <SelectField
          label="Category"
          name="lmCategory"
          value={form.categoryId}
          onChange={setField('categoryId')}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
        />
        <SelectField
          label="Type"
          name="lmType"
          value={form.type}
          onChange={setField('type')}
          options={[
            { value: 'link', label: 'Link' },
            { value: 'article', label: 'Article' },
            { value: 'video', label: 'Video' },
            { value: 'pdf', label: 'PDF' }
          ]}
          required
        />
        <div className="field">
          <label className="field-label" htmlFor="lmUrl">
            Link or File<span className="required-mark">*</span>
          </label>
          <input
            id="lmUrl"
            className={`field-input${errors.url ? ' field-input-error' : ''}`}
            placeholder="Enter Link"
            value={form.url}
            maxLength={1000}
            onChange={setField('url')}
          />
          <p className="answer-hint" style={{ margin: '0.5rem 0' }}>
            — or —
          </p>
          <FileUpload
            hideLabel
            label="File"
            accept={
              form.type === 'pdf'
                ? 'application/pdf'
                : form.type === 'video'
                  ? 'video/*'
                  : undefined
            }
            value={form.url}
            onChange={(url) => setForm((current) => ({ ...current, url }))}
          />
          {errors.url && <p className="field-error">{errors.url}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Material"
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
        <p>Are you sure you want to delete Material {deleteTarget?.title}?</p>
      </Modal>
    </div>
  );
}
