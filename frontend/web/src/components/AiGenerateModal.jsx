import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import TextField from './TextField.jsx';
import SelectField from './SelectField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  AI_QUESTION_TYPE_OPTIONS,
  DIFFICULTY_OPTIONS,
  STUDY_CONTENT_TYPE_OPTIONS,
  TYPE_LABELS
} from '../utils/constants.js';

// Shared AI generation modal, driven by `mode`:
//   'questions' → generate drafts, preview, then save selected to the bank
//   'test'      → generate a full draft test (questions + test)
//   'study'     → generate a Study Library entry
// `categories` is the flat [{id,name,parentId}] list; `onDone(result)` fires on
// success so the host page can refresh or navigate.
export default function AiGenerateModal({ open, mode, categories = [], onClose, onDone }) {
  const toast = useToast();
  const [status, setStatus] = useState(null); // { configured }
  const [form, setForm] = useState(defaultForm());
  const [phase, setPhase] = useState('form'); // 'form' | 'review'
  const [drafts, setDrafts] = useState([]);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const titles = {
    questions: 'Generate Questions with AI',
    test: 'Generate a Test with AI',
    study: 'Generate Study Material with AI'
  };

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.parentId ? `— ${c.name}` : c.name })),
    [categories]
  );

  useEffect(() => {
    if (!open) return;
    setForm(defaultForm());
    setPhase('form');
    setDrafts([]);
    setSelected({});
    setError('');
    api
      .get('/ai/status')
      .then((r) => setStatus(r.data.data))
      .catch(() => setStatus({ configured: false }));
  }, [open]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggleType = (value) =>
    setForm((f) => ({
      ...f,
      types: f.types.includes(value) ? f.types.filter((t) => t !== value) : [...f.types, value]
    }));

  const categoryRequired = mode === 'questions' || mode === 'test';

  const validate = () => {
    if (form.topic.trim().length < 3) return 'Please enter a topic (at least 3 characters).';
    if (categoryRequired && !form.categoryId) return 'Please choose a category.';
    if (categoryRequired && !form.difficulty) return 'Please choose a difficulty level.';
    if ((mode === 'questions' || mode === 'test') && form.types.length === 0)
      return 'Select at least one question type.';
    return '';
  };

  const handleGenerate = async () => {
    const v = validate();
    if (v) return setError(v);
    setError('');
    setBusy(true);
    try {
      if (mode === 'questions') {
        const res = await api.post('/ai/questions/generate', {
          topic: form.topic.trim(),
          types: form.types,
          count: Number(form.count) || 5,
          categoryId: form.categoryId,
          subCategoryId: form.subCategoryId || null,
          difficulty: form.difficulty,
          marks: Number(form.marks) || 1,
          instructions: form.instructions.trim() || undefined
        });
        const generated = res.data.data.drafts || [];
        if (generated.length === 0) {
          setError(
            'The AI did not return any valid questions. Try rephrasing the topic or another type.'
          );
        } else {
          setDrafts(generated);
          setSelected(Object.fromEntries(generated.map((_, i) => [i, true])));
          setPhase('review');
        }
      } else if (mode === 'test') {
        const res = await api.post('/ai/tests/generate', {
          topic: form.topic.trim(),
          types: form.types,
          questionCount: Number(form.count) || 10,
          categoryId: form.categoryId,
          subCategoryId: form.subCategoryId || null,
          difficulty: form.difficulty,
          marks: Number(form.marks) || 1,
          title: form.title.trim() || undefined,
          instructions: form.instructions.trim() || undefined
        });
        toast.show(res.data.data.message, 'success');
        onDone?.(res.data.data);
        onClose?.();
      } else {
        const res = await api.post('/ai/study/generate', {
          topic: form.topic.trim(),
          contentType: form.contentType,
          categoryId: form.categoryId || null,
          subCategoryId: form.subCategoryId || null,
          difficulty: form.difficulty || null,
          instructions: form.instructions.trim() || undefined
        });
        toast.show(res.data.data.message, 'success');
        onDone?.(res.data.data);
        onClose?.();
      }
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const chosen = drafts.filter((_, i) => selected[i]);
    if (chosen.length === 0) return setError('Select at least one question to add.');
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/ai/questions/save', { questions: chosen });
      toast.show(res.data.data.message, 'success');
      onDone?.(res.data.data);
      onClose?.();
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const notConfigured = status && !status.configured;

  const footer =
    phase === 'review' ? (
      <>
        <Button variant="secondary" onClick={() => setPhase('form')} disabled={busy}>
          Back
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={busy}>
          {busy ? 'Saving…' : `Add ${drafts.filter((_, i) => selected[i]).length} to bank`}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleGenerate} disabled={busy || notConfigured}>
          {busy ? 'Generating…' : 'Generate'}
        </Button>
      </>
    );

  return (
    <Modal open={open} title={titles[mode]} onClose={onClose} footer={footer}>
      {notConfigured ? (
        <div className="ai-notice">
          <p>
            <strong>AI is not configured yet.</strong>
          </p>
          <p>
            Add an <code>ANTHROPIC_API_KEY</code> value to the backend environment and restart the
            server to enable AI generation.
          </p>
        </div>
      ) : phase === 'review' ? (
        <div className="ai-review">
          <p className="page-subtitle">
            {drafts.length} question(s) generated. Uncheck any you don't want, then add them to the
            bank.
          </p>
          <ul className="ai-draft-list">
            {drafts.map((d, i) => (
              <li key={i} className="ai-draft-item">
                <label className="ai-draft-label">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[i])}
                    onChange={() => setSelected((s) => ({ ...s, [i]: !s[i] }))}
                  />
                  <span>
                    <span className="ai-draft-type">{TYPE_LABELS[d.type] || d.type}</span>
                    <span className="ai-draft-title">{d.title}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {error && <p className="field-error">{error}</p>}
        </div>
      ) : (
        <div className="ai-form">
          <div className="field">
            <label className="field-label" htmlFor="ai-topic">
              Topic / subject<span className="required-mark">*</span>
            </label>
            <textarea
              id="ai-topic"
              className="field-input"
              rows={3}
              maxLength={2000}
              placeholder="e.g. Email etiquette for customer support agents"
              value={form.topic}
              onChange={(e) => setField('topic', e.target.value)}
            />
          </div>

          {mode === 'study' && (
            <div className="field">
              <label className="field-label" htmlFor="ai-contentType">
                Content type
              </label>
              <select
                id="ai-contentType"
                className="field-input"
                value={form.contentType}
                onChange={(e) => setField('contentType', e.target.value)}
              >
                {STUDY_CONTENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(mode === 'questions' || mode === 'test') && (
            <div className="field">
              <label className="field-label">
                Question types<span className="required-mark">*</span>
              </label>
              <div className="ai-type-grid">
                {AI_QUESTION_TYPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="ai-type-chip">
                    <input
                      type="checkbox"
                      checked={form.types.includes(opt.value)}
                      onChange={() => toggleType(opt.value)}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="editor-two-col">
            <SelectField
              label="Category"
              name="ai-category"
              value={form.categoryId}
              onChange={(e) => setField('categoryId', e.target.value)}
              options={categoryOptions}
              required={categoryRequired}
              placeholder="Select a category"
            />
            <SelectField
              label="Difficulty"
              name="ai-difficulty"
              value={form.difficulty}
              onChange={(e) => setField('difficulty', e.target.value)}
              options={DIFFICULTY_OPTIONS}
              required={categoryRequired}
              placeholder="Select difficulty"
            />
          </div>

          {(mode === 'questions' || mode === 'test') && (
            <div className="editor-two-col">
              <TextField
                label={mode === 'test' ? 'Number of questions' : 'How many to generate'}
                name="ai-count"
                type="number"
                value={form.count}
                onChange={(e) => setField('count', e.target.value)}
              />
              <TextField
                label="Marks per question"
                name="ai-marks"
                type="number"
                value={form.marks}
                onChange={(e) => setField('marks', e.target.value)}
              />
            </div>
          )}

          {mode === 'test' && (
            <TextField
              label="Test title (optional)"
              name="ai-title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              maxLength={200}
              placeholder="Leave blank to auto-name"
            />
          )}

          <div className="field">
            <label className="field-label" htmlFor="ai-instructions">
              Extra instructions (optional)
            </label>
            <textarea
              id="ai-instructions"
              className="field-input"
              rows={2}
              maxLength={1000}
              placeholder="e.g. focus on real-world scenarios; keep language simple"
              value={form.instructions}
              onChange={(e) => setField('instructions', e.target.value)}
            />
          </div>

          {error && <p className="field-error">{error}</p>}
          {busy && (
            <p className="page-subtitle">Generating with AI — this can take up to a minute…</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function defaultForm() {
  return {
    topic: '',
    types: ['mcq', 'true_false'],
    count: 5,
    marks: 1,
    categoryId: '',
    subCategoryId: '',
    difficulty: '',
    contentType: 'study_guide',
    title: '',
    instructions: ''
  };
}
