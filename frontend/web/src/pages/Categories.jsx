import { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { EditIcon } from '../components/ActionIcons.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const ico = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
};
const ChevUp = () => (
  <svg {...ico}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);
const ChevDown = () => (
  <svg {...ico}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const PlusIcon = () => (
  <svg {...ico}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ArchiveIcon = () => (
  <svg {...ico}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </svg>
);

// Categories & Sub-categories (SRS Section 5, CAT-01). Company Admin can
// create, rename, archive and reorder categories and their sub-categories.
export default function Categories() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [addTopOpen, setAddTopOpen] = useState(false);
  const [addTopName, setAddTopName] = useState('');
  const [addSubFor, setAddSubFor] = useState(null);
  const [addSubName, setAddSubName] = useState('');
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [archiveTarget, setArchiveTarget] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get('/categories')
      .then((r) => setCategories(r.data.data.rows))
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bySort = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);
  const topLevel = categories.filter((c) => !c.parentId).sort(bySort);
  const childrenOf = (id) =>
    categories.filter((c) => String(c.parentId) === String(id)).sort(bySort);

  const create = async (name, parentId, siblingCount) => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const response = await api.post('/categories', {
        name: name.trim(),
        parentId: parentId || null,
        order: siblingCount
      });
      toast.show(response.data.data.message, 'success');
      setAddTopOpen(false);
      setAddTopName('');
      setAddSubFor(null);
      setAddSubName('');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const rename = async (id) => {
    if (!renameValue.trim()) return;
    setBusy(true);
    try {
      const response = await api.patch(`/categories/${id}`, { name: renameValue.trim() });
      toast.show(response.data.data.message, 'success');
      setRenameId(null);
      setRenameValue('');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!archiveTarget) return;
    setBusy(true);
    try {
      const response = await api.patch(`/categories/${archiveTarget.id}`, { status: 'archived' });
      toast.show(response.data.data.message, 'success');
      setArchiveTarget(null);
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Reorder within a sibling group by swapping explicit order values (indices).
  const move = async (cat, siblings, dir) => {
    const index = siblings.findIndex((s) => s.id === cat.id);
    const swap = dir === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= siblings.length) return;
    setBusy(true);
    try {
      await Promise.all([
        api.patch(`/categories/${cat.id}`, { order: swap }),
        api.patch(`/categories/${siblings[swap].id}`, { order: index })
      ]);
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
      setBusy(false);
    }
  };

  const startRename = (cat) => {
    setRenameId(cat.id);
    setRenameValue(cat.name);
  };

  const renderRow = (cat, siblings, index, isSub) => (
    <div key={cat.id} className={`cat-row${isSub ? ' cat-sub' : ''}`}>
      {renameId === cat.id ? (
        <div className="cat-rename">
          <input
            className="field-input"
            value={renameValue}
            maxLength={100}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename(cat.id);
              if (e.key === 'Escape') setRenameId(null);
            }}
          />
          <Button
            variant="primary"
            onClick={() => rename(cat.id)}
            disabled={busy || !renameValue.trim()}
          >
            Save
          </Button>
          <Button variant="secondary" onClick={() => setRenameId(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <>
          <span className="cat-name">{cat.name}</span>
          <span className="cat-actions">
            <button
              type="button"
              className="icon-btn"
              data-tooltip="Move up"
              aria-label="Move up"
              disabled={busy || index === 0}
              onClick={() => move(cat, siblings, 'up')}
            >
              <ChevUp />
            </button>
            <button
              type="button"
              className="icon-btn"
              data-tooltip="Move down"
              aria-label="Move down"
              disabled={busy || index === siblings.length - 1}
              onClick={() => move(cat, siblings, 'down')}
            >
              <ChevDown />
            </button>
            {!isSub && (
              <button
                type="button"
                className="icon-btn icon-btn-primary"
                data-tooltip="Add sub-category"
                aria-label="Add sub-category"
                onClick={() => {
                  setAddSubFor(cat.id);
                  setAddSubName('');
                }}
              >
                <PlusIcon />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              data-tooltip="Rename"
              aria-label={`Rename ${cat.name}`}
              onClick={() => startRename(cat)}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              data-tooltip="Archive"
              aria-label={`Archive ${cat.name}`}
              onClick={() => setArchiveTarget(cat)}
            >
              <ArchiveIcon />
            </button>
          </span>
        </>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Categories</h2>
          <p className="page-subtitle">
            Organise tests and questions by category and sub-category. Ships with seven ready-made
            templates.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setAddTopOpen(true);
            setAddTopName('');
          }}
        >
          Add Category
        </Button>
      </div>

      <div className="card">
        {addTopOpen && (
          <div className="cat-add">
            <input
              className="field-input"
              placeholder="New category name"
              value={addTopName}
              maxLength={100}
              autoFocus
              onChange={(e) => setAddTopName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create(addTopName, null, topLevel.length);
                if (e.key === 'Escape') setAddTopOpen(false);
              }}
            />
            <Button
              variant="primary"
              onClick={() => create(addTopName, null, topLevel.length)}
              disabled={busy || !addTopName.trim()}
            >
              Add
            </Button>
            <Button variant="secondary" onClick={() => setAddTopOpen(false)}>
              Cancel
            </Button>
          </div>
        )}

        {loading ? (
          <p className="answer-hint">Loading…</p>
        ) : topLevel.length === 0 ? (
          <p className="table-empty">No categories yet. Add your first one.</p>
        ) : (
          <div className="cat-tree">
            {topLevel.map((cat, i) => {
              const children = childrenOf(cat.id);
              return (
                <div key={cat.id} className="cat-group">
                  {renderRow(cat, topLevel, i, false)}
                  {(children.length > 0 || addSubFor === cat.id) && (
                    <div className="cat-children">
                      {children.map((sub, si) => renderRow(sub, children, si, true))}
                      {addSubFor === cat.id && (
                        <div className="cat-add cat-sub">
                          <input
                            className="field-input"
                            placeholder={`New sub-category of ${cat.name}`}
                            value={addSubName}
                            maxLength={100}
                            autoFocus
                            onChange={(e) => setAddSubName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') create(addSubName, cat.id, children.length);
                              if (e.key === 'Escape') setAddSubFor(null);
                            }}
                          />
                          <Button
                            variant="primary"
                            onClick={() => create(addSubName, cat.id, children.length)}
                            disabled={busy || !addSubName.trim()}
                          >
                            Add
                          </Button>
                          <Button variant="secondary" onClick={() => setAddSubFor(null)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(archiveTarget)}
        title="Archive Category"
        onClose={() => setArchiveTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={archive} disabled={busy}>
              {busy ? 'Archiving…' : 'Archive'}
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to archive the category {archiveTarget?.name}? It will be hidden
          from pickers. Existing tests and questions keep their category.
        </p>
      </Modal>
    </div>
  );
}
