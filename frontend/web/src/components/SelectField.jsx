// Labelled select following the form standards (red asterisk, error below).
export default function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required = false,
  placeholder = 'Select'
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={name}>
        {label}
        {required && <span className="required-mark">*</span>}
      </label>
      <select
        id={name}
        name={name}
        className={`field-input${error ? ' field-input-error' : ''}`}
        value={value}
        onChange={onChange}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
