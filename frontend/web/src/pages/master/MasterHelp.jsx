import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

// Help & Support — contact details (from settings), documentation, quick
// answers and platform info for the operator.
const FAQS = [
  {
    q: 'How do I suspend a company?',
    a: 'Open the Companies section, find the company and click Suspend. Its users can no longer log in until you reactivate it.'
  },
  {
    q: 'How does impersonation work?',
    a: 'From a company’s Users list, click Impersonate. You see exactly what that user sees, with a banner and full audit trail; deletions and password changes are blocked while impersonating.'
  },
  {
    q: 'How is revenue calculated?',
    a: 'Monthly recurring revenue is the sum of what every active subscription actually pays after any coupon, split by currency.'
  },
  {
    q: 'What is maintenance mode?',
    a: 'Toggling it in the header blocks all tenant traffic with a friendly notice, while the login and master-admin routes stay reachable so you can switch it back off.'
  }
];

export default function MasterHelp() {
  const [support, setSupport] = useState({ email: 'support@zorfly.com', phone: '', docsUrl: '' });
  const [open, setOpen] = useState(0);

  useEffect(() => {
    api
      .get('/master/settings')
      .then((r) => setSupport(r.data.data.support))
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Help &amp; Support</h2>
        <p className="page-subtitle">Contact the Zorfly team and find quick answers.</p>
      </div>

      <div className="master-two-col">
        <div className="card">
          <h3 className="card-title">Contact Support</h3>
          <ul className="support-list">
            {support.email && (
              <li>
                <span aria-hidden="true">✉️</span>{' '}
                <a className="text-link" href={`mailto:${support.email}`}>
                  {support.email}
                </a>
              </li>
            )}
            {support.phone && (
              <li>
                <span aria-hidden="true">📞</span> {support.phone}
              </li>
            )}
            {support.docsUrl && (
              <li>
                <span aria-hidden="true">📚</span>{' '}
                <a className="text-link" href={support.docsUrl} target="_blank" rel="noreferrer">
                  Documentation
                </a>
              </li>
            )}
          </ul>
        </div>

        <div className="card">
          <h3 className="card-title">Platform Information</h3>
          <ul className="support-list">
            <li>
              <span aria-hidden="true">🏷️</span> Product: Zorfly — Quality Assessment &amp; Training
            </li>
            <li>
              <span aria-hidden="true">🔖</span> Version: 1.0
            </li>
            <li>
              <span aria-hidden="true">🔐</span> Role: Master Admin (Platform Operator)
            </li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Frequently Asked Questions</h3>
        <div className="faq-list">
          {FAQS.map((item, index) => (
            <div key={item.q} className={`faq-item${open === index ? ' open' : ''}`}>
              <button
                type="button"
                className="faq-question"
                onClick={() => setOpen(open === index ? -1 : index)}
              >
                <span>{item.q}</span>
                <span
                  className={`chevron${open === index ? ' chevron-open' : ''}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>
              {open === index && <p className="faq-answer">{item.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
