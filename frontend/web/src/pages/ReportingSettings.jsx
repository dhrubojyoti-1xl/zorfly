import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import SelectField from '../components/SelectField.jsx';
import TrashIcon from '../components/TrashIcon.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { BROADCAST_REPORT_KIND_OPTIONS } from '../utils/constants.js';

const DAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' }
];
const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

// Company Admin only. Every company_admin user always receives the scheduled
// summary automatically — that's never configured here; this page only adds
// EXTRA recipients (each with their own report-kind selection) and sets the
// one company-wide send schedule.
export default function ReportingSettings() {
  const { show } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyAdmins, setCompanyAdmins] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newReportTypes, setNewReportTypes] = useState([]);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [schedule, setSchedule] = useState({
    frequency: 'monthly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    sendHour: 8,
    sendMinute: 0,
    active: false,
    timeZone: ''
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/reports/settings/recipients'), api.get('/reports/settings/schedule')])
      .then(([recipientsRes, scheduleRes]) => {
        setCompanyAdmins(recipientsRes.data.data.companyAdmins);
        setRecipients(recipientsRes.data.data.recipients);
        setSchedule(scheduleRes.data.data);
      })
      .catch((error) => show(apiError(error).message, 'error'))
      .finally(() => setLoading(false));
  }, [show]);

  useEffect(load, [load]);

  const toggleNewReportType = (key) =>
    setNewReportTypes((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );

  const addRecipient = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const response = await api.post('/reports/settings/recipients', {
        email: newEmail.trim(),
        reportTypes: newReportTypes
      });
      show(response.data.data.message, 'success');
      setNewEmail('');
      setNewReportTypes([]);
      load();
    } catch (error) {
      show(apiError(error).message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const toggleRecipientType = async (recipient, key) => {
    const nextTypes = recipient.reportTypes.includes(key)
      ? recipient.reportTypes.filter((k) => k !== key)
      : [...recipient.reportTypes, key];
    setBusyId(recipient.id);
    try {
      await api.patch(`/reports/settings/recipients/${recipient.id}`, { reportTypes: nextTypes });
      setRecipients((current) =>
        current.map((r) => (r.id === recipient.id ? { ...r, reportTypes: nextTypes } : r))
      );
    } catch (error) {
      show(apiError(error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeRecipient = async (recipient) => {
    setBusyId(recipient.id);
    try {
      const response = await api.delete(`/reports/settings/recipients/${recipient.id}`);
      show(response.data.data.message, 'success');
      setRecipients((current) => current.filter((r) => r.id !== recipient.id));
    } catch (error) {
      show(apiError(error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const setScheduleField = (name) => (event) =>
    setSchedule((current) => ({ ...current, [name]: event.target.value }));

  const saveSchedule = async () => {
    setSavingSchedule(true);
    try {
      const payload = {
        frequency: schedule.frequency,
        sendHour: Number(schedule.sendHour),
        sendMinute: Number(schedule.sendMinute),
        active: schedule.active
      };
      if (schedule.frequency === 'weekly') payload.dayOfWeek = Number(schedule.dayOfWeek);
      if (schedule.frequency === 'monthly') payload.dayOfMonth = Number(schedule.dayOfMonth);
      const response = await api.patch('/reports/settings/schedule', payload);
      show(response.data.data.message, 'success');
      load();
    } catch (error) {
      show(apiError(error).message, 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  if (loading)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Reporting Emails</h2>
          <p className="page-subtitle">
            Configure who receives the scheduled report summary, and when.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/app/company-settings')}>
          ← Back to Company Settings
        </Button>
      </div>

      <div className="notice-banner notice-banner-warn">
        Every Company Admin ({companyAdmins.map((a) => a.fullName).join(', ') || 'none yet'})
        automatically receives the scheduled summary. Add extra recipients below, and choose which
        reports each one should get.
      </div>

      <div className="card">
        <h3 className="card-title">Recipients</h3>
        {recipients.length === 0 ? (
          <p className="answer-hint">No extra recipients yet.</p>
        ) : (
          recipients.map((recipient) => (
            <div key={recipient.id} className="editor-row recipient-row">
              <div className="recipient-row-main">
                <p className="recipient-email">{recipient.email}</p>
                <div className="report-kind-picklist">
                  {BROADCAST_REPORT_KIND_OPTIONS.map((option) => (
                    <label key={option.value} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={recipient.reportTypes.includes(option.value)}
                        disabled={busyId === recipient.id}
                        onChange={() => toggleRecipientType(recipient, option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                {recipient.reportTypes.length === 0 && (
                  <p className="answer-hint">
                    No reports selected — receives every report by default.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                data-tooltip="Remove"
                aria-label={`Remove ${recipient.email}`}
                disabled={busyId === recipient.id}
                onClick={() => removeRecipient(recipient)}
              >
                <TrashIcon />
              </button>
            </div>
          ))
        )}

        <div className="editor-row" style={{ marginTop: '1rem' }}>
          <input
            type="email"
            className="field-input"
            placeholder="Enter Email ID…"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            maxLength={254}
          />
          <Button variant="primary" onClick={addRecipient} disabled={adding || !newEmail.trim()}>
            {adding ? 'Adding…' : '+ Add'}
          </Button>
        </div>
        <div className="report-kind-picklist" style={{ marginTop: '0.6rem' }}>
          {BROADCAST_REPORT_KIND_OPTIONS.map((option) => (
            <label key={option.value} className="checkbox-label">
              <input
                type="checkbox"
                checked={newReportTypes.includes(option.value)}
                onChange={() => toggleNewReportType(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <p className="answer-hint">
          Leave every box unchecked to send this recipient every report.
        </p>
      </div>

      <div className="card">
        <h3 className="card-title">Report Schedule</h3>
        <p className="answer-hint">
          Pick how often the summary is sent and at what time. Daily is sent every day, Weekly is
          sent on the chosen day of the week, Monthly is sent on the chosen day of the month.
        </p>
        <div className="editor-two-col">
          <SelectField
            label="Frequency"
            name="schFrequency"
            value={schedule.frequency}
            onChange={setScheduleField('frequency')}
            options={FREQUENCY_OPTIONS}
          />
          {schedule.frequency === 'weekly' && (
            <SelectField
              label="Day of Week"
              name="schDayOfWeek"
              value={String(schedule.dayOfWeek)}
              onChange={setScheduleField('dayOfWeek')}
              options={DAY_OPTIONS}
            />
          )}
          {schedule.frequency === 'monthly' && (
            <div className="field">
              <label className="field-label" htmlFor="schDayOfMonth">
                Day of Month
              </label>
              <input
                id="schDayOfMonth"
                type="number"
                min="1"
                max="28"
                className="field-input"
                value={schedule.dayOfMonth}
                onChange={setScheduleField('dayOfMonth')}
              />
            </div>
          )}
        </div>
        <div className="editor-two-col">
          <div className="field">
            <label className="field-label" htmlFor="schSendTime">
              Send Time
            </label>
            <input
              id="schSendTime"
              type="time"
              className="field-input"
              value={`${String(schedule.sendHour).padStart(2, '0')}:${String(schedule.sendMinute).padStart(2, '0')}`}
              onChange={(event) => {
                const [hour, minute] = event.target.value.split(':');
                setSchedule((current) => ({
                  ...current,
                  sendHour: Number(hour),
                  sendMinute: Number(minute)
                }));
              }}
            />
          </div>
          <div className="field">
            <label className="field-label">Timezone</label>
            <p className="field-static-value">{schedule.timeZone}</p>
          </div>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={schedule.active}
            onChange={(event) =>
              setSchedule((current) => ({ ...current, active: event.target.checked }))
            }
          />
          <span>Enable scheduled report emails</span>
        </label>
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <Button variant="primary" onClick={saveSchedule} disabled={savingSchedule}>
            {savingSchedule ? 'Saving…' : 'Save Schedule'}
          </Button>
        </div>
      </div>
    </div>
  );
}
