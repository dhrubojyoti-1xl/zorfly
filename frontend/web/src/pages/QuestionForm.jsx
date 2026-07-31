import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import QuestionEditor, { EMPTY_CONTENT } from '../components/QuestionEditor.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { DIFFICULTY_OPTIONS, QUESTION_TYPE_OPTIONS } from '../utils/constants.js';

// Create/edit a question of any of the 8 types.
export default function QuestionForm() {
  const { id } = useParams();
  const isEdit = id && id !== 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '',
    type: '',
    categoryId: '',
    subCategoryId: '',
    difficulty: '',
    marks: '10',
    negativeMarks: '0',
    explanation: '',
    trainingLink: ''
  });
  const [content, setContent] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    api
      .get('/categories')
      .then((response) => setCategories(response.data.data.rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/questions/${id}`)
      .then((response) => {
        const question = response.data.data;
        setForm({
          title: question.title,
          type: question.type,
          categoryId: question.categoryId || '',
          subCategoryId: question.subCategoryId || '',
          difficulty: question.difficulty,
          marks: String(question.marks),
          negativeMarks: String(question.negativeMarks || 0),
          explanation: question.explanation || '',
          trainingLink: question.trainingLink || ''
        });
        setContent(question.content);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [id, isEdit, toast]);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const handleTypeChange = (event) => {
    const type = event.target.value;
    setForm((current) => ({ ...current, type }));
    setContent(type ? structuredClone(EMPTY_CONTENT[type]) : null);
  };

  const handleSave = async () => {
    const nextErrors = {};
    if (!form.title.trim() || form.title.trim().length < 3)
      nextErrors.title = 'Question Title must be at least 3 characters.';
    if (!form.type) nextErrors.type = 'Question Type is required.';
    if (!form.categoryId) nextErrors.categoryId = 'Category is required.';
    if (!form.difficulty) nextErrors.difficulty = 'Difficulty is required.';
    if (!form.marks || Number(form.marks) <= 0) nextErrors.marks = 'Marks are required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        categoryId: form.categoryId,
        subCategoryId: form.subCategoryId || null,
        difficulty: form.difficulty,
        marks: Number(form.marks),
        negativeMarks: Number(form.negativeMarks) || 0,
        explanation: form.explanation.trim(),
        trainingLink: form.trainingLink.trim(),
        content
      };
      const response = isEdit
        ? await api.put(`/questions/${id}`, payload)
        : await api.post('/questions', payload);
      toast.show(response.data.data.message, 'success');
      navigate('/app/questions');
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
        <h2 className="page-title">{isEdit ? 'Edit Question' : 'Add Question'}</h2>
        <p className="page-subtitle">
          The explanation is shown to employees after submission — it is how every test becomes a
          learning opportunity.
        </p>
      </div>

      <div className="card">
        <TextField
          label="Question Title"
          name="qTitle"
          value={form.title}
          onChange={setField('title')}
          error={errors.title}
          required
          maxLength={300}
        />
        <div className="editor-two-col">
          <SelectField
            label="Question Type"
            name="qType"
            value={form.type}
            onChange={handleTypeChange}
            options={QUESTION_TYPE_OPTIONS}
            error={errors.type}
            required
          />
          <SelectField
            label="Category"
            name="qCategory"
            value={form.categoryId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                categoryId: event.target.value,
                subCategoryId: ''
              }))
            }
            options={categories
              .filter((category) => !category.parentId)
              .map((category) => ({ value: category.id, label: category.name }))}
            error={errors.categoryId}
            required
          />
        </div>
        {categories.some((category) => String(category.parentId) === String(form.categoryId)) && (
          <div className="editor-two-col">
            <div />
            <SelectField
              label="Sub-category"
              name="qSubCategory"
              value={form.subCategoryId}
              onChange={setField('subCategoryId')}
              options={categories
                .filter((category) => String(category.parentId) === String(form.categoryId))
                .map((category) => ({ value: category.id, label: category.name }))}
            />
          </div>
        )}
        <div className="editor-two-col">
          <SelectField
            label="Difficulty"
            name="qDifficulty"
            value={form.difficulty}
            onChange={setField('difficulty')}
            options={DIFFICULTY_OPTIONS}
            error={errors.difficulty}
            required
          />
          <div className="editor-two-col">
            <TextField
              label="Marks"
              name="qMarks"
              type="number"
              value={form.marks}
              onChange={setField('marks')}
              error={errors.marks}
              required
            />
            <TextField
              label="Negative Marks"
              name="qNegative"
              type="number"
              value={form.negativeMarks}
              onChange={setField('negativeMarks')}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {form.type && content && (
        <div className="card">
          <h3 className="card-title">Question Content</h3>
          {errors.content && <p className="field-error">{errors.content}</p>}
          <QuestionEditor type={form.type} content={content} onChange={setContent} />
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Learning (shown after submission)</h3>
        <div className="field">
          <label className="field-label" htmlFor="qExplanation">
            Explanation of the Mistakes
          </label>
          <textarea
            id="qExplanation"
            className="field-input field-textarea"
            placeholder="Explain what was wrong and why"
            value={form.explanation}
            maxLength={5000}
            onChange={setField('explanation')}
          />
        </div>
        <TextField
          label="Training Material Link"
          name="qTraining"
          value={form.trainingLink}
          onChange={setField('trainingLink')}
          placeholder="Enter Training Material Link"
          maxLength={1000}
        />
      </div>

      <div className="form-actions">
        <Button variant="secondary" onClick={() => navigate('/app/questions')}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
