import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import InlineQuestionModal from '../components/InlineQuestionModal.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  TYPE_LABELS
} from '../utils/constants.js';

const BANK_LIMIT = 20;

// Create/edit a test: fixed (hand-picked questions) or random paper (TST-03).
export default function TestForm() {
  const { id } = useParams();
  const isEdit = id && id !== 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [bank, setBank] = useState([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankPage, setBankPage] = useState(1);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankFilters, setBankFilters] = useState({
    search: '',
    categoryId: '',
    type: '',
    difficulty: ''
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // id -> {title,type,difficulty,marks}; lets us always show/remove the chosen
  // questions even when the current filter/page hides them.
  const [selectedMeta, setSelectedMeta] = useState({});
  const [inlineOpen, setInlineOpen] = useState(false);

  // A question created inline is auto-selected and shown in the bank list.
  const handleInlineCreated = (question) => {
    setForm((current) => ({ ...current, questionIds: [...current.questionIds, question.id] }));
    setSelectedMeta((meta) => ({ ...meta, [question.id]: question }));
    setBankPage(1);
    setBankFilters((f) => ({ ...f })); // trigger a refetch so it appears in the list
  };
  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    subCategoryId: '',
    difficulty: '',
    mode: 'fixed',
    questionIds: [],
    randomCount: '10',
    randomCategoryId: '',
    randomDifficulty: '',
    passingPercentage: '50',
    timeLimitMin: '30',
    timeLimitPerQuestionSec: '0',
    attemptsAllowed: '1',
    negativeMarking: false,
    shuffleQuestions: false,
    shuffleOptions: false,
    acFullScreen: false,
    acTabSwitch: false,
    acTabLimit: '3',
    acDisableCopyPaste: false,
    acWebcam: false
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    api
      .get('/categories')
      .then((r) => setCategories(r.data.data.rows))
      .catch(() => {});
  }, []);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(bankFilters.search.trim()), 300);
    return () => clearTimeout(timer);
  }, [bankFilters.search]);

  // Fetch the question bank filtered + paginated (only needed for fixed mode).
  useEffect(() => {
    if (form.mode !== 'fixed') return;
    const params = { page: bankPage, limit: BANK_LIMIT };
    if (debouncedSearch) params.search = debouncedSearch;
    if (bankFilters.categoryId) params.categoryId = bankFilters.categoryId;
    if (bankFilters.type) params.type = bankFilters.type;
    if (bankFilters.difficulty) params.difficulty = bankFilters.difficulty;
    setBankLoading(true);
    api
      .get('/questions', { params })
      .then((r) => {
        setBank(r.data.data.rows);
        setBankTotal(r.data.data.totalCount);
      })
      .catch(() => {})
      .finally(() => setBankLoading(false));
  }, [
    form.mode,
    debouncedSearch,
    bankFilters.categoryId,
    bankFilters.type,
    bankFilters.difficulty,
    bankPage
  ]);

  const setFilter = (key, value) => {
    setBankFilters((f) => ({ ...f, [key]: value }));
    setBankPage(1);
  };

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/tests/${id}`)
      .then((response) => {
        const test = response.data.data;
        setForm({
          title: test.title,
          description: test.description || '',
          categoryId: test.categoryId?._id || '',
          subCategoryId: test.subCategoryId?._id || test.subCategoryId || '',
          difficulty: test.difficulty || '',
          mode: test.mode,
          questionIds: (test.questionIds || []).map((question) => question._id),
          // (selectedMeta seeded below so chosen questions always render)
          randomCount: String(test.randomConfig?.count || 10),
          randomCategoryId: test.randomConfig?.categoryId || '',
          randomDifficulty: test.randomConfig?.difficulty || '',
          passingPercentage: String(test.settings.passingPercentage),
          timeLimitMin: String(test.settings.timeLimitMin),
          timeLimitPerQuestionSec: String(test.settings.timeLimitPerQuestionSec || 0),
          attemptsAllowed: String(test.settings.attemptsAllowed),
          negativeMarking: Boolean(test.settings.negativeMarking),
          shuffleQuestions: test.settings.shuffleQuestions,
          shuffleOptions: test.settings.shuffleOptions,
          acFullScreen: Boolean(test.settings.antiCheat?.fullScreen),
          acTabSwitch: Boolean(test.settings.antiCheat?.tabSwitchDetection),
          acTabLimit: String(test.settings.antiCheat?.tabSwitchLimit || 3),
          acDisableCopyPaste: Boolean(test.settings.antiCheat?.disableCopyPaste),
          acWebcam: Boolean(test.settings.antiCheat?.webcamCapture)
        });
        const meta = {};
        (test.questionIds || []).forEach((q) => {
          meta[q._id] = { title: q.title, type: q.type, difficulty: q.difficulty, marks: q.marks };
        });
        setSelectedMeta(meta);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [id, isEdit, toast]);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const toggleQuestion = (question) => {
    setForm((current) => ({
      ...current,
      questionIds: current.questionIds.includes(question.id)
        ? current.questionIds.filter((qid) => qid !== question.id)
        : [...current.questionIds, question.id]
    }));
    setSelectedMeta((meta) => ({
      ...meta,
      [question.id]: {
        title: question.title,
        type: question.type,
        difficulty: question.difficulty,
        marks: question.marks
      }
    }));
  };

  const removeSelected = (questionId) =>
    setForm((current) => ({
      ...current,
      questionIds: current.questionIds.filter((qid) => qid !== questionId)
    }));

  const handleSave = async () => {
    const nextErrors = {};
    if (!form.title.trim() || form.title.trim().length < 3)
      nextErrors.title = 'Test Title must be at least 3 characters.';
    if (form.mode === 'fixed' && form.questionIds.length === 0)
      nextErrors.questions = 'Select at least one question.';
    if (form.mode === 'random' && (!form.randomCount || Number(form.randomCount) < 1))
      nextErrors.randomCount = 'Number of questions is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId || null,
        subCategoryId: form.subCategoryId || null,
        difficulty: form.difficulty || null,
        mode: form.mode,
        questionIds: form.mode === 'fixed' ? form.questionIds : [],
        randomConfig:
          form.mode === 'random'
            ? {
                count: Number(form.randomCount),
                categoryId: form.randomCategoryId || null,
                difficulty: form.randomDifficulty || null
              }
            : null,
        settings: {
          passingPercentage: Number(form.passingPercentage) || 50,
          timeLimitMin: Number(form.timeLimitMin) || 0,
          timeLimitPerQuestionSec: Number(form.timeLimitPerQuestionSec) || 0,
          attemptsAllowed: Number(form.attemptsAllowed) || 1,
          negativeMarking: form.negativeMarking,
          shuffleQuestions: form.shuffleQuestions,
          shuffleOptions: form.shuffleOptions,
          antiCheat: {
            fullScreen: form.acFullScreen,
            tabSwitchDetection: form.acTabSwitch,
            tabSwitchLimit: Number(form.acTabLimit) || 3,
            disableCopyPaste: form.acDisableCopyPaste,
            webcamCapture: form.acWebcam
          }
        }
      };
      const response = isEdit
        ? await api.put(`/tests/${id}`, payload)
        : await api.post('/tests', payload);
      toast.show(response.data.data.message, 'success');
      navigate('/app/tests');
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors);
      toast.show(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">{isEdit ? 'Edit Test' : 'Create Test'}</h2>
        <p className="page-subtitle">Draft first, then publish and assign from the Tests page.</p>
      </div>

      <div className="card">
        <TextField
          label="Test Title"
          name="tTitle"
          value={form.title}
          onChange={setField('title')}
          error={errors.title}
          required
          maxLength={200}
        />
        <div className="field">
          <label className="field-label" htmlFor="tDescription">
            Description
          </label>
          <textarea
            id="tDescription"
            className="field-input field-textarea"
            placeholder="Enter Description"
            value={form.description}
            maxLength={2000}
            onChange={setField('description')}
          />
        </div>
        <div className="form-grid-3">
          <SelectField
            label="Category"
            name="tCategory"
            value={form.categoryId}
            onChange={(event) =>
              setForm({ ...form, categoryId: event.target.value, subCategoryId: '' })
            }
            options={categories
              .filter((category) => !category.parentId)
              .map((category) => ({ value: category.id, label: category.name }))}
          />
          <SelectField
            label="Sub-category"
            name="tSubCategory"
            value={form.subCategoryId}
            onChange={setField('subCategoryId')}
            options={categories
              .filter((category) => String(category.parentId) === String(form.categoryId))
              .map((category) => ({ value: category.id, label: category.name }))}
          />
          <SelectField
            label="Difficulty"
            name="tDifficulty"
            value={form.difficulty}
            onChange={setField('difficulty')}
            options={DIFFICULTY_OPTIONS}
          />
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Questions</h3>
        <div className="editor-toggles">
          {[
            { value: 'fixed', label: 'Pick questions from the bank' },
            { value: 'random', label: 'Random paper (each attempt draws fresh questions)' }
          ].map((option) => (
            <label key={option.value} className="checkbox-label">
              <input
                type="radio"
                checked={form.mode === option.value}
                onChange={() => setForm({ ...form, mode: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        {form.mode === 'fixed' ? (
          <>
            {errors.questions && <p className="field-error">{errors.questions}</p>}

            <div className="page-header-row">
              <span className="answer-hint">
                Pick from the bank, or create a new question inline.
              </span>
              <Button variant="secondary" onClick={() => setInlineOpen(true)}>
                + New question
              </Button>
            </div>

            <InlineQuestionModal
              open={inlineOpen}
              categories={categories}
              onClose={() => setInlineOpen(false)}
              onCreated={handleInlineCreated}
            />

            <div className="filter-row">
              <input
                className="field-input filter-select"
                type="search"
                placeholder="Search questions"
                value={bankFilters.search}
                onChange={(event) => setFilter('search', event.target.value)}
              />
              <select
                className="field-input filter-select"
                value={bankFilters.categoryId}
                onChange={(event) => setFilter('categoryId', event.target.value)}
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
                value={bankFilters.type}
                onChange={(event) => setFilter('type', event.target.value)}
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
                value={bankFilters.difficulty}
                onChange={(event) => setFilter('difficulty', event.target.value)}
              >
                <option value="">All Difficulty Levels</option>
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <p className="answer-hint">
              {form.questionIds.length} selected · {bankTotal} match{bankTotal === 1 ? '' : 'es'}{' '}
              the current filter
            </p>

            {form.questionIds.length > 0 && (
              <div className="question-selected">
                <p className="field-label">Selected questions</p>
                <div className="question-selected-list">
                  {form.questionIds.map((qid) => (
                    <span key={qid} className="question-chip">
                      <span className="cell-wrap">{selectedMeta[qid]?.title || 'Question'}</span>
                      <button
                        type="button"
                        className="question-chip-x"
                        aria-label="Remove question"
                        onClick={() => removeSelected(qid)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="question-pick-list">
              {bankLoading ? (
                <p className="answer-hint">Loading…</p>
              ) : bank.length === 0 ? (
                <p className="answer-hint">
                  No questions match. Adjust the filters, or add questions to the bank first.
                </p>
              ) : (
                bank.map((question) => (
                  <label
                    key={question.id}
                    className={`answer-option${form.questionIds.includes(question.id) ? ' selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.questionIds.includes(question.id)}
                      onChange={() => toggleQuestion(question)}
                    />
                    <span className="cell-wrap">
                      {question.title}
                      <span className="question-pick-meta">
                        {' '}
                        — {TYPE_LABELS[question.type]} · {DIFFICULTY_LABELS[question.difficulty]} ·{' '}
                        {question.marks} marks
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>

            {bankTotal > BANK_LIMIT && (
              <div className="pager">
                <Button
                  variant="secondary"
                  onClick={() => setBankPage((page) => Math.max(1, page - 1))}
                  disabled={bankPage <= 1}
                >
                  Previous
                </Button>
                <span className="pager-info">
                  Page {bankPage} of {Math.ceil(bankTotal / BANK_LIMIT)}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setBankPage((page) => page + 1)}
                  disabled={bankPage >= Math.ceil(bankTotal / BANK_LIMIT)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="editor-two-col">
            <TextField
              label="Number of Questions"
              name="tRandomCount"
              type="number"
              value={form.randomCount}
              onChange={setField('randomCount')}
              error={errors.randomCount}
              required
            />
            <SelectField
              label="From Category"
              name="tRandomCategory"
              value={form.randomCategoryId}
              onChange={setField('randomCategoryId')}
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
              placeholder="Any category"
            />
            <SelectField
              label="Difficulty"
              name="tRandomDifficulty"
              value={form.randomDifficulty}
              onChange={setField('randomDifficulty')}
              options={DIFFICULTY_OPTIONS}
              placeholder="Any difficulty"
            />
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Settings</h3>
        <div className="editor-two-col">
          <TextField
            label="Passing Percentage"
            name="tPassing"
            type="number"
            value={form.passingPercentage}
            onChange={setField('passingPercentage')}
            placeholder="50"
          />
          <TextField
            label="Time Limit (minutes, 0 = no limit)"
            name="tTime"
            type="number"
            value={form.timeLimitMin}
            onChange={setField('timeLimitMin')}
            placeholder="30"
          />
          <TextField
            label="Per-question Time (seconds, 0 = off)"
            name="tTimeQ"
            type="number"
            value={form.timeLimitPerQuestionSec}
            onChange={setField('timeLimitPerQuestionSec')}
            placeholder="0"
          />
          <TextField
            label="Attempts Allowed"
            name="tAttempts"
            type="number"
            value={form.attemptsAllowed}
            onChange={setField('attemptsAllowed')}
            placeholder="1"
          />
        </div>
        <div className="editor-toggles">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.negativeMarking}
              onChange={(event) => setForm({ ...form, negativeMarking: event.target.checked })}
            />
            <span>Negative marking (deduct for wrong answers)</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.shuffleQuestions}
              onChange={(event) => setForm({ ...form, shuffleQuestions: event.target.checked })}
            />
            <span>Shuffle questions</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.shuffleOptions}
              onChange={(event) => setForm({ ...form, shuffleOptions: event.target.checked })}
            />
            <span>Shuffle options</span>
          </label>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">
          Anti-cheating{' '}
          <span className="question-pick-meta">(optional, enforced during the test)</span>
        </h3>
        <div className="editor-toggles">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.acFullScreen}
              onChange={(event) => setForm({ ...form, acFullScreen: event.target.checked })}
            />
            <span>Require full-screen mode</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.acTabSwitch}
              onChange={(event) => setForm({ ...form, acTabSwitch: event.target.checked })}
            />
            <span>Detect tab/window switching</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.acDisableCopyPaste}
              onChange={(event) => setForm({ ...form, acDisableCopyPaste: event.target.checked })}
            />
            <span>Disable copy &amp; paste</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.acWebcam}
              onChange={(event) => setForm({ ...form, acWebcam: event.target.checked })}
            />
            <span>Webcam photo capture at intervals</span>
          </label>
        </div>
        {form.acTabSwitch && (
          <div className="editor-two-col">
            <TextField
              label="Warnings before auto-submit"
              name="tTabLimit"
              type="number"
              value={form.acTabLimit}
              onChange={setField('acTabLimit')}
              placeholder="3"
            />
          </div>
        )}
      </div>

      <div className="form-actions">
        <Button variant="secondary" onClick={() => navigate('/app/tests')}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Save Draft'}
        </Button>
      </div>
    </div>
  );
}
