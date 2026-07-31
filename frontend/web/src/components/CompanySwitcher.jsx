import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiError } from '../api/client.js';

// Sidebar Company Switcher: shows the active company; the dropdown lists the
// user's other companies and switches the whole panel without re-login.
// The chevron rotates when the dropdown is open (team QA standard).
export default function CompanySwitcher() {
  const { company, companies, switchCompany } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!company) return null;

  const otherCompanies = companies.filter((item) => String(item.id) !== String(company.id));

  const handleSwitch = async (target) => {
    setSwitching(true);
    try {
      await switchCompany(target.id);
      setOpen(false);
      navigate('/app');
      toast.show(`Switched to ${target.name} successfully.`, 'success');
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="company-switcher" ref={wrapRef}>
      <button
        type="button"
        className="company-switcher-trigger"
        onClick={() => setOpen((current) => !current)}
        disabled={switching}
        title="Switch company"
        aria-expanded={open}
      >
        <span className="company-avatar" aria-hidden="true">
          {company.name.charAt(0).toUpperCase()}
        </span>
        <span className="company-switcher-name">{company.name}</span>
        <span className={`chevron${open ? ' chevron-open' : ''}`} aria-hidden="true">
          ▼
        </span>
      </button>

      {open && (
        <div className="company-switcher-menu">
          {otherCompanies.length === 0 ? (
            <p className="company-switcher-empty">No other companies linked to your account.</p>
          ) : (
            otherCompanies.map((item) => (
              <button
                key={item.id}
                type="button"
                className="company-switcher-item"
                onClick={() => handleSwitch(item)}
                disabled={switching}
                title={`Switch to ${item.name}`}
              >
                <span className="company-avatar" aria-hidden="true">
                  {item.name.charAt(0).toUpperCase()}
                </span>
                <span>{item.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
