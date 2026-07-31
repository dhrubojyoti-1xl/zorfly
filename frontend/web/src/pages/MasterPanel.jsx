import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AccentSwitcher from '../components/AccentSwitcher.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import FontSizeSwitcher from '../components/FontSizeSwitcher.jsx';
import Modal from '../components/Modal.jsx';
import SelectField from '../components/SelectField.jsx';
import SidebarPromo from '../components/SidebarPromo.jsx';
import TextField from '../components/TextField.jsx';
import ThemeSwitcher from '../components/ThemeSwitcher.jsx';

// Stroke icons for the master sidebar — matches the tenant sidebar iconography.
function MNavIcon({ name }) {
  const c = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };
  switch (name) {
    case 'dashboard':
      return (
        <svg {...c}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case 'companies':
      return (
        <svg {...c}>
          <rect x="4" y="3" width="11" height="18" rx="1.6" />
          <path d="M15 8h5v13h-5" />
          <path d="M7.5 7h4M7.5 11h4M7.5 15h4" />
        </svg>
      );
    case 'billing':
      return (
        <svg {...c}>
          <rect x="2.5" y="5" width="19" height="14" rx="2" />
          <path d="M2.5 9.5h19" />
          <path d="M6 15h4" />
        </svg>
      );
    case 'emails':
      return (
        <svg {...c}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M4 6.5l8 6 8-6" />
        </svg>
      );
    case 'plans':
      return (
        <svg {...c}>
          <path d="M12 3l8 4-8 4-8-4 8-4z" />
          <path d="M4 12l8 4 8-4" />
          <path d="M4 17l8 4 8-4" />
        </svg>
      );
    case 'coupons':
      return (
        <svg {...c}>
          <path d="M20 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2.5a2 2 0 0 1 0 3.9V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5a2 2 0 0 1 0-3.9z" />
          <path d="M14 4v16" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.72.62 1.65 1.65 0 0 0-1 1.51V22a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 20.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6h.09A1.65 1.65 0 0 0 9.6 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'help':
      return (
        <svg {...c}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
          <path d="M12 17h.01" />
        </svg>
      );
    default:
      return null;
  }
}

// Swap-arrows icon for the Companies table's "Change plan" action.
function ChangePlanIcon() {
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
      <path d="M4 7h13l-3-3" />
      <path d="M20 17H7l3 3" />
    </svg>
  );
}
import { api, apiError, setAccessToken, getAccessToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useList } from '../hooks/useList.js';
import { ROLE_LABELS } from '../utils/constants.js';
import { UsersIcon, SuspendIcon, ActivateIcon } from '../components/ActionIcons.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import MasterDashboard from './master/MasterDashboard.jsx';
import MasterBilling from './master/MasterBilling.jsx';
import MasterEmailLogs from './master/MasterEmailLogs.jsx';
import MasterSettings from './master/MasterSettings.jsx';
import MasterHelp from './master/MasterHelp.jsx';
import MasterPlans from './master/MasterPlans.jsx';

// Coupons management (TEN-05). Plans now live in their own MasterPlans page
// (see the section === 'plans' render below) with Add/Edit as a popup.
function CouponsPanel() {
  const toast = useToast();
  const [coupons, setCoupons] = useState([]);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'percent',
    value: '10',
    maxUses: '0'
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get('/master/coupons')
      .then((r) => setCoupons(r.data.data.rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveCoupon = async () => {
    if (!couponForm.code.trim() || couponForm.code.trim().length < 3)
      return setFormError('Coupon Code must be at least 3 characters.');
    setSaving(true);
    try {
      const response = await api.post('/master/coupons', {
        code: couponForm.code.trim(),
        type: couponForm.type,
        value: Number(couponForm.value) || 0,
        maxUses: Number(couponForm.maxUses) || 0
      });
      setCouponOpen(false);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      setFormError(apiError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (coupon) => {
    try {
      const response = await api.patch(`/master/coupons/${coupon.id}/toggle`);
      toast.show(response.data.data.message, 'success');
      load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  return (
    <>
      <div className="card">
        <div className="page-header-row">
          <h3 className="card-title">Coupons</h3>
          <Button
            variant="primary"
            onClick={() => {
              setFormError('');
              setCouponOpen(true);
            }}
          >
            Add Coupon
          </Button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Used</th>
                <th>Status</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>{coupon.code}</td>
                    <td>{coupon.type === 'percent' ? `${coupon.value}%` : `$${coupon.value}`}</td>
                    <td>
                      {coupon.usedCount}
                      {coupon.maxUses > 0 ? `/${coupon.maxUses}` : ''}
                    </td>
                    <td>
                      <span className={`state-badge ${coupon.active ? 'state-published' : ''}`}>
                        {coupon.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="col-action">
                      <Button variant="secondary" onClick={() => toggleCoupon(coupon)}>
                        {coupon.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={couponOpen}
        title="Add Coupon"
        onClose={() => setCouponOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCouponOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveCoupon} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <TextField
          label="Coupon Code"
          name="couponCode"
          value={couponForm.code}
          onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
          required
          maxLength={30}
        />
        <SelectField
          label="Type"
          name="couponType"
          value={couponForm.type}
          onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}
          options={[
            { value: 'percent', label: 'Percentage discount' },
            { value: 'fixed', label: 'Fixed amount off' }
          ]}
          required
        />
        <div className="editor-two-col">
          <TextField
            label="Value"
            name="couponValue"
            type="number"
            value={couponForm.value}
            onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })}
            required
          />
          <TextField
            label="Max Uses (0 = unlimited)"
            name="couponMax"
            type="number"
            value={couponForm.maxUses}
            onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
            required
          />
        </div>
        {formError && <p className="field-error">{formError}</p>}
      </Modal>
    </>
  );
}

// MASTER ADMIN PANEL (platform operator): tenant metadata + usage only —
// never tenant content. Impersonation is the support tool for seeing what a
// user sees, with a persistent banner and full audit trail.
export default function MasterPanel() {
  const { user, logOut, loadSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [usersModal, setUsersModal] = useState(null); // { companyName, rows }
  const [usersCompanyId, setUsersCompanyId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null); // company to toggle
  const [deleteTarget, setDeleteTarget] = useState(null); // company to permanently delete
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('dashboard'); // sidebar section
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyStatus, setCompanyStatus] = useState(''); // Companies filter
  const [changePlanTarget, setChangePlanTarget] = useState(null); // company to reassign
  const [changePlanSelection, setChangePlanSelection] = useState('');
  const [plansForChange, setPlansForChange] = useState([]);
  const [changePlanBusy, setChangePlanBusy] = useState(false);

  const list = useList('/master/companies', companyStatus ? { status: companyStatus } : {});

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'overview', label: 'Companies', icon: 'companies' },
    { key: 'billing', label: 'Billing & Revenue', icon: 'billing' },
    { key: 'emails', label: 'Email Logs', icon: 'emails' },
    { key: 'plans', label: 'Plans', icon: 'plans' },
    { key: 'coupons', label: 'Coupons', icon: 'coupons' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
    { key: 'help', label: 'Help & Support', icon: 'help' }
  ];

  const loadOverview = useCallback(() => {
    api
      .get('/master/overview')
      .then((r) => setOverview(r.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const toggleMaintenance = async () => {
    try {
      const response = await api.patch('/master/maintenance');
      toast.show(response.data.data.message, 'success');
      loadOverview();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  const toggleCompanyStatus = async () => {
    if (!confirmTarget) return;
    setBusy(true);
    try {
      const response = await api.patch(`/master/companies/${confirmTarget.id}/status`);
      setConfirmTarget(null);
      toast.show(response.data.data.message, 'success');
      await list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteCompany = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const response = await api.delete(`/master/companies/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeleteConfirmText('');
      toast.show(response.data.data.message, 'success');
      await list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openUsers = async (company) => {
    try {
      const response = await api.get(`/master/companies/${company.id}/users`);
      setUsersCompanyId(company.id);
      setUsersModal(response.data.data);
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    }
  };

  const openChangePlan = async (row) => {
    setChangePlanTarget(row);
    setChangePlanSelection(row.planId || '');
    if (plansForChange.length === 0) {
      try {
        const response = await api.get('/master/plans');
        setPlansForChange(response.data.data.rows.filter((plan) => plan.active));
      } catch (error) {
        toast.show(apiError(error).message, 'error');
      }
    }
  };

  const submitChangePlan = async () => {
    if (!changePlanTarget || !changePlanSelection) return;
    setChangePlanBusy(true);
    try {
      const response = await api.patch(`/master/companies/${changePlanTarget.id}/plan`, {
        planId: changePlanSelection
      });
      toast.show(response.data.data.message, 'success');
      setChangePlanTarget(null);
      await list.load();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setChangePlanBusy(false);
    }
  };

  const impersonate = async (row) => {
    setBusy(true);
    try {
      const response = await api.post('/master/impersonate', {
        userId: row.userId,
        companyId: usersCompanyId
      });
      // Keep the master session so Exit Impersonation restores it instantly.
      sessionStorage.setItem('zorfly_master_backup', getAccessToken());
      sessionStorage.setItem('zorfly_impersonating', response.data.data.user.fullName);
      setAccessToken(response.data.data.accessToken);
      await loadSession();
      toast.show(response.data.data.message, 'success');
      navigate('/app');
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLogOut = async () => {
    await logOut();
    navigate('/log-in');
  };

  return (
    <div className="app-shell">
      <div className="app-body">
        <aside className={`app-sidebar sidebar-brand${sidebarOpen ? ' open' : ''}`}>
          {/* Same brand rail as the tenant app, so every panel matches */}
          <div className="side-brand">
            <span className="brand-mark" aria-hidden="true">
              Z
            </span>
            <span className="side-brand-text">
              <span className="side-brand-name">Zorfly</span>
              <span className="side-brand-tag">Master Admin</span>
            </span>
          </div>

          <nav className="side-nav">
            {NAV.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`side-link${section === item.key ? ' active' : ''}`}
                onClick={() => {
                  setSection(item.key);
                  setSidebarOpen(false);
                }}
              >
                <span className="side-link-ico">
                  <MNavIcon name={item.icon} />
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          <SidebarPromo
            text="Platform Health at a Glance"
            ctaLabel="View Dashboard"
            onClick={() => {
              setSection('dashboard');
              setSidebarOpen(false);
            }}
          />

          <div className="side-foot">
            <span className="side-foot-user" title={user?.email}>
              {user?.fullName}
            </span>
            <span className="side-foot-co">Platform Owner</span>
          </div>
        </aside>

        <div className="app-content">
          <header className="app-header">
            <div className="app-header-left">
              <button
                type="button"
                className="hamburger"
                aria-label="Toggle menu"
                title="Toggle menu"
                onClick={() => setSidebarOpen((current) => !current)}
              >
                ☰
              </button>
            </div>
            <div className="app-header-right">
              <ThemeSwitcher />
              <AccentSwitcher />
              <FontSizeSwitcher />
              <label className="checkbox-label" title="Maintenance mode blocks all tenant traffic">
                <input
                  type="checkbox"
                  checked={Boolean(overview?.maintenanceMode)}
                  onChange={toggleMaintenance}
                />
                <span>Maintenance Mode</span>
              </label>
              <div className="user-chip" title={user?.email}>
                <span className="user-chip-name">{user?.fullName}</span>
                <span className="user-chip-role">Master Admin</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleLogOut}
                title="Log Out"
              >
                Log Out
              </button>
            </div>
          </header>

          <main className="app-main" onClick={() => sidebarOpen && setSidebarOpen(false)}>
            {section === 'dashboard' && <MasterDashboard />}
            {section === 'billing' && <MasterBilling />}
            {section === 'emails' && <MasterEmailLogs />}
            {section === 'settings' && <MasterSettings />}
            {section === 'help' && <MasterHelp />}

            {section === 'overview' && (
              <div className="page">
                <div className="page-header">
                  <h2 className="page-title">Companies</h2>
                  <p className="page-subtitle">
                    Tenant metadata and usage only — company content stays private to each tenant.
                  </p>
                </div>

                <div className="filter-bar">
                  <select
                    className="field-input filter-select"
                    value={companyStatus}
                    onChange={(e) => {
                      setCompanyStatus(e.target.value);
                      list.setPage(1);
                    }}
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>

                <DataTable
                  columns={[
                    { key: 'name', label: 'Company Name' },
                    { key: 'slug', label: 'Company Code' },
                    { key: 'employees', label: 'Employees' },
                    { key: 'attempts', label: 'Tests Taken' },
                    { key: 'plan', label: 'Plan' },
                    { key: 'status', label: 'Status' },
                    { key: 'actions', label: 'Actions', className: 'col-actions-wide' }
                  ]}
                  {...list}
                  onSearch={list.setSearch}
                  onPage={list.setPage}
                  onLimit={list.setPageSize}
                  renderRow={(row, serial) => (
                    <tr key={`company-${row.id}`}>
                      <td className="col-serial">{serial}</td>
                      <td className="cell-wrap">{row.name}</td>
                      <td className="cell-wrap">{row.slug}</td>
                      <td>{row.employees}</td>
                      <td>{row.attempts}</td>
                      <td className="cell-wrap">{row.planName}</td>
                      <td>
                        <span
                          className={`state-badge ${row.status === 'active' ? 'state-published' : 'state-closed'}`}
                        >
                          {row.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="col-actions-wide">
                        <span className="action-group">
                          <button
                            type="button"
                            className="icon-btn"
                            data-tooltip="View users"
                            aria-label={`View users of ${row.name}`}
                            onClick={() => openUsers(row)}
                          >
                            <UsersIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            data-tooltip="Change plan"
                            aria-label={`Change plan for ${row.name}`}
                            onClick={() => openChangePlan(row)}
                          >
                            <ChangePlanIcon />
                          </button>
                          <button
                            type="button"
                            className={`icon-btn${row.status === 'active' ? ' icon-btn-danger' : ' icon-btn-primary'}`}
                            data-tooltip={row.status === 'active' ? 'Suspend' : 'Activate'}
                            aria-label={`${row.status === 'active' ? 'Suspend' : 'Activate'} ${row.name}`}
                            onClick={() => setConfirmTarget(row)}
                          >
                            {row.status === 'active' ? <SuspendIcon /> : <ActivateIcon />}
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            data-tooltip={
                              row.status === 'suspended'
                                ? 'Delete permanently'
                                : 'Suspend the company first to enable deletion'
                            }
                            aria-label={`Delete ${row.name} permanently`}
                            disabled={row.status !== 'suspended'}
                            onClick={() => {
                              setDeleteTarget(row);
                              setDeleteConfirmText('');
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </span>
                      </td>
                    </tr>
                  )}
                />
              </div>
            )}

            {section === 'plans' && <MasterPlans />}

            {section === 'coupons' && (
              <div className="page">
                <div className="page-header">
                  <h2 className="page-title">Coupons</h2>
                  <p className="page-subtitle">
                    Discount codes companies can apply at subscription.
                  </p>
                </div>
                <CouponsPanel />
              </div>
            )}
          </main>
        </div>
      </div>

      <Modal
        open={Boolean(usersModal)}
        title={`Users: ${usersModal?.companyName || ''}`}
        onClose={() => setUsersModal(null)}
        footer={
          <Button variant="secondary" onClick={() => setUsersModal(null)}>
            Close
          </Button>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email ID</th>
                <th>Role</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {(usersModal?.rows || []).map((row) => (
                <tr key={row.userId}>
                  <td className="cell-wrap">{row.fullName}</td>
                  <td className="cell-wrap">{row.email}</td>
                  <td>{ROLE_LABELS[row.role] || row.role}</td>
                  <td className="col-action">
                    <Button
                      variant="secondary"
                      onClick={() => impersonate(row)}
                      disabled={busy}
                      title={`Impersonate ${row.fullName}`}
                    >
                      Impersonate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmTarget)}
        title={confirmTarget?.status === 'active' ? 'Suspend Company' : 'Activate Company'}
        onClose={() => setConfirmTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmTarget?.status === 'active' ? 'danger' : 'primary'}
              onClick={toggleCompanyStatus}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to {confirmTarget?.status === 'active' ? 'suspend' : 'activate'}{' '}
          Company {confirmTarget?.name}?
          {confirmTarget?.status === 'active' && ' Its users will no longer be able to log in.'}
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Company Permanently"
        onClose={() => {
          setDeleteTarget(null);
          setDeleteConfirmText('');
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={deleteCompany}
              disabled={busy || deleteConfirmText !== deleteTarget?.slug}
            >
              {busy ? 'Deleting…' : 'Delete Permanently'}
            </Button>
          </>
        }
      >
        <p>
          This permanently deletes <strong>{deleteTarget?.name}</strong> and every record it owns —
          departments, employees, question banks, tests, attempts, results, schedules, certificates,
          and more. This cannot be undone.
        </p>
        <p className="answer-hint">
          Type the Company Code <strong>{deleteTarget?.slug}</strong> to confirm.
        </p>
        <TextField
          label="Company Code"
          name="deleteConfirmText"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder={deleteTarget?.slug}
        />
      </Modal>

      <Modal
        open={Boolean(changePlanTarget)}
        title={`Change Plan: ${changePlanTarget?.name || ''}`}
        onClose={() => setChangePlanTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setChangePlanTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitChangePlan}
              disabled={changePlanBusy || !changePlanSelection}
            >
              {changePlanBusy ? 'Saving…' : 'Move to Plan'}
            </Button>
          </>
        }
      >
        <p className="answer-hint">
          Current plan: <strong>{changePlanTarget?.planName || 'No plan'}</strong>
        </p>
        <SelectField
          label="New Plan"
          name="changePlan"
          value={changePlanSelection}
          onChange={(e) => setChangePlanSelection(e.target.value)}
          options={plansForChange.map((plan) => ({ value: plan.id, label: plan.name }))}
          required
        />
      </Modal>
    </div>
  );
}
