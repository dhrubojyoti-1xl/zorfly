import { COUNTRY_OPTIONS, COUNTRY_BY_CODE } from '../../utils/countries.js';

// One repeatable "Add Country" row. Currency/symbol are derived from the
// chosen country (not independently editable) so an admin can't mismatch
// e.g. India + USD by mistake.
export default function CountryPriceRow({ row, usedCountryCodes, onChange, onRemove }) {
  const setCountry = (country) => {
    const meta = COUNTRY_BY_CODE.get(country);
    onChange({ ...row, country, currency: meta?.currency || '', symbol: meta?.symbol || '' });
  };

  const availableOptions = COUNTRY_OPTIONS.filter(
    (option) => option.value === row.country || !usedCountryCodes.includes(option.value)
  );

  return (
    <div className="country-price-row">
      <div className="field">
        <label className="field-label" htmlFor={`cp-country-${row.id}`}>
          Country
        </label>
        <select
          id={`cp-country-${row.id}`}
          className="field-input"
          value={row.country}
          onChange={(event) => setCountry(event.target.value)}
        >
          <option value="">Select</option>
          {availableOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`cp-currency-${row.id}`}>
          Currency
        </label>
        <input
          id={`cp-currency-${row.id}`}
          className="field-input"
          value={row.currency}
          readOnly
          placeholder="—"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`cp-monthly-${row.id}`}>
          Monthly Price
        </label>
        <input
          id={`cp-monthly-${row.id}`}
          type="number"
          className="field-input"
          value={row.priceMonthly}
          onChange={(event) => onChange({ ...row, priceMonthly: event.target.value })}
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={`cp-yearly-${row.id}`}>
          Yearly Price
        </label>
        <input
          id={`cp-yearly-${row.id}`}
          type="number"
          className="field-input"
          value={row.priceYearly}
          onChange={(event) => onChange({ ...row, priceYearly: event.target.value })}
        />
      </div>
      <button
        type="button"
        className="icon-btn icon-btn-danger"
        data-tooltip="Remove country"
        aria-label="Remove this country price"
        onClick={onRemove}
      >
        ✕
      </button>
    </div>
  );
}
