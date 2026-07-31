import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, apiError } from '../api/client.js';
import { mediaUrl } from '../utils/media.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Company Admin: brand the workspace. The logo shown here also appears in the
// header of every email the company sends (it is NOT shown elsewhere in the
// app itself — the sidebar/header keep the Zorfly product wordmark).
//
// The logo file is only uploaded to the server, and only replaces/clears the
// saved branding, when "Save Branding" is clicked — picking a file just stages
// a local preview so nothing changes until the admin explicitly saves.
export default function CompanySettings() {
  const toast = useToast();
  const navigate = useNavigate();
  const { loadSession } = useAuth();
  const inputRef = useRef(null);
  const [company, setCompany] = useState(null);
  const [savedLogoUrl, setSavedLogoUrl] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const [removed, setRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/companies/current')
      .then((r) => {
        setCompany(r.data.data);
        setSavedLogoUrl(r.data.data.logoUrl || '');
      })
      .catch((error) => toast.show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  // Local preview for a picked-but-not-yet-uploaded file; revoke the blob URL
  // whenever it's replaced or the component unmounts.
  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview('');
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const pickFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setRemoved(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeLogo = () => {
    setPendingFile(null);
    setRemoved(true);
  };

  const hasCurrentLogo = Boolean(pendingFile || (savedLogoUrl && !removed));
  const previewSrc = pendingFile ? pendingPreview : !removed ? mediaUrl(savedLogoUrl) : '';
  const dirty = Boolean(pendingFile) || removed;

  const save = async () => {
    setSaving(true);
    try {
      let finalUrl = savedLogoUrl;
      if (pendingFile) {
        const form = new FormData();
        form.append('file', pendingFile);
        const uploadRes = await api.post('/media/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        finalUrl = uploadRes.data.data.url;
      } else if (removed) {
        finalUrl = '';
      }
      const response = await api.patch('/companies/branding', { logoUrl: finalUrl });
      setSavedLogoUrl(response.data.data.logoUrl || '');
      setPendingFile(null);
      setRemoved(false);
      toast.show(response.data.data.message, 'success');
      // Refresh the session so the new logo shows across the app immediately.
      await loadSession?.();
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Company Settings</h2>
        <p className="page-subtitle">
          Brand your workspace. Your logo also appears in the emails your company sends.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3 className="card-title">Branding</h3>
        {company && (
          <p className="answer-hint" style={{ marginBottom: '1rem' }}>
            {company.name} · <span className="question-pick-meta">{company.slug}</span>
          </p>
        )}

        <div className="field">
          <label className="field-label">Company Logo</label>
          <div className="upload-row">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              title="Upload Company Logo"
            >
              {hasCurrentLogo ? 'Replace File' : 'Upload File'}
            </button>
            {hasCurrentLogo && (
              <Button variant="secondary" onClick={removeLogo} disabled={saving}>
                Remove logo
              </Button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={pickFile}
              style={{ display: 'none' }}
            />
          </div>
          {previewSrc && <img src={previewSrc} alt="Company logo" className="upload-preview" />}
        </div>

        <p className="answer-hint">
          Recommended: a wide PNG with a transparent background, up to 10&nbsp;MB.
        </p>
        <p className="answer-hint">
          {dirty
            ? 'You have unsaved changes — click Save Branding to apply them.'
            : 'Changes only take effect once you save.'}
        </p>
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Branding'}
          </Button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3 className="card-title">Reporting Emails</h3>
        <p className="answer-hint">
          Choose extra recipients for the scheduled report summary, and set how often it's sent.
        </p>
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <Button variant="secondary" onClick={() => navigate('/app/reporting-settings')}>
            Manage Reporting Emails
          </Button>
        </div>
      </div>
    </div>
  );
}
