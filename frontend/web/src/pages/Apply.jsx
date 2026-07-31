import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import AnswerInput from '../components/AnswerInput.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import TextField from '../components/TextField.jsx';
import { validateContactNumber, validateEmail, validateFullName } from '../utils/validators.js';

// PUBLIC candidate portal (REC-02): register via the drive link, take the
// assessment, submit. Standalone — candidates never touch the internal app,
// its auth context or its navigation.

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export default function Apply() {
  const { token } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | info | exam | done | error
  const [drive, setDrive] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [form, setForm] = useState({ fullName: '', email: '', contactNumber: '' });
  const [errors, setErrors] = useState({});
  const [starting, setStarting] = useState(false);

  const candidateApi = useRef(null);
  const [attempt, setAttempt] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalResult, setFinalResult] = useState(null);
  const saveTimers = useRef({});

  useEffect(() => {
    axios
      .get(`${baseURL}/public/drives/${token}`)
      .then((response) => {
        setDrive(response.data.data);
        setPhase('info');
      })
      .catch((error) => {
        setErrorMessage(error.response?.data?.message || 'This recruitment link is not valid.');
        setPhase('error');
      });
  }, [token]);

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  const handleStart = async (event) => {
    event.preventDefault();
    const nextErrors = {
      fullName: validateFullName(form.fullName),
      email: validateEmail(form.email),
      contactNumber: form.contactNumber ? validateContactNumber(form.contactNumber) : ''
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setStarting(true);
    try {
      const registerRes = await axios.post(`${baseURL}/public/drives/${token}/register`, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber.trim()
      });
      const candidateToken = registerRes.data.data.candidateToken;
      candidateApi.current = axios.create({
        baseURL,
        headers: { Authorization: `Bearer ${candidateToken}` }
      });
      const attemptRes = await candidateApi.current.post('/candidate/attempts/start', {});
      setAttempt(attemptRes.data.data);
      setAnswers(attemptRes.data.data.answers || {});
      setPhase('exam');
    } catch (error) {
      const message = error.response?.data?.message || 'Something went wrong. Please try again.';
      setErrors(error.response?.data?.errors || {});
      setErrorMessage(message);
      if (error.response?.status === 422 || error.response?.status === 404) {
        setPhase('error');
      }
    } finally {
      setStarting(false);
    }
  };

  const saveAnswer = (questionId, answer) => {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      candidateApi.current
        ?.patch(`/candidate/attempts/${attempt.id}/answers`, { questionId, answer })
        .catch(() => {});
    }, 600);
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await candidateApi.current.post(
        `/candidate/attempts/${attempt.id}/submit`,
        {}
      );
      setFinalResult(response.data.data);
      setPhase('done');
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  };

  const shell = (content) => (
    <div className="auth-page">
      <div className="auth-card apply-card">
        <h1 className="auth-logo">Zorfly</h1>
        {content}
      </div>
    </div>
  );

  if (phase === 'loading') return shell(<p className="loading-text">Loading…</p>);

  if (phase === 'error') {
    return shell(
      <>
        <h2 className="auth-title">Application</h2>
        <p className="auth-subtitle">{errorMessage}</p>
      </>
    );
  }

  if (phase === 'info') {
    return shell(
      <>
        <h2 className="auth-title">{drive.title}</h2>
        <p className="auth-subtitle">
          {drive.companyName} · Assessment: {drive.testTitle}
          {drive.timeLimitMin ? ` · Time limit: ${drive.timeLimitMin} minutes` : ''}
        </p>
        {drive.description && <p className="auth-subtitle">{drive.description}</p>}
        {!drive.open ? (
          <p className="field-error">This recruitment drive is not open at the moment.</p>
        ) : (
          <form onSubmit={handleStart} noValidate>
            <TextField
              label="Full Name"
              name="cFullName"
              value={form.fullName}
              onChange={setField('fullName')}
              error={errors.fullName}
              required
              maxLength={100}
            />
            <TextField
              label="Email ID"
              name="cEmail"
              type="email"
              value={form.email}
              onChange={setField('email')}
              error={errors.email}
              required
              maxLength={254}
            />
            <TextField
              label="Contact Number"
              name="cContact"
              value={form.contactNumber}
              onChange={setField('contactNumber')}
              error={errors.contactNumber}
              maxLength={15}
              inputMode="numeric"
            />
            <Button type="submit" variant="primary" fullWidth disabled={starting}>
              {starting ? 'Starting…' : 'Start Assessment'}
            </Button>
          </form>
        )}
      </>
    );
  }

  if (phase === 'done') {
    return shell(
      <>
        <h2 className="auth-title">Thank you for applying.</h2>
        <p className="auth-subtitle">{finalResult?.message}</p>
        {finalResult?.obtained !== undefined && (
          <p className="result-score">
            {finalResult.obtained}/{finalResult.max} <span>({finalResult.percentage}%)</span>
          </p>
        )}
        <p className="auth-subtitle">The hiring team will contact you about the next steps.</p>
      </>
    );
  }

  // exam phase
  const question = attempt.questions[index];
  const answeredCount = attempt.questions.filter((entry) => answers[entry.id] !== undefined).length;

  return (
    <div className="page apply-exam">
      <div className="player-header">
        <div>
          <h2 className="page-title">{attempt.testTitle}</h2>
          <p className="page-subtitle">
            Question {index + 1} of {attempt.questions.length} · {answeredCount} answered
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="player-question-title">
          {question.title} <span className="question-pick-meta">({question.marks} marks)</span>
        </h3>
        <AnswerInput
          question={question}
          answer={answers[question.id]}
          onChange={(answer) => saveAnswer(question.id, answer)}
        />
      </div>

      <div className="player-nav">
        <Button variant="secondary" onClick={() => setIndex(index - 1)} disabled={index === 0}>
          Previous
        </Button>
        <div className="player-dots">
          {attempt.questions.map((entry, dotIndex) => (
            <button
              key={entry.id}
              type="button"
              className={`player-dot${dotIndex === index ? ' current' : ''}${answers[entry.id] !== undefined ? ' answered' : ''}`}
              onClick={() => setIndex(dotIndex)}
              title={`Question ${dotIndex + 1}`}
              aria-label={`Go to question ${dotIndex + 1}`}
            >
              {dotIndex + 1}
            </button>
          ))}
        </div>
        {index < attempt.questions.length - 1 ? (
          <Button variant="primary" onClick={() => setIndex(index + 1)}>
            Next
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setConfirmSubmit(true)}>
            Submit Assessment
          </Button>
        )}
      </div>

      <Modal
        open={confirmSubmit}
        title="Submit Assessment"
        onClose={() => setConfirmSubmit(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmSubmit(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={doSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </>
        }
      >
        <p>
          Are you sure you want to submit your assessment for {attempt.testTitle}? You have answered{' '}
          {answeredCount} of {attempt.questions.length} questions. You cannot change your answers
          afterwards.
        </p>
      </Modal>
    </div>
  );
}
