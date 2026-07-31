import { EyeIcon, EditIcon } from '../ActionIcons.jsx';
import TrashIcon from '../TrashIcon.jsx';

const limitLabel = (limit) => (limit < 0 ? 'Unlimited' : limit);

// Grid View card — admin surface variant of the tenant-facing plan card in
// Billing.jsx (same .material-card/.plan-price classes for visual
// consistency), with Edit/Delete icon actions instead of a Subscribe CTA.
export default function PlanCard({
  plan,
  priceInterval,
  featureCount,
  onView,
  onEdit,
  onToggleActive,
  onDelete
}) {
  const price = priceInterval === 'yearly' ? plan.priceYearlyUsd : plan.priceMonthlyUsd;
  const period = priceInterval === 'yearly' ? '/ Year' : '/ Month';

  return (
    <div className={`card material-card plan-admin-card${plan.isDefault ? ' plan-current' : ''}`}>
      {plan.badge && <span className="plan-badge plan-badge-corner">{plan.badge}</span>}
      <div className="material-head">
        <h3 className="card-title">{plan.name}</h3>
        {plan.isDefault && <span className="state-badge state-published">Default</span>}
      </div>
      <p className="plan-price">
        ${price.toLocaleString('en-IN')}
        <span className="plan-price-period"> {period}</span>
      </p>
      {plan.description && <p className="material-description">{plan.description}</p>}
      <ul className="review-list">
        <li>{limitLabel(plan.limits.maxEmployees)} employees</li>
        <li>
          {featureCount.enabled} of {featureCount.total} features
        </li>
      </ul>
      <span className={`state-badge ${plan.active ? 'state-published' : ''}`}>
        {plan.active ? 'Active' : 'Inactive'}
      </span>
      <span className="action-group plan-admin-actions">
        <button
          type="button"
          className="icon-btn"
          data-tooltip="View"
          aria-label={`View ${plan.name}`}
          onClick={() => onView(plan)}
        >
          <EyeIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          data-tooltip="Edit"
          aria-label={`Edit ${plan.name}`}
          onClick={() => onEdit(plan)}
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className={`icon-btn${plan.active ? ' icon-btn-danger' : ' icon-btn-primary'}`}
          data-tooltip={plan.active ? 'Deactivate' : 'Activate'}
          aria-label={`${plan.active ? 'Deactivate' : 'Activate'} ${plan.name}`}
          onClick={() => onToggleActive(plan)}
        >
          {plan.active ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          data-tooltip={plan.isDefault ? 'The Default plan cannot be deleted' : 'Delete'}
          aria-label={`Delete ${plan.name}`}
          disabled={plan.isDefault}
          onClick={() => onDelete(plan)}
        >
          <TrashIcon />
        </button>
      </span>
    </div>
  );
}
