import { useEffect, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import Button from '../../components/Button.jsx';
import TextField from '../../components/TextField.jsx';
import FeatureCheckboxGrid from '../../components/master/FeatureCheckboxGrid.jsx';
import CountryPriceRow from '../../components/master/CountryPriceRow.jsx';
import { api, apiError } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PLAN_FEATURE_OPTIONS } from '../../utils/constants.js';

let idCounter = 1;
const nextId = (prefix) => `${prefix}${Date.now().toString(36)}${idCounter++}`;

const EMPTY_FORM = {
  name: '',
  description: '',
  badge: '',
  priceMonthlyUsd: '0',
  priceYearlyUsd: '0',
  trialDays: '14',
  order: '0',
  maxEmployees: '-1',
  unlimitedEmployees: true,
  maxTests: '-1',
  unlimitedTests: true,
  active: true,
  features: [],
  countryPrices: []
};

// Add/Edit Plan — a compact popup (not a page): mirrors the reference
// "Create New Plan" modal (Name/Badge row, price row, Trial Period, a
// collapsible Country Pricing section, Limits, Features).
export default function MasterPlanEditor({ planId, onDone, onCancel }) {
  const toast = useToast();
  const isEdit = Boolean(planId);
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [countryPricingEnabled, setCountryPricingEnabled] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/master/plans/${planId}`)
      .then((r) => {
        const p = r.data.data;
        setPlan(p);
        setForm({
          name: p.name,
          description: p.description,
          badge: p.badge || '',
          priceMonthlyUsd: String(p.priceMonthlyUsd),
          priceYearlyUsd: String(p.priceYearlyUsd),
          trialDays: String(p.trialDays || 0),
          order: String(p.order),
          maxEmployees: String(p.limits.maxEmployees),
          unlimitedEmployees: p.limits.maxEmployees === -1,
          maxTests: String(p.limits.maxTests),
          unlimitedTests: p.limits.maxTests === -1,
          active: p.active,
          features: p.features,
          countryPrices: p.countryPrices.map((row) => ({ ...row, id: nextId('cp') }))
        });
        setCountryPricingEnabled(p.countryPrices.length > 0);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const addCountry = () =>
    setForm((current) => ({
      ...current,
      countryPrices: [
        ...current.countryPrices,
        {
          id: nextId('cp'),
          country: '',
          currency: '',
          symbol: '',
          priceMonthly: '0',
          priceYearly: '0'
        }
      ]
    }));
  const updateCountry = (id, next) =>
    setForm((current) => ({
      ...current,
      countryPrices: current.countryPrices.map((row) => (row.id === id ? next : row))
    }));
  const removeCountry = (id) =>
    setForm((current) => ({
      ...current,
      countryPrices: current.countryPrices.filter((row) => row.id !== id)
    }));

  const featureCatalogue = PLAN_FEATURE_OPTIONS;
  const allFeaturesChecked = featureCatalogue.every((f) => form.features.includes(f.value));
  const toggleAllFeatures = () =>
    setForm((current) => ({
      ...current,
      features: allFeaturesChecked ? [] : featureCatalogue.map((f) => f.value)
    }));

  const save = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      setErrors({ name: 'Plan Name must be at least 2 characters.' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        badge: form.badge.trim(),
        priceMonthlyUsd: Number(form.priceMonthlyUsd) || 0,
        priceYearlyUsd: Number(form.priceYearlyUsd) || 0,
        trialDays: Number(form.trialDays) || 0,
        order: Number(form.order) || 0,
        limits: {
          maxEmployees: form.unlimitedEmployees ? -1 : Number(form.maxEmployees) || 0,
          maxTests: form.unlimitedTests ? -1 : Number(form.maxTests) || 0
        },
        active: form.active,
        features: form.features,
        isCustom: plan?.isCustom || false,
        isDefault: plan?.isDefault || false,
        countryPrices: countryPricingEnabled
          ? form.countryPrices
              .filter((row) => row.country)
              .map(({ id, ...rest }) => ({
                ...rest,
                priceMonthly: Number(rest.priceMonthly) || 0,
                priceYearly: Number(rest.priceYearly) || 0
              }))
          : []
      };
      const response = isEdit
        ? await api.put(`/master/plans/${planId}`, payload)
        : await api.post('/master/plans', payload);
      toast.show(response.data.data.message, 'success');
      onDone();
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors || {});
      toast.show(parsed.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={isEdit ? `Edit Plan: ${plan?.name || ''}` : 'Create New Plan'}
      size="lg"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save Plan'}
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : (
        <>
          <div className="editor-two-col">
            <TextField
              label="Name"
              name="planName"
              value={form.name}
              onChange={setField('name')}
              error={errors.name}
              required
              maxLength={100}
            />
            <TextField
              label="Badge"
              name="planBadge"
              value={form.badge}
              onChange={setField('badge')}
              placeholder="e.g. Most Popular"
              maxLength={40}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="planDescription">
              Description
            </label>
            <textarea
              id="planDescription"
              className="field-input field-textarea"
              value={form.description}
              maxLength={500}
              onChange={setField('description')}
              placeholder="Best for growing teams…"
            />
          </div>

          <div className="editor-grid-compact">
            <div className="field">
              <label className="field-label">Currency</label>
              <input className="field-input" value="$ USD (default)" readOnly disabled />
            </div>
            <TextField
              label={plan?.isCustom ? 'Custom Monthly Price ($)' : 'Monthly Price ($)'}
              name="planMonthly"
              type="number"
              value={form.priceMonthlyUsd}
              onChange={setField('priceMonthlyUsd')}
              required
            />
            <TextField
              label={plan?.isCustom ? 'Custom Yearly Price ($)' : 'Yearly Price ($)'}
              name="planYearly"
              type="number"
              value={form.priceYearlyUsd}
              onChange={setField('priceYearlyUsd')}
              required
            />
            <TextField
              label="Sort Order"
              name="planOrder"
              type="number"
              value={form.order}
              onChange={setField('order')}
            />
          </div>

          <TextField
            label="Trial Period (days)"
            name="planTrialDays"
            type="number"
            value={form.trialDays}
            onChange={setField('trialDays')}
          />
          <p className="answer-hint">
            How many days of free trial new companies get when they sign up on this plan. Set to 0
            to disable the trial (subscription starts paid). Maximum 365.
          </p>

          <div className="plan-editor-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={countryPricingEnabled}
                onChange={(e) => setCountryPricingEnabled(e.target.checked)}
              />
              <span>Enable Country Pricing</span>
            </label>
            <p className="answer-hint">
              Optional. Same features everywhere — only the price/currency changes per country. The
              Default (USD) row above is the universal fallback for any country without its own
              entry.
            </p>
            {countryPricingEnabled ? (
              <>
                {form.countryPrices.map((row) => (
                  <CountryPriceRow
                    key={row.id}
                    row={row}
                    usedCountryCodes={form.countryPrices
                      .filter((r) => r.id !== row.id)
                      .map((r) => r.country)}
                    onChange={(next) => updateCountry(row.id, next)}
                    onRemove={() => removeCountry(row.id)}
                  />
                ))}
                <Button variant="secondary" onClick={addCountry}>
                  ＋ Add Country
                </Button>
              </>
            ) : (
              <p className="answer-hint plan-editor-disabled-hint">
                Disabled — using the Monthly / Yearly Price above for every country.
              </p>
            )}
          </div>

          <div className="plan-editor-section">
            <h4 className="preview-section-title">Plan Limits</h4>
            <div className="editor-two-col">
              <div className="field">
                <TextField
                  label="Max Employee/User Count"
                  name="planEmployees"
                  type="number"
                  value={form.maxEmployees}
                  disabled={form.unlimitedEmployees}
                  onChange={setField('maxEmployees')}
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.unlimitedEmployees}
                    onChange={(e) => setForm({ ...form, unlimitedEmployees: e.target.checked })}
                  />
                  <span>Unlimited Users</span>
                </label>
              </div>
              <div className="field">
                <TextField
                  label="Max Tests"
                  name="planTests"
                  type="number"
                  value={form.maxTests}
                  disabled={form.unlimitedTests}
                  onChange={setField('maxTests')}
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.unlimitedTests}
                    onChange={(e) => setForm({ ...form, unlimitedTests: e.target.checked })}
                  />
                  <span>Unlimited Tests</span>
                </label>
              </div>
            </div>
          </div>

          <div className="plan-editor-section">
            <div className="page-header-row">
              <h4 className="preview-section-title">Features</h4>
              {plan?.isCustom && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={allFeaturesChecked}
                    onChange={toggleAllFeatures}
                  />
                  <span>All Features</span>
                </label>
              )}
            </div>
            <FeatureCheckboxGrid
              catalogue={featureCatalogue}
              selected={form.features}
              onChange={(features) => setForm({ ...form, features })}
            />
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span>Active</span>
          </label>
        </>
      )}
    </Modal>
  );
}
