import { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import Modal from '../../components/Modal.jsx';
import TextField from '../../components/TextField.jsx';
import DataTable from '../../components/DataTable.jsx';
import FeatureCheckboxGrid from '../../components/master/FeatureCheckboxGrid.jsx';
import { EditIcon } from '../../components/ActionIcons.jsx';
import { api, apiError } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useList } from '../../hooks/useList.js';
import { PLAN_FEATURE_OPTIONS } from '../../utils/constants.js';

const EMPTY_TERMS = {
  maxEmployees: '-1',
  unlimitedEmployees: true,
  maxTests: '-1',
  unlimitedTests: true,
  features: [],
  pricePaid: '0',
  currency: 'USD'
};

// Billing & revenue — revenue-by-plan summary plus the subscriptions list,
// filterable by plan. Subscriptions on the Custom plan get an extra "Edit
// Custom Terms" action (Plans Management module) to negotiate per-customer
// limits/features/price.
export default function MasterBilling() {
  const toast = useToast();
  const [planFilter, setPlanFilter] = useState('');
  const [plans, setPlans] = useState([]);
  const [revenueByPlan, setRevenueByPlan] = useState([]);
  const [termsTarget, setTermsTarget] = useState(null);
  const [termsForm, setTermsForm] = useState(EMPTY_TERMS);
  const [saving, setSaving] = useState(false);
  const list = useList('/master/billing', planFilter ? { planId: planFilter } : {});

  useEffect(() => {
    api
      .get('/master/billing', { params: { limit: 100 } })
      .then((r) => {
        setPlans(r.data.data.plans);
        setRevenueByPlan(r.data.data.revenueByPlan);
      })
      .catch((error) => toast.show(apiError(error).message, 'error'));
  }, [toast]);

  const openTerms = (row) => {
    setTermsForm(EMPTY_TERMS);
    setTermsTarget(row);
  };

  const saveTerms = async () => {
    setSaving(true);
    try {
      const response = await api.patch(`/master/subscriptions/${termsTarget.id}/custom-terms`, {
        customLimits: {
          maxEmployees: termsForm.unlimitedEmployees ? -1 : Number(termsForm.maxEmployees) || 0,
          maxTests: termsForm.unlimitedTests ? -1 : Number(termsForm.maxTests) || 0
        },
        customFeatures: termsForm.features,
        pricePaid: Number(termsForm.pricePaid) || 0,
        currency: termsForm.currency
      });
      toast.show(response.data.data.message, 'success');
      setTermsTarget(null);
      list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalInr = revenueByPlan.reduce((sum, p) => sum + p.inr, 0);
  const totalUsd = revenueByPlan.reduce((sum, p) => sum + p.usd, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Billing &amp; Revenue</h2>
        <p className="page-subtitle">
          Active subscriptions and recurring revenue across all tenants.
        </p>
      </div>

      <div className="master-stat-grid">
        <div className="master-stat master-stat-success">
          <span className="master-stat-icon" aria-hidden="true">
            💰
          </span>
          <span className="master-stat-value">₹{totalInr.toLocaleString('en-IN')}</span>
          <span className="master-stat-label">Monthly Revenue (INR)</span>
        </div>
        {totalUsd > 0 && (
          <div className="master-stat master-stat-success">
            <span className="master-stat-icon" aria-hidden="true">
              💵
            </span>
            <span className="master-stat-value">${totalUsd.toLocaleString('en-IN')}</span>
            <span className="master-stat-label">Monthly Revenue (USD)</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Revenue by Plan</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Subscriptions</th>
                <th>Monthly (INR)</th>
                <th>Monthly (USD)</th>
              </tr>
            </thead>
            <tbody>
              {revenueByPlan.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                revenueByPlan.map((p) => (
                  <tr key={p.name}>
                    <td className="cell-wrap">{p.name}</td>
                    <td>{p.count}</td>
                    <td>₹{p.inr.toLocaleString('en-IN')}</td>
                    <td>{p.usd > 0 ? `$${p.usd.toLocaleString('en-IN')}` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="filter-row">
        <select
          className="field-input filter-select"
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="">All Plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'company', label: 'Company' },
          { key: 'country', label: 'Country' },
          { key: 'plan', label: 'Plan' },
          { key: 'price', label: 'Price / Month' },
          { key: 'coupon', label: 'Coupon' },
          { key: 'since', label: 'Since' },
          { key: 'actions', label: 'Actions' }
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">{row.company}</td>
            <td>{row.country || '—'}</td>
            <td>{row.plan}</td>
            <td>
              {row.currency === 'USD' ? '$' : '₹'}
              {row.pricePaid.toLocaleString('en-IN')}
            </td>
            <td>{row.couponCode || '—'}</td>
            <td>{new Date(row.startedAt).toLocaleDateString('en-GB')}</td>
            <td>
              {row.planIsCustom && (
                <button
                  type="button"
                  className="icon-btn"
                  data-tooltip="Edit Custom Terms"
                  aria-label={`Edit Custom Terms for ${row.company}`}
                  onClick={() => openTerms(row)}
                >
                  <EditIcon />
                </button>
              )}
            </td>
          </tr>
        )}
      />

      <Modal
        open={Boolean(termsTarget)}
        title={`Custom Terms: ${termsTarget?.company || ''}`}
        onClose={() => setTermsTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTermsTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveTerms} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="editor-two-col">
          <TextField
            label="Price Paid"
            name="termsPrice"
            type="number"
            value={termsForm.pricePaid}
            onChange={(e) => setTermsForm({ ...termsForm, pricePaid: e.target.value })}
          />
          <TextField
            label="Currency"
            name="termsCurrency"
            value={termsForm.currency}
            onChange={(e) => setTermsForm({ ...termsForm, currency: e.target.value.toUpperCase() })}
            maxLength={3}
          />
        </div>
        <div className="editor-two-col">
          <div className="field">
            <TextField
              label="Max Employee/User Count"
              name="termsEmployees"
              type="number"
              value={termsForm.maxEmployees}
              disabled={termsForm.unlimitedEmployees}
              onChange={(e) => setTermsForm({ ...termsForm, maxEmployees: e.target.value })}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={termsForm.unlimitedEmployees}
                onChange={(e) =>
                  setTermsForm({ ...termsForm, unlimitedEmployees: e.target.checked })
                }
              />
              <span>Unlimited Users</span>
            </label>
          </div>
          <div className="field">
            <TextField
              label="Max Tests"
              name="termsTests"
              type="number"
              value={termsForm.maxTests}
              disabled={termsForm.unlimitedTests}
              onChange={(e) => setTermsForm({ ...termsForm, maxTests: e.target.value })}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={termsForm.unlimitedTests}
                onChange={(e) => setTermsForm({ ...termsForm, unlimitedTests: e.target.checked })}
              />
              <span>Unlimited Tests</span>
            </label>
          </div>
        </div>
        <p className="field-label">Features</p>
        <FeatureCheckboxGrid
          catalogue={PLAN_FEATURE_OPTIONS}
          selected={termsForm.features}
          onChange={(features) => setTermsForm({ ...termsForm, features })}
        />
      </Modal>
    </div>
  );
}
