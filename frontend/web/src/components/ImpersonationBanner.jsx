import { useNavigate } from 'react-router-dom';
import { api, setAccessToken } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Always-visible banner while a master admin is acting as another user.
// "Exit Impersonation" restores the master session instantly — no re-login.
export default function ImpersonationBanner() {
  const { loadSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const impersonating = sessionStorage.getItem('zorfly_impersonating');
  if (!impersonating) return null;

  const exitImpersonation = async () => {
    const masterToken = sessionStorage.getItem('zorfly_master_backup');
    sessionStorage.removeItem('zorfly_master_backup');
    sessionStorage.removeItem('zorfly_impersonating');
    if (masterToken) setAccessToken(masterToken);
    try {
      await api.post('/master/impersonate/exit');
    } catch {
      // Audit call is best-effort; the session swap already happened.
    }
    await loadSession();
    toast.show('Impersonation ended successfully.', 'success');
    navigate('/master');
  };

  return (
    <div className="impersonation-banner" role="alert">
      <span>
        You are impersonating <strong>{impersonating}</strong>. Actions are audited and deletions
        are disabled.
      </span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={exitImpersonation}>
        Exit Impersonation
      </button>
    </div>
  );
}
