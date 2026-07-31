import { useState } from 'react';
import DataTable from '../../components/DataTable.jsx';
import Modal from '../../components/Modal.jsx';
import { EyeIcon } from '../../components/ActionIcons.jsx';
import { api, apiError } from '../../api/client.js';
import { useList } from '../../hooks/useList.js';
import { useToast } from '../../context/ToastContext.jsx';

// Email logs (SMTP audit) with full filters: recipient search, status, type,
// and a date range.
const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'test_assigned', label: 'Test Assigned' },
  { value: 'result_published', label: 'Result Published' },
  { value: 'badge_earned', label: 'Badge Earned' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'general', label: 'General' }
];

const STATUS_BADGE = {
  sent: 'state-published',
  logged: '',
  failed: 'state-closed'
};

export default function MasterEmailLogs() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [previewTarget, setPreviewTarget] = useState(null); // row being previewed
  const [previewData, setPreviewData] = useState(null); // fetched detail incl. bodyHtml
  const [previewLoading, setPreviewLoading] = useState(false);

  const list = useList('/master/email-logs', {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {})
  });

  const openPreview = async (row) => {
    setPreviewTarget(row);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const response = await api.get(`/master/email-logs/${row.id}`);
      setPreviewData(response.data.data);
    } catch (error) {
      toast.show(apiError(error).message, 'error');
      setPreviewTarget(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetFilters = () => {
    setStatus('');
    setType('');
    setFrom('');
    setTo('');
    list.setPage(1);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Email Logs</h2>
        <p className="page-subtitle">
          Every outbound email, with delivery status. Useful for the SMTP module.
        </p>
      </div>

      <div className="filter-bar">
        <select
          className="field-input filter-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            list.setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="logged">Logged (dev)</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className="field-input filter-select"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            list.setPage(1);
          }}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="filter-date">
          <span>From</span>
          <input
            type="date"
            className="field-input"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              list.setPage(1);
            }}
          />
        </label>
        <label className="filter-date">
          <span>To</span>
          <input
            type="date"
            className="field-input"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              list.setPage(1);
            }}
          />
        </label>
        {(status || type || from || to) && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
            Clear Filters
          </button>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'to', label: 'Recipient' },
          { key: 'subject', label: 'Subject' },
          { key: 'type', label: 'Type' },
          { key: 'status', label: 'Status' },
          { key: 'sentAt', label: 'Sent At' },
          { key: 'actions', label: 'Actions', className: 'col-action' }
        ]}
        {...list}
        onSearch={list.setSearch}
        onPage={list.setPage}
        onLimit={list.setPageSize}
        renderRow={(row, serial) => (
          <tr key={row.id}>
            <td className="col-serial">{serial}</td>
            <td className="cell-wrap">{row.to}</td>
            <td className="cell-wrap">{row.subject}</td>
            <td>{row.type}</td>
            <td>
              <span className={`state-badge ${STATUS_BADGE[row.status]}`} title={row.error || ''}>
                {row.status === 'logged' ? 'Logged' : row.status === 'sent' ? 'Sent' : 'Failed'}
              </span>
            </td>
            <td>{new Date(row.sentAt).toLocaleString('en-GB')}</td>
            <td className="col-action">
              <button
                type="button"
                className="icon-btn"
                data-tooltip="Preview email"
                aria-label={`Preview email to ${row.to}`}
                onClick={() => openPreview(row)}
              >
                <EyeIcon />
              </button>
            </td>
          </tr>
        )}
      />

      <Modal
        open={Boolean(previewTarget)}
        title="Email Preview"
        size="xl"
        onClose={() => {
          setPreviewTarget(null);
          setPreviewData(null);
        }}
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPreviewTarget(null);
              setPreviewData(null);
            }}
          >
            Close
          </button>
        }
      >
        {previewTarget && (
          <div className="email-preview">
            <dl className="email-preview-meta">
              <div>
                <dt>To</dt>
                <dd>{previewTarget.to}</dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>{previewTarget.subject}</dd>
              </div>
              <div>
                <dt>Sent</dt>
                <dd>{new Date(previewTarget.sentAt).toLocaleString('en-GB')}</dd>
              </div>
            </dl>
            {previewLoading && <p className="loading-text">Loading preview…</p>}
            {!previewLoading && previewData && !previewData.bodyHtml && (
              <p className="answer-hint">
                No stored preview for this email — it was sent before the preview feature was added.
              </p>
            )}
            {!previewLoading && previewData?.bodyHtml && (
              <iframe
                title="Email preview"
                className="email-preview-frame"
                srcDoc={previewData.bodyHtml}
                sandbox=""
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
