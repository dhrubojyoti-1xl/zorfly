import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PasswordField from '../components/PasswordField.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiError } from '../api/client.js';
import { validateEmail, validatePassword } from '../utils/validators.js';

const REMEMBER_KEY = 'zorfly_remember_email';

export default function LogIn() {
  const { logIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // "Remember Me": prefill the saved Email ID and keep the checkbox selected.
  const savedEmail = localStorage.getItem(REMEMBER_KEY) || '';
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(Boolean(savedEmail));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      password: validatePassword(password, { forLogin: true })
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    try {
      if (rememberMe) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);

      const result = await logIn({ email: email.trim(), password });
      if (result.requiresCompanySelection) {
        sessionStorage.setItem(
          'zorfly_company_selection',
          JSON.stringify({ preAuthToken: result.preAuthToken, companies: result.companies })
        );
        navigate('/select-company');
      } else {
        navigate('/app');
      }
    } catch (error) {
      const parsed = apiError(error);
      setErrors(parsed.errors);
      toast.show(parsed.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">Zorfly</h1>
        <h2 className="auth-title">Log In</h2>
        <p className="auth-subtitle">Welcome back. Enter your details to continue.</p>

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email ID"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            required
            maxLength={254}
            autoComplete="email"
          />
          <PasswordField
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            required
          />

          <div className="auth-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember Me</span>
            </label>
            <Link to="/forgot-password" className="text-link">
              Forgot Password
            </Link>
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? 'Logging In…' : 'Log In'}
          </Button>
        </form>

        <p className="auth-footer">
          New to Zorfly?{' '}
          <Link to="/register" className="text-link">
            Register your company
          </Link>
        </p>
      </div>
    </div>
  );
}
