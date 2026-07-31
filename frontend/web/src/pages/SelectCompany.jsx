import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiError } from '../api/client.js';

// Shown after login when the user's account is linked to two or more
// companies: they choose which company dashboard to enter first.
export default function SelectCompany() {
  const { selectCompany } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('zorfly_company_selection');
    if (!stored) {
      navigate('/log-in');
      return;
    }
    setPending(JSON.parse(stored));
  }, [navigate]);

  const roleLabels = {
    company_admin: 'Company Admin',
    hr: 'HR Team',
    team_leader: 'Team Leader',
    employee: 'Employee'
  };

  const handleSelect = async (companyId) => {
    if (!pending) return;
    setChoosing(true);
    try {
      await selectCompany({ preAuthToken: pending.preAuthToken, companyId });
      sessionStorage.removeItem('zorfly_company_selection');
      navigate('/app');
    } catch (error) {
      toast.show(apiError(error).message, 'error');
      setChoosing(false);
    }
  };

  if (!pending) return null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">Zorfly</h1>
        <h2 className="auth-title">Select Company</h2>
        <p className="auth-subtitle">
          Your account is linked to {pending.companies.length} companies. Choose which one to open.
          You can switch at any time from the sidebar.
        </p>

        <div className="company-select-list">
          {pending.companies.map((company) => (
            <button
              key={company.id}
              type="button"
              className="company-select-card"
              onClick={() => handleSelect(company.id)}
              disabled={choosing}
              title={`Open ${company.name}`}
            >
              <span className="company-avatar company-avatar-lg" aria-hidden="true">
                {company.name.charAt(0).toUpperCase()}
              </span>
              <span className="company-select-info">
                <span className="company-select-name">{company.name}</span>
                <span className="company-select-role">
                  {roleLabels[company.role] || company.role}
                </span>
              </span>
              <span className="company-select-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
