// QA-compliant text input:
// - red asterisk with NO space before it for mandatory fields ("Name*")
// - placeholder consistent with the label ("Enter Email ID")
// - min/max character limits
// - field-specific error shown directly BELOW the field, ending with a full stop
export default function TextField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
  maxLength,
  autoComplete,
  inputMode,
  disabled = false
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={name}>
        {label}
        {required && <span className="required-mark">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className={`field-input${error ? ' field-input-error' : ''}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder || `Enter ${label}`}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
