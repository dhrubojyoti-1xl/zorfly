import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import TextField from './TextField.jsx';
import SelectField from './SelectField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { DIFFICULTY_OPTIONS } from '../utils/constants.js';

// Create a NEW question without leaving the test builder (TST-01). Supports the
// quick text types (MCQ / True-False); richer/media types use the full Question
// Bank editor. On success `onCreated({ id, title, type, difficulty, marks })`
// fires so the builder can select it immediately.
export default function InlineQuestionModal({ open, categories = [], onClose, onCreated }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm());

  useEffect(() => {
    if (open) {
      setForm(defaultForm());
      setError('');
    }
  }, [open]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.parentId ? `— ${c.name}` : c.name
  }));

  const setOption = (i, value) =>
    set(
      'options',
      form.options.map((o, idx) => (idx === i ? value : o))
    );
  const addOption = () => form.options.length < 6 && set('options', [...form.options, '']);
  const removeOption = (i) => {
    if (form.options.length <= 2) return;
    const options = form.options.filter((_, idx) => idx !== i);
    setForm((f) => ({
      ...f,
      options,
      correctIndex: f.correctIndex >= options.length ? 0 : f.correctIndex
    }));
  };

  const save = async () => {
    if (form.title.trim().length < 3)
      return setError('Question Title must be at least 3 characters.');
    if (!form.categoryId) return setError('Please choose a category.');
    let content;
    if (form.type === 'mcq') {
      const opts = form.options.map((o) => o.trim());
      const kept = opts.map((text, idx) => ({ text, idx })).filter((o) => o.text);
      if (kept.length < 2) return setError('Add at least two options.');
      const newCorrect = kept.findIndex((o) => o.idx === form.correctIndex);
      content = {
        options: kept.map((o, i) => ({ id: `o${i + 1}`, text: o.text })),
        correctOptionIds: [`o${(newCorrect === -1 ? 0 : newCorrect) + 1}`],
        multiple: false,
        partialCredit: false
      };
    } else {
      content = { correctAnswer: form.correctAnswer };
    }
    setError('');
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        categoryId: form.categoryId,
        difficulty: form.difficulty,
        marks: Number(form.marks) || 1,
        explanation: form.explanation.trim(),
        content
      };
      const response = await api.post('/questions', payload);
      toast.show(response.data.data.message, 'success');
      onCreated?.({
        id: response.data.data.id,
        title: payload.title,
        type: payload.type,
        difficulty: payload.difficulty,
        marks: payload.marks
      });
      onClose?.();
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New Question"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Create & Add'}
          </Button>
        </>
      }
    >
      <SelectField
        label="Question Type"
        name="iqType"
        value={form.type}
        onChange={(e) => set('type', e.target.value)}
        options={[
          { value: 'mcq', label: 'Multiple Choice' },
          { value: 'true_false', label: 'True / False' }
        ]}
      />
      <TextField
        label="Question Title"
        name="iqTitle"
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        required
        maxLength={300}
        placeholder="Enter the question"
      />
      <div className="editor-two-col">
        <SelectField
          label="Category"
          name="iqCategory"
          value={form.categoryId}
          onChange={(e) => set('categoryId', e.target.value)}
          options={categoryOptions}
          required
          placeholder="Select a category"
        />
        <SelectField
          label="Difficulty"
          name="iqDifficulty"
          value={form.difficulty}
          onChange={(e) => set('difficulty', e.target.value)}
          options={DIFFICULTY_OPTIONS}
        />
        <TextField
          label="Marks"
          name="iqMarks"
          type="number"
          value={form.marks}
          onChange={(e) => set('marks', e.target.value)}
        />
      </div>

      {form.type === 'mcq' ? (
        <div className="field">
          <label className="field-label">Options (select the correct one)</label>
          {form.options.map((opt, i) => (
            <div key={i} className="repeat-inline">
              <input
                type="radio"
                name="iqCorrect"
                checked={form.correctIndex === i}
                onChange={() => set('correctIndex', i)}
                aria-label={`Mark option ${i + 1} correct`}
              />
              <input
                className="field-input"
                maxLength={500}
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              {form.options.length > 2 && (
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  data-tooltip="Remove"
                  aria-label="Remove option"
                  onClick={() => removeOption(i)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {form.options.length < 6 && (
            <Button variant="secondary" onClick={addOption}>
              + Add option
            </Button>
          )}
        </div>
      ) : (
        <div className="field">
          <label className="field-label">Correct answer</label>
          <div className="editor-toggles">
            <label className="checkbox-label">
              <input
                type="radio"
                name="iqTF"
                checked={form.correctAnswer === true}
                onChange={() => set('correctAnswer', true)}
              />
              <span>True</span>
            </label>
            <label className="checkbox-label">
              <input
                type="radio"
                name="iqTF"
                checked={form.correctAnswer === false}
                onChange={() => set('correctAnswer', false)}
              />
              <span>False</span>
            </label>
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="iqExplanation">
          Explanation (optional)
        </label>
        <textarea
          id="iqExplanation"
          className="field-input"
          rows={2}
          maxLength={5000}
          value={form.explanation}
          onChange={(e) => set('explanation', e.target.value)}
          placeholder="Why the answer is correct"
        />
      </div>

      {error && <p className="field-error">{error}</p>}
    </Modal>
  );
}

function defaultForm() {
  return {
    type: 'mcq',
    title: '',
    categoryId: '',
    difficulty: 'fresher',
    marks: '5',
    options: ['', ''],
    correctIndex: 0,
    correctAnswer: true,
    explanation: ''
  };
}
