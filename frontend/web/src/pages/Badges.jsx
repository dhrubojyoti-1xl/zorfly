import { useCallback, useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const RULE_LABELS = {
  tests_count: 'Complete N assessments',
  score_percent: 'Score at least N% on an assessment',
  perfect: 'Score 100% on an assessment',
  detection_percent: 'Detection rate of at least N%'
};

// Badge catalogue (RWD-01): everyone sees what is achievable; admin manages.
export default function Badges() {
  const { role } = useAuth();
  const toast = useToast();
  const isAdmin = role === 'company_admin';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: '🏅',
    ruleType: 'score_percent',
    threshold: '90',
    points: '10'
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get('/badges')
      .then((response) => setRows(response.data.data.rows))
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const handleCreate = async () => {
    const nextErrors = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      nextErrors.name = 'Badge Name must be at least 2 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      const response = await api.post('/badges', {
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon || '🏅',
        ruleType: form.ruleType,
        threshold: Number(form.threshold) || 0,
        points: Number(form.points) || 0
      });
      setAddOpen(false);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors);
      toast.show(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row) => {
    try {
      const response = await api.patch(`/badges/${row.id}/toggle`);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Badges</h2>
          <p className="page-subtitle">
            Automatically awarded when employees hit the rule. Points add to the leaderboard.
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="primary"
            onClick={() => {
              setForm({
                name: '',
                description: '',
                icon: '🏅',
                ruleType: 'score_percent',
                threshold: '90',
                points: '10'
              });
              setErrors({});
              setAddOpen(true);
            }}
          >
            Add Badge
          </Button>
        )}
      </div>

      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : (
        <div className="material-grid">
          {rows.map((badge) => (
            <div
              key={badge.id}
              className={`card material-card${badge.active ? '' : ' badge-inactive'}`}
            >
              <div className="material-head">
                <span className="material-icon" aria-hidden="true">
                  {badge.icon}
                </span>
                <span className={`state-badge ${badge.active ? 'state-published' : ''}`}>
                  {badge.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h3 className="card-title">{badge.name}</h3>
              <p className="material-description">{badge.description}</p>
              <p className="question-pick-meta">
                Rule: {RULE_LABELS[badge.ruleType]?.replace('N', badge.threshold) || badge.ruleType}{' '}
                · {badge.points} points
              </p>
              {isAdmin && (
                <Button variant="secondary" onClick={() => handleToggle(badge)}>
                  {badge.active ? 'Deactivate' : 'Activate'}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        title="Add Badge"
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
          label="Badge Name"
          name="bName"
          value={form.name}
          onChange={setField('name')}
          error={errors.name}
          required
          maxLength={100}
        />
        <TextField
          label="Description"
          name="bDescription"
          value={form.description}
          onChange={setField('description')}
          maxLength={500}
        />
        <TextField
          label="Icon (emoji)"
          name="bIcon"
          value={form.icon}
          onChange={setField('icon')}
          maxLength={8}
          placeholder="🏅"
        />
        <SelectField
          label="Rule"
          name="bRule"
          value={form.ruleType}
          onChange={setField('ruleType')}
          options={Object.entries(RULE_LABELS).map(([value, label]) => ({ value, label }))}
          required
        />
        {form.ruleType !== 'perfect' && (
          <TextField
            label="Threshold (N)"
            name="bThreshold"
            type="number"
            value={form.threshold}
            onChange={setField('threshold')}
            required
          />
        )}
        <TextField
          label="Points Awarded"
          name="bPoints"
          type="number"
          value={form.points}
          onChange={setField('points')}
          required
        />
      </Modal>
    </div>
  );
}
