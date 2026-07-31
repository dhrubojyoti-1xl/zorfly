// Renders a {key,label} catalogue as a responsive checkbox grid. Stateless —
// the parent owns the selected array and receives the full next array back.
export default function FeatureCheckboxGrid({ catalogue, selected, onChange, disabled = false }) {
  const toggle = (key) => {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };

  return (
    <div className="feature-checkbox-grid">
      {catalogue.map((feature) => (
        <label key={feature.value} className="checkbox-label">
          <input
            type="checkbox"
            checked={selected.includes(feature.value)}
            disabled={disabled}
            onChange={() => toggle(feature.value)}
          />
          <span>{feature.label}</span>
        </label>
      ))}
    </div>
  );
}
