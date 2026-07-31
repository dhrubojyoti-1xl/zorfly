import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import TextField from '../components/TextField.jsx';
import SelectField from '../components/SelectField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { DIFFICULTY_OPTIONS, STUDY_CONTENT_TYPE_OPTIONS } from '../utils/constants.js';

// Manual authoring for a Study Library entry (Company Admin / HR). Mirrors the
// shape the AI generator produces so both feed the reader + practice the same way.
export default function StudyMaterialForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    categoryId: '',
    subCategoryId: '',
    difficulty: '',
    contentType: 'study_guide',
    overview: '',
    sections: [{ heading: '', body: '' }],
    keyPoints: [''],
    questions: []
  });

  useEffect(() => {
    api
      .get('/categories')
      .then((r) => setCategories(r.data.data.rows))
      .catch(() => {});
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const categoryOptions = categories
    .filter((c) => !c.parentId)
    .map((c) => ({ value: c.id, label: c.name }));
  const subCategoryOptions = categories
    .filter((c) => c.parentId && String(c.parentId) === String(form.categoryId))
    .map((c) => ({ value: c.id, label: c.name }));

  // --- dynamic section helpers ---
  const updateSection = (i, key, value) =>
    set(
      'sections',
      form.sections.map((s, idx) => (idx === i ? { ...s, [key]: value } : s))
    );
  const addSection = () => set('sections', [...form.sections, { heading: '', body: '' }]);
  const removeSection = (i) =>
    set(
      'sections',
      form.sections.filter((_, idx) => idx !== i)
    );

  // --- key points ---
  const updateKeyPoint = (i, value) =>
    set(
      'keyPoints',
      form.keyPoints.map((k, idx) => (idx === i ? value : k))
    );
  const addKeyPoint = () => set('keyPoints', [...form.keyPoints, '']);
  const removeKeyPoint = (i) =>
    set(
      'keyPoints',
      form.keyPoints.filter((_, idx) => idx !== i)
    );

  // --- practice questions ---
  const addQuestion = () =>
    set('questions', [
      ...form.questions,
      { prompt: '', options: ['', ''], correctIndex: 0, explanation: '' }
    ]);
  const removeQuestion = (i) =>
    set(
      'questions',
      form.questions.filter((_, idx) => idx !== i)
    );
  const updateQuestion = (i, key, value) =>
    set(
      'questions',
      form.questions.map((q, idx) => (idx === i ? { ...q, [key]: value } : q))
    );
  const updateOption = (qi, oi, value) =>
    set(
      'questions',
      form.questions.map((q, idx) =>
        idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q
      )
    );
  const addOption = (qi) =>
    set(
      'questions',
      form.questions.map((q, idx) =>
        idx === qi && q.options.length < 8 ? { ...q, options: [...q.options, ''] } : q
      )
    );
  const removeOption = (qi, oi) =>
    set(
      'questions',
      form.questions.map((q, idx) => {
        if (idx !== qi || q.options.length <= 2) return q;
        const options = q.options.filter((_, j) => j !== oi);
        const correctIndex = q.correctIndex >= options.length ? 0 : q.correctIndex;
        return { ...q, options, correctIndex };
      })
    );

  const buildPayload = () => {
    const sections = form.sections
      .map((s) => ({ heading: s.heading.trim(), body: s.body.trim() }))
      .filter((s) => s.heading || s.body);
    const keyPoints = form.keyPoints.map((k) => k.trim()).filter(Boolean);
    const questions = form.questions
      .map((q) => {
        // Track the correct option by identity so dropping blank options can't
        // silently move the answer key to a different option.
        const kept = q.options
          .map((text, idx) => ({ text: text.trim(), idx }))
          .filter((o) => o.text);
        const newCorrect = kept.findIndex((o) => o.idx === q.correctIndex);
        return {
          prompt: q.prompt.trim(),
          options: kept.map((o) => o.text),
          correctIndex: newCorrect === -1 ? 0 : newCorrect,
          explanation: q.explanation.trim()
        };
      })
      .filter((q) => q.prompt && q.options.length >= 2);
    return {
      title: form.title.trim(),
      categoryId: form.categoryId || null,
      subCategoryId: form.subCategoryId || null,
      difficulty: form.difficulty || null,
      contentType: form.contentType,
      body: { overview: form.overview.trim(), sections, keyPoints },
      questions
    };
  };

  const save = async () => {
    if (form.title.trim().length < 2) return setError('Title must be at least 2 characters.');
    setError('');
    setSaving(true);
    try {
      const response = await api.post('/study', buildPayload());
      toast.show(response.data.data.message, 'success');
      navigate(`/app/study/${response.data.data.id}`);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Add Study Material</h2>
          <p className="page-subtitle">
            Author learning &amp; practice content for the Study Library.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/app/study')}>
          Back to Library
        </Button>
      </div>

      <div className="card">
        <h3 className="card-title">Details</h3>
        <TextField
          label="Title"
          name="title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          required
          maxLength={200}
          placeholder="Enter a title"
        />
        <div className="editor-two-col">
          <SelectField
            label="Category"
            name="category"
            value={form.categoryId}
            onChange={(e) =>
              setForm((f) => ({ ...f, categoryId: e.target.value, subCategoryId: '' }))
            }
            options={categoryOptions}
            placeholder="Select a category"
          />
          {subCategoryOptions.length > 0 && (
            <SelectField
              label="Sub-category"
              name="subCategory"
              value={form.subCategoryId}
              onChange={(e) => set('subCategoryId', e.target.value)}
              options={subCategoryOptions}
              placeholder="Select a sub-category"
            />
          )}
          <SelectField
            label="Difficulty"
            name="difficulty"
            value={form.difficulty}
            onChange={(e) => set('difficulty', e.target.value)}
            options={DIFFICULTY_OPTIONS}
            placeholder="Any"
          />
          <div className="field">
            <label className="field-label" htmlFor="sf-contentType">
              Content type
            </label>
            <select
              id="sf-contentType"
              className="field-input"
              value={form.contentType}
              onChange={(e) => set('contentType', e.target.value)}
            >
              {STUDY_CONTENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="overview">
            Overview
          </label>
          <textarea
            id="overview"
            className="field-input"
            rows={3}
            maxLength={3000}
            value={form.overview}
            onChange={(e) => set('overview', e.target.value)}
            placeholder="A short introduction to this material."
          />
        </div>
      </div>

      <div className="card">
        <div className="page-header-row">
          <h3 className="card-title">Sections</h3>
          <Button variant="secondary" onClick={addSection}>
            + Add section
          </Button>
        </div>
        {form.sections.map((section, i) => (
          <div key={i} className="repeat-row">
            <div className="repeat-row-main">
              <TextField
                label={`Section ${i + 1} heading`}
                name={`sec-h-${i}`}
                value={section.heading}
                onChange={(e) => updateSection(i, 'heading', e.target.value)}
                maxLength={200}
                placeholder="Heading"
              />
              <div className="field">
                <label className="field-label" htmlFor={`sec-b-${i}`}>
                  Section {i + 1} body
                </label>
                <textarea
                  id={`sec-b-${i}`}
                  className="field-input"
                  rows={3}
                  maxLength={8000}
                  value={section.body}
                  onChange={(e) => updateSection(i, 'body', e.target.value)}
                  placeholder="Explanation…"
                />
              </div>
            </div>
            {form.sections.length > 1 && (
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                data-tooltip="Remove section"
                aria-label="Remove section"
                onClick={() => removeSection(i)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-header-row">
          <h3 className="card-title">Key Points</h3>
          <Button variant="secondary" onClick={addKeyPoint}>
            + Add key point
          </Button>
        </div>
        {form.keyPoints.map((point, i) => (
          <div key={i} className="repeat-inline">
            <input
              className="field-input"
              maxLength={500}
              value={point}
              onChange={(e) => updateKeyPoint(i, e.target.value)}
              placeholder={`Key point ${i + 1}`}
            />
            {form.keyPoints.length > 1 && (
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                data-tooltip="Remove"
                aria-label="Remove key point"
                onClick={() => removeKeyPoint(i)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="page-header-row">
          <h3 className="card-title">Practice Questions (optional)</h3>
          <Button variant="secondary" onClick={addQuestion}>
            + Add question
          </Button>
        </div>
        {form.questions.length === 0 && (
          <p className="page-subtitle">
            Add multiple-choice questions learners can self-test with.
          </p>
        )}
        {form.questions.map((q, qi) => (
          <div key={qi} className="repeat-question">
            <div className="page-header-row">
              <strong>Question {qi + 1}</strong>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                data-tooltip="Remove question"
                aria-label="Remove question"
                onClick={() => removeQuestion(qi)}
              >
                ✕
              </button>
            </div>
            <TextField
              label="Prompt"
              name={`q-${qi}`}
              value={q.prompt}
              onChange={(e) => updateQuestion(qi, 'prompt', e.target.value)}
              maxLength={500}
              placeholder="The question"
            />
            <label className="field-label">Options (select the correct one)</label>
            {q.options.map((opt, oi) => (
              <div key={oi} className="repeat-inline">
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={q.correctIndex === oi}
                  onChange={() => updateQuestion(qi, 'correctIndex', oi)}
                  aria-label={`Mark option ${oi + 1} correct`}
                />
                <input
                  className="field-input"
                  maxLength={300}
                  value={opt}
                  onChange={(e) => updateOption(qi, oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                />
                {q.options.length > 2 && (
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    data-tooltip="Remove option"
                    aria-label="Remove option"
                    onClick={() => removeOption(qi, oi)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {q.options.length < 8 && (
              <Button variant="secondary" onClick={() => addOption(qi)}>
                + Add option
              </Button>
            )}
            <TextField
              label="Explanation (optional)"
              name={`q-exp-${qi}`}
              value={q.explanation}
              onChange={(e) => updateQuestion(qi, 'explanation', e.target.value)}
              maxLength={1000}
              placeholder="Why the answer is correct"
            />
          </div>
        ))}
      </div>

      {error && <p className="field-error">{error}</p>}
      <div className="action-group">
        <Button variant="secondary" onClick={() => navigate('/app/study')}>
          Cancel
        </Button>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Study Material'}
        </Button>
      </div>
    </div>
  );
}
