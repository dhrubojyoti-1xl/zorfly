import { useState } from 'react';

// Inline SVG eye icons so the icon state is always correct:
// password hidden → show the "view" icon; password visible → show the "hide" icon.
function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function PasswordField({
  label = 'Password',
  name = 'password',
  value,
  onChange,
  error,
  required = false,
  autoComplete = 'current-password'
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={name}>
        {label}
        {required && <span className="required-mark">*</span>}
      </label>
      <div className="password-wrap">
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          className={`field-input${error ? ' field-input-error' : ''}`}
          value={value}
          onChange={onChange}
          placeholder={`Enter ${label}`}
          maxLength={72}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide Password' : 'Show Password'}
          title={visible ? 'Hide Password' : 'Show Password'}
        >
          {visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
