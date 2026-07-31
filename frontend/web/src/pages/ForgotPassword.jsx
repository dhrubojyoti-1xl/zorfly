import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import TextField from '../components/TextField.jsx';
import { api, apiError } from '../api/client.js';
import { validateEmail } from '../utils/validators.js';

// Requests a password-reset link. The server always responds the same way
// whether or not the email exists (no account enumeration), so this page shows
// a generic confirmation on success.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextError = validateEmail(email);
    setError(nextError);
    if (nextError) return;
    setSubmitting(true);
    try {
      const response = await api.post('/auth/forgot-password', { email: email.trim() });
      setMessage(response.data.data.message);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">Zorfly</h1>
        <h2 className="auth-title">Forgot Password</h2>

        {message ? (
          <>
            <p className="auth-subtitle">{message}</p>
            <p className="auth-subtitle" style={{ marginTop: '0.5rem' }}>
              Check your inbox for the reset link. It expires in 30 minutes.
            </p>
          </>
        ) : (
          <>
            <p className="auth-subtitle">
              Enter your Email ID and we will send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} noValidate>
              <TextField
                label="Email ID"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={error}
                required
                maxLength={254}
                autoComplete="email"
              />
              <Button type="submit" variant="primary" fullWidth disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
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
