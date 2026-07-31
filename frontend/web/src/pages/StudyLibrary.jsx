import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import AiGenerateModal from '../components/AiGenerateModal.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  STUDY_CONTENT_TYPE_LABELS,
  STUDY_CONTENT_TYPE_OPTIONS
} from '../utils/constants.js';

// Study Library — a dedicated learning/practice content set, separate from the
// question bank. Everyone can browse & self-practice; managers generate/curate.
export default function StudyLibrary() {
  const { role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const canWrite = role === 'company_admin' || role === 'hr';

  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const list = useList('/study', {
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(typeFilter ? { contentType: typeFilter } : {}),
    ...(difficultyFilter ? { difficulty: difficultyFilter } : {})
  });

  useEffect(() => {
    api
      .get('/categories')
      .then((response) => setCategories(response.data.data.rows))
      .catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/study/${deleteTarget.id}`);
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
          <h2 className="page-title">Study Library</h2>
          <p className="page-subtitle">
            Learning &amp; practice material organised by category and content type — separate from
            the graded question bank.
          </p>
        </div>
        {canWrite && (
          <span className="action-group">
            <Button
              variant="secondary"
              onClick={() => navigate('/app/study/new')}
              title="Write study material manually"
            >
              + Add Manually
            </Button>
            <Button
              variant="primary"
              onClick={() => setAiOpen(true)}
              title="Generate study material with AI"
            >
              ✨ Generate with AI
            </Button>
          </span>
        )}
      </div>

      {canWrite && (
        <AiGenerateModal
          open={aiOpen}
          mode="study"
          categories={categories}
          onClose={() => setAiOpen(false)}
          onDone={(result) => (result?.id ? navigate(`/app/study/${result.id}`) : list.load())}
        />
      )}

      <div className="filter-row">
        <select
          className="field-input filter-select"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.parentId ? `— ${category.name}` : category.name}
            </option>
          ))}
        </select>
        <select
          className="field-input filter-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="">All Content Types</option>
          {STUDY_CONTENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="field-input filter-select"
          value={difficultyFilter}
          onChange={(e) => {
            setDifficultyFilter(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="">All Difficulty Levels</option>
          {DIFFICULTY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'type', label: 'Content Type' },
          { key: 'category', label: 'Category' },
          { key: 'difficulty', label: 'Difficulty' },
          { key: 'questions', label: 'Practice Qs' },
          { key: 'actions', label: 'Actions', className: 'col-action' }
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">{row.title}</td>
            <td>{STUDY_CONTENT_TYPE_LABELS[row.contentType] || row.contentType}</td>
            <td className="cell-wrap">{row.category || '—'}</td>
            <td>{DIFFICULTY_LABELS[row.difficulty] || '—'}</td>
            <td>{row.questionCount || 0}</td>
            <td className="col-action">
              <span className="action-group">
                <button
                  type="button"
                  className="icon-btn"
                  data-tooltip="Open"
                  aria-label={`Open ${row.title}`}
                  onClick={() => navigate(`/app/study/${row.id}`)}
                >
                  ▶
                </button>
                {canWrite && (
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    data-tooltip="Delete"
                    aria-label={`Delete ${row.title}`}
                    onClick={() => setDeleteTarget(row)}
                  >
                    <TrashIcon />
                  </button>
                )}
              </span>
            </td>
          </tr>
        )}
      />

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Study Material"
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
        <p>Are you sure you want to delete "{deleteTarget?.title}"?</p>
      </Modal>
    </div>
  );
}
