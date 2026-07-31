import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import AiGenerateModal from '../components/AiGenerateModal.jsx';
import { api, apiError } from '../api/client.js';
import { downloadCsv } from '../utils/download.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  TYPE_LABELS
} from '../utils/constants.js';

export default function Questions() {
  const { role } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const canWrite = role === 'company_admin' || role === 'hr';

  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const list = useList('/questions', {
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(difficultyFilter ? { difficulty: difficultyFilter } : {})
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const importInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    api
      .get('/categories')
      .then((response) => setCategories(response.data.data.rows))
      .catch(() => {});
  }, []);

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const csv = await file.text();
      const response = await api.post('/questions/import', { csv });
      const { created, errors: importErrors } = response.data.data;
      toast.show(response.data.data.message, 'success');
      if (importErrors.length > 0) {
        toast.show(`${importErrors.length} row(s) skipped: ${importErrors[0]}`, 'error');
      }
      if (created > 0) await list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/questions/${deleteTarget.id}`);
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
          <h2 className="page-title">Question Bank</h2>
          <p className="page-subtitle">
            Reusable questions for tests and practice, organised by category and difficulty.
          </p>
        </div>
        <span className="action-group">
          {canWrite && (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsv('/questions/import/template', 'zorfly-question-template.csv')
                }
                title="Download the CSV import template"
              >
                Template
              </Button>
              <Button
                variant="secondary"
                onClick={() => importInputRef.current?.click()}
                disabled={importing}
                title="Import questions from CSV"
              >
                {importing ? 'Importing…' : 'Import CSV'}
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </>
          )}
          <Button
            variant="secondary"
            onClick={() => downloadCsv('/questions/export/csv', 'zorfly-questions.csv')}
            title="Export questions to CSV"
          >
            Export CSV
          </Button>
          {canWrite && (
            <Button
              variant="secondary"
              onClick={() => setAiOpen(true)}
              title="Generate questions with AI"
            >
              ✨ Generate with AI
            </Button>
          )}
          {canWrite && (
            <Button variant="primary" onClick={() => navigate('/app/questions/new')}>
              Add Question
            </Button>
          )}
        </span>
      </div>

      {canWrite && (
        <AiGenerateModal
          open={aiOpen}
          mode="questions"
          categories={categories}
          onClose={() => setAiOpen(false)}
          onDone={() => list.load()}
        />
      )}

      <div className="filter-row">
        <select
          className="field-input filter-select"
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value);
            list.setPage(1);
          }}
        >
          <option value="">All Types</option>
          {QUESTION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
        <select
          className="field-input filter-select"
          value={difficultyFilter}
          onChange={(event) => {
            setDifficultyFilter(event.target.value);
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
          { key: 'title', label: 'Question Title' },
          { key: 'type', label: 'Type' },
          { key: 'category', label: 'Category' },
          { key: 'difficulty', label: 'Difficulty' },
          { key: 'marks', label: 'Marks' },
          ...(canWrite ? [{ key: 'actions', label: 'Actions', className: 'col-action' }] : [])
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">{row.title}</td>
            <td>{TYPE_LABELS[row.type] || row.type}</td>
            <td className="cell-wrap">{row.category}</td>
            <td>{DIFFICULTY_LABELS[row.difficulty] || row.difficulty}</td>
            <td>{row.marks}</td>
            {canWrite && (
              <td className="col-action">
                <span className="action-group">
                  <button
                    type="button"
                    className="icon-btn"
                    data-tooltip="Edit"
                    aria-label={`Edit ${row.title}`}
                    onClick={() => navigate(`/app/questions/${row.id}`)}
                  >
                    ✎
                  </button>
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
            )}
          </tr>
        )}
      />

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Question"
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
        <p>Are you sure you want to delete Question {deleteTarget?.title}?</p>
      </Modal>
    </div>
  );
}
