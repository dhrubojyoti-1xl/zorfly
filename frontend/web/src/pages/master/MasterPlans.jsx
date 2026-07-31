import { useCallback, useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import Modal from '../../components/Modal.jsx';
import PlanCard from '../../components/master/PlanCard.jsx';
import MasterPlanEditor from './MasterPlanEditor.jsx';
import { EyeIcon, EditIcon } from '../../components/ActionIcons.jsx';
import TrashIcon from '../../components/TrashIcon.jsx';
import { api, apiError } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { PLAN_FEATURE_LABELS, PLAN_FEATURE_OPTIONS } from '../../utils/constants.js';

const limitLabel = (limit) => (limit < 0 ? 'Unlimited' : limit);

function ListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  );
}

// Plans listing (List/Grid) — Plans Management module. Fetches once (a
// handful of rows, never paginated); Add/Edit opens as a compact popup
// (MasterPlanEditor), not a separate page.
export default function MasterPlans() {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('zorfly_plans_view') || 'list'
  );
  const [priceInterval, setPriceInterval] = useState('monthly');
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editorTarget, setEditorTarget] = useState(null); // null | 'new' | planId
  const [busy, setBusy] = useState(false);

  const openCreate = () => setEditorTarget('new');
  const openEdit = (planId) => setEditorTarget(planId);
  const closeEditor = () => setEditorTarget(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/master/plans')
      .then((r) => setPlans(r.data.data.rows))
      .finally(() => setLoading(false));
  }, []);
  const onEditorDone = () => {
    closeEditor();
    load();
  };

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    localStorage.setItem('zorfly_plans_view', viewMode);
  }, [viewMode]);

  const toggleActive = async (plan) => {
    try {
      const response = await api.patch(`/master/plans/${plan.id}/toggle`);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const response = await api.delete(`/master/plans/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const priceOf = (plan) =>
    priceInterval === 'yearly' ? plan.priceYearlyUsd : plan.priceMonthlyUsd;

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Plans</h2>
          <p className="page-subtitle">
            Configure pricing, limits, features and country-wise packages per plan.
          </p>
        </div>
        <span className="action-group">
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle-btn${priceInterval === 'monthly' ? ' active' : ''}`}
              onClick={() => setPriceInterval('monthly')}
            >
              Mo
            </button>
            <button
              type="button"
              className={`view-toggle-btn${priceInterval === 'yearly' ? ' active' : ''}`}
              onClick={() => setPriceInterval('yearly')}
            >
              Yr
            </button>
          </div>
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
              data-tooltip="List view"
              aria-label="List view"
              onClick={() => setViewMode('list')}
            >
              <ListIcon />
            </button>
            <button
              type="button"
              className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`}
              data-tooltip="Grid view"
              aria-label="Grid view"
              onClick={() => setViewMode('grid')}
            >
              <GridIcon />
            </button>
          </div>
          <Button variant="primary" onClick={openCreate}>
            Add Plan
          </Button>
        </span>
      </div>

      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="card">
          <p className="table-empty">No records found.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="material-grid">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              priceInterval={priceInterval}
              featureCount={{ enabled: plan.features.length, total: PLAN_FEATURE_OPTIONS.length }}
              onView={setViewTarget}
              onEdit={(p) => openEdit(p.id)}
              onToggleActive={toggleActive}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Plan Name</th>
                  <th>Price</th>
                  <th>Employee Limit</th>
                  <th>Status</th>
                  <th>Features</th>
                  <th>Created Date</th>
                  <th className="col-actions-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="cell-wrap">
                      {plan.name}
                      {plan.isDefault && <span className="state-badge"> Default</span>}
                      {plan.badge && (
                        <span className="plan-badge plan-badge-inline">{plan.badge}</span>
                      )}
                    </td>
                    <td>
                      ${priceOf(plan).toLocaleString('en-IN')}{' '}
                      {priceInterval === 'yearly' ? '/ Year' : '/ Month'}
                    </td>
                    <td>{limitLabel(plan.limits.maxEmployees)}</td>
                    <td>
                      <span className={`state-badge ${plan.active ? 'state-published' : ''}`}>
                        {plan.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {plan.features.length} of {PLAN_FEATURE_OPTIONS.length}
                    </td>
                    <td>{new Date(plan.createdAt).toLocaleDateString('en-GB')}</td>
                    <td className="col-actions-wide">
                      <span className="action-group">
                        <button
                          type="button"
                          className="icon-btn"
                          data-tooltip="View"
                          aria-label={`View ${plan.name}`}
                          onClick={() => setViewTarget(plan)}
                        >
                          <EyeIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          data-tooltip="Edit"
                          aria-label={`Edit ${plan.name}`}
                          onClick={() => openEdit(plan.id)}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          data-tooltip={
                            plan.isDefault ? 'The Default plan cannot be deleted' : 'Delete'
                          }
                          aria-label={`Delete ${plan.name}`}
                          disabled={plan.isDefault}
                          onClick={() => setDeleteTarget(plan)}
                        >
                          <TrashIcon />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(viewTarget)}
        title={`Plan: ${viewTarget?.name || ''}`}
        size="lg"
        onClose={() => setViewTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewTarget(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                openEdit(viewTarget.id);
                setViewTarget(null);
              }}
            >
              Edit
            </Button>
          </>
        }
      >
        {viewTarget && (
          <div>
            {viewTarget.description && (
              <p className="material-description">{viewTarget.description}</p>
            )}
            <div className="stat-grid">
              <div className="stat-card stat-card-muted">
                <span className="stat-value">
                  ${viewTarget.priceMonthlyUsd.toLocaleString('en-IN')}
                </span>
                <span className="stat-label">Per Month (USD)</span>
              </div>
              <div className="stat-card stat-card-muted">
                <span className="stat-value">
                  ${viewTarget.priceYearlyUsd.toLocaleString('en-IN')}
                </span>
                <span className="stat-label">Per Year (USD)</span>
              </div>
              <div className="stat-card stat-card-muted">
                <span className="stat-value">{limitLabel(viewTarget.limits.maxEmployees)}</span>
                <span className="stat-label">Employee Limit</span>
              </div>
              <div className="stat-card stat-card-muted">
                <span className="stat-value">
                  {viewTarget.trialDays > 0 ? `${viewTarget.trialDays} days` : 'None'}
                </span>
                <span className="stat-label">Trial Period</span>
              </div>
            </div>

            <h4 className="preview-section-title">Country Pricing</h4>
            {viewTarget.countryPrices.length === 0 ? (
              <p className="table-empty">
                No country-specific pricing — the USD default applies everywhere.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Country</th>
                      <th>Currency</th>
                      <th>Monthly</th>
                      <th>Yearly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewTarget.countryPrices.map((row) => (
                      <tr key={row.country}>
                        <td>{row.country}</td>
                        <td>{row.currency}</td>
                        <td>
                          {row.symbol}
                          {row.priceMonthly.toLocaleString('en-IN')}
                        </td>
                        <td>
                          {row.symbol}
                          {row.priceYearly.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h4 className="preview-section-title">Features</h4>
            {viewTarget.features.length === 0 ? (
              <p className="table-empty">No features enabled on this plan.</p>
            ) : (
              <p>
                {viewTarget.features.map((key) => (
                  <span key={key} className="badge-chip">
                    {PLAN_FEATURE_LABELS[key] || key}
                  </span>
                ))}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Plan"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete the {deleteTarget?.name} plan? This cannot be undone.</p>
      </Modal>

      {editorTarget && (
        <MasterPlanEditor
          planId={editorTarget === 'new' ? null : editorTarget}
          onDone={onEditorDone}
          onCancel={closeEditor}
        />
      )}
    </div>
  );
}
