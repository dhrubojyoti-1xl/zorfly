import { useCallback, useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { PLAN_FEATURE_LABELS } from '../utils/constants.js';

// Billing (TEN-05): current plan + usage, country-priced catalogue, coupons,
// referral link. Prices follow the QA standard: symbol + comma value, full
// word "Month".
const formatPrice = (symbol, value) => `${symbol}${Number(value).toLocaleString('en-IN')}`;

export default function Billing() {
  const { company } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [referral, setReferral] = useState(null);

  const [subscribeTarget, setSubscribeTarget] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const load = useCallback(() => {
    api
      .get('/billing')
      .then((r) => setData(r.data.data))
      .catch((error) => toast.show(apiError(error).message, 'error'));
    api
      .get('/billing/referral')
      .then((r) => setReferral(r.data.data))
      .catch(() => {});
  }, [toast]);

  useEffect(() => {
    load();
  }, [load, company?.id]);

  const openSubscribe = (plan) => {
    setCouponCode('');
    setCouponResult(null);
    setCouponError('');
    setSubscribeTarget(plan);
  };

  const checkCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const response = await api.get(`/billing/coupon/${couponCode.trim()}`, {
        params: { planId: subscribeTarget.id }
      });
      setCouponResult(response.data.data);
      setCouponError('');
      toast.show(response.data.data.message, 'success');
    } catch (error) {
      setCouponResult(null);
      setCouponError(apiError(error).message);
    }
  };

  const subscribe = async () => {
    setSubscribing(true);
    try {
      const response = await api.post('/billing/subscribe', {
        planId: subscribeTarget.id,
        couponCode: couponCode.trim() || ''
      });
      setSubscribeTarget(null);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      const parsed = apiError(error);
      setCouponError(parsed.errors?.couponCode || parsed.message);
    } finally {
      setSubscribing(false);
    }
  };

  const copyReferral = () => {
    const link = `${window.location.origin}/register?ref=${referral.code}`;
    navigator.clipboard.writeText(link).then(
      () => toast.show('Referral link copied successfully.', 'success'),
      () => toast.show('Unable to copy the link. Please copy it manually.', 'error')
    );
  };

  if (!data)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  const limitLabel = (limit) => (limit < 0 ? 'Unlimited' : limit);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Billing &amp; Plan</h2>
        <p className="page-subtitle">
          Compare limits and features across plans. Prices shown for your country ({data.country}).
        </p>
      </div>

      {data.currentPlan && (
        <div className="card">
          <h3 className="card-title">Current Plan: {data.currentPlan.name}</h3>
          <div className="stat-grid">
            <div className="stat-card stat-card-muted">
              <span className="stat-value">
                {data.usage.employees}/{limitLabel(data.currentPlan.limits.maxEmployees)}
              </span>
              <span className="stat-label">Employees Used</span>
            </div>
            <div className="stat-card stat-card-muted">
              <span className="stat-value">
                {data.usage.tests}/{limitLabel(data.currentPlan.limits.maxTests)}
              </span>
              <span className="stat-label">Tests Used</span>
            </div>
            <div className="stat-card stat-card-muted">
              <span className="stat-value">
                {formatPrice(data.currentPlan.symbol, data.currentPlan.priceMonthly)}
              </span>
              <span className="stat-label">Per Month</span>
            </div>
          </div>
        </div>
      )}

      <div className="material-grid">
        {data.plans.map((plan) => (
          <div
            key={plan.id}
            className={`card material-card${plan.isCurrent ? ' plan-current' : ''}`}
          >
            <div className="material-head">
              <h3 className="card-title">{plan.name}</h3>
              {plan.isCurrent && <span className="state-badge state-published">Current</span>}
              {!plan.isCurrent && plan.badge && (
                <span className="plan-badge plan-badge-inline">{plan.badge}</span>
              )}
            </div>
            <p className="plan-price">
              {formatPrice(plan.symbol, plan.priceMonthly)}
              <span className="plan-price-period"> / Month</span>
            </p>
            {plan.description && <p className="material-description">{plan.description}</p>}
            <ul className="review-list">
              <li>{limitLabel(plan.limits.maxEmployees)} employees</li>
              <li>{limitLabel(plan.limits.maxTests)} tests</li>
              {plan.features.map((key) => (
                <li key={key}>{PLAN_FEATURE_LABELS[key] || key}</li>
              ))}
            </ul>
            {!plan.isCurrent && (
              <Button variant="primary" onClick={() => openSubscribe(plan)}>
                Choose {plan.name}
              </Button>
            )}
          </div>
        ))}
      </div>

      {referral && (
        <div className="card">
          <h3 className="card-title">Referral Link</h3>
          <p className="material-description">
            Share your link — {referral.signups} company(ies) have signed up through it so far.
          </p>
          <div className="editor-row">
            <input
              type="text"
              className="field-input"
              readOnly
              value={`${window.location.origin}/register?ref=${referral.code}`}
            />
            <Button variant="secondary" onClick={copyReferral}>
              Copy Link
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(subscribeTarget)}
        title={`Subscribe: ${subscribeTarget?.name || ''}`}
        onClose={() => setSubscribeTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubscribeTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={subscribe} disabled={subscribing}>
              {subscribing ? 'Subscribing…' : 'Confirm Subscription'}
            </Button>
          </>
        }
      >
        {subscribeTarget && (
          <>
            <p>
              Are you sure you want to subscribe Company {company?.name} to the{' '}
              {subscribeTarget.name} plan at{' '}
              <strong>
                {couponResult
                  ? formatPrice(couponResult.symbol, couponResult.discounted)
                  : formatPrice(subscribeTarget.symbol, subscribeTarget.priceMonthly)}
                /Month
              </strong>
              {couponResult && (
                <span className="question-pick-meta">
                  {' '}
                  (was {formatPrice(couponResult.symbol, couponResult.original)})
                </span>
              )}
              ?
            </p>
            <div className="editor-row">
              <TextField
                label="Coupon Code"
                name="couponCode"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                error={couponError}
                maxLength={30}
                placeholder="Enter Coupon Code"
              />
              <Button variant="secondary" onClick={checkCoupon}>
                Apply
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
