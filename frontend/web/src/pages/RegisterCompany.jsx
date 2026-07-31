import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PasswordField from '../components/PasswordField.jsx';
import TextField from '../components/TextField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { apiError } from '../api/client.js';
import {
  validateCompanyName,
  validateEmail,
  validateFullName,
  validatePassword
} from '../utils/validators.js';

export default function RegisterCompany() {
  const { registerCompany } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Referral attribution: /register?ref=<code> credits the referrer.
  const referralCode = searchParams.get('ref') || '';

  const [form, setForm] = useState({
    companyName: '',
    fullName: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {
      companyName: validateCompanyName(form.companyName),
      fullName: validateFullName(form.fullName),
      email: validateEmail(form.email),
      password: validatePassword(form.password)
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      await registerCompany({
        companyName: form.companyName.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        referralCode
      });
      toast.show('Company registered successfully.', 'success');
      navigate('/app');
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
        <h2 className="auth-title">Register Your Company</h2>
        <p className="auth-subtitle">
          Already have an account with another company? Use the same Email ID and Password — the new
          company will be added to your account and you can switch between them any time.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            label="Company Name"
            name="companyName"
            value={form.companyName}
            onChange={setField('companyName')}
            error={errors.companyName}
            required
            maxLength={100}
          />
          <TextField
            label="Full Name"
            name="fullName"
            value={form.fullName}
            onChange={setField('fullName')}
            error={errors.fullName}
            required
            maxLength={100}
            autoComplete="name"
          />
          <TextField
            label="Email ID"
            name="email"
            type="email"
            value={form.email}
            onChange={setField('email')}
            error={errors.email}
            required
            maxLength={254}
            autoComplete="email"
          />
          <PasswordField
            value={form.password}
            onChange={setField('password')}
            error={errors.password}
            required
            autoComplete="new-password"
          />

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => navigate('/log-in')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Registering…' : 'Register'}
            </Button>
          </div>
        </form>

        <p className="auth-footer">
          Already registered?{' '}
          <Link to="/log-in" className="text-link">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
