import { useEffect, useState } from 'react';
import Button from '../../components/Button.jsx';
import ChangePasswordModal from '../../components/ChangePasswordModal.jsx';
import TextField from '../../components/TextField.jsx';
import { api, apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { validateContactNumber, validateFullName } from '../../utils/validators.js';

// Master admin settings — profile, password, Google SSO configuration and
// platform support details.
export default function MasterSettings() {
  const { user, loadSession } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({ fullName: '', contactNumber: '' });
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [google, setGoogle] = useState({ enabled: false, clientId: '' });
  const [support, setSupport] = useState({ email: '', phone: '', docsUrl: '' });
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [savingSupport, setSavingSupport] = useState(false);

  useEffect(() => {
    if (user)
      setProfile({ fullName: user.fullName || '', contactNumber: user.contactNumber || '' });
  }, [user]);

  useEffect(() => {
    api
      .get('/master/settings')
      .then((r) => {
        setGoogle(r.data.data.google);
        setSupport(r.data.data.support);
      })
      .catch(() => {});
  }, []);

  const saveProfile = async () => {
    const errors = {
      fullName: validateFullName(profile.fullName),
      contactNumber: profile.contactNumber ? validateContactNumber(profile.contactNumber) : ''
    };
    setProfileErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    setSavingProfile(true);
    try {
      const response = await api.patch('/auth/profile', {
        fullName: profile.fullName.trim(),
        contactNumber: profile.contactNumber.trim()
      });
      toast.show(response.data.data.message, 'success');
      await loadSession();
    } catch (error) {
      const parsed = apiError(error);
      setProfileErrors(parsed.errors);
      toast.show(parsed.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveGoogle = async () => {
    setSavingGoogle(true);
    try {
      const response = await api.patch('/master/settings', { google });
      toast.show(response.data.data.message, 'success');
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSavingGoogle(false);
    }
  };

  const saveSupport = async () => {
    setSavingSupport(true);
    try {
      const response = await api.patch('/master/settings', { support });
      toast.show(response.data.data.message, 'success');
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSavingSupport(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
        <p className="page-subtitle">Manage your profile, password and platform configuration.</p>
      </div>

      <div className="master-two-col">
        <div className="card">
          <h3 className="card-title">Profile</h3>
          <TextField
            label="Full Name"
            name="msName"
            value={profile.fullName}
            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
            error={profileErrors.fullName}
            required
            maxLength={100}
          />
          <div className="field">
            <label className="field-label" htmlFor="msEmail">
              Email ID
            </label>
            <input
              id="msEmail"
              type="email"
              className="field-input"
              value={user?.email || ''}
              readOnly
              disabled
            />
          </div>
          <TextField
            label="Contact Number"
            name="msContact"
            value={profile.contactNumber}
            onChange={(e) => setProfile({ ...profile, contactNumber: e.target.value })}
            error={profileErrors.contactNumber}
            maxLength={15}
            inputMode="numeric"
          />
          <Button variant="primary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>

        <div className="card">
          <h3 className="card-title">Security</h3>
          <p className="material-description">
            Keep your master admin account secure with a strong password.
          </p>
          <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
            Change Password
          </Button>
        </div>
      </div>

      <div className="master-two-col">
        <div className="card">
          <h3 className="card-title">Google Sign-In</h3>
          <p className="material-description">
            Configure Google SSO for tenant logins. Enter your OAuth client ID and enable it once
            the credentials are live.
          </p>
          <label className="checkbox-label" style={{ marginBottom: '0.8rem' }}>
            <input
              type="checkbox"
              checked={google.enabled}
              onChange={(e) => setGoogle({ ...google, enabled: e.target.checked })}
            />
            <span>Enable Google Sign-In</span>
          </label>
          <TextField
            label="Google Client ID"
            name="googleClientId"
            value={google.clientId}
            onChange={(e) => setGoogle({ ...google, clientId: e.target.value })}
            placeholder="xxxx.apps.googleusercontent.com"
            maxLength={200}
          />
          <Button variant="primary" onClick={saveGoogle} disabled={savingGoogle}>
            {savingGoogle ? 'Saving…' : 'Save Google Settings'}
          </Button>
        </div>

        <div className="card">
          <h3 className="card-title">Support Details</h3>
          <p className="material-description">Shown to tenants on the Help &amp; Support page.</p>
          <TextField
            label="Support Email ID"
            name="supEmail"
            value={support.email}
            onChange={(e) => setSupport({ ...support, email: e.target.value })}
            placeholder="support@zorfly.com"
            maxLength={200}
          />
          <TextField
            label="Support Contact Number"
            name="supPhone"
            value={support.phone}
            onChange={(e) => setSupport({ ...support, phone: e.target.value })}
            maxLength={30}
          />
          <TextField
            label="Documentation URL"
            name="supDocs"
            value={support.docsUrl}
            onChange={(e) => setSupport({ ...support, docsUrl: e.target.value })}
            placeholder="https://docs.zorfly.com"
            maxLength={500}
          />
          <Button variant="primary" onClick={saveSupport} disabled={savingSupport}>
            {savingSupport ? 'Saving…' : 'Save Support Details'}
          </Button>
        </div>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
