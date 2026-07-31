import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { validatePassword } from '../utils/validators.js';

// Sets a new password using the token from the emailed link
// (/reset-password?token=…). On success, redirects to the login page.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const missingToken = !token;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    if (confirm !== password) nextErrors.confirm = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await api.post('/auth/reset-password', { token, newPassword: password });
      toast.show(response.data.data.message, 'success');
      navigate('/log-in');
    } catch (err) {
      const { message, errors: fieldErrors } = apiError(err);
      setErrors({ password: fieldErrors.newPassword || '', form: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">Zorfly</h1>
        <h2 className="auth-title">Reset Password</h2>

        {missingToken ? (
          <p className="auth-subtitle">
            This reset link is invalid or incomplete. Please request a new one from the Forgot
            Password page.
          </p>
        ) : (
          <>
            <p className="auth-subtitle">Choose a new password for your Zorfly account.</p>
            <form onSubmit={handleSubmit} noValidate>
              <TextField
                label="New Password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={errors.password}
                required
                maxLength={72}
                autoComplete="new-password"
              />
              <TextField
                label="Confirm New Password"
                name="confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                error={errors.confirm}
                required
                maxLength={72}
                autoComplete="new-password"
              />
              {errors.form && <p className="field-error">{errors.form}</p>}
              <Button type="submit" variant="primary" fullWidth disabled={submitting}>
                {submitting ? 'Resetting…' : 'Reset password'}
              </Button>
            </form>
          </>
        )}

        <p className="auth-footer">
          <Link to="/log-in" className="text-link">
            Back to Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
