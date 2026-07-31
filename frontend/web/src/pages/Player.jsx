import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AnswerInput from '../components/AnswerInput.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

// The test player: one question at a time, autosave on every answer change
// (TST-08 — closing the browser and coming back resumes with answers intact),
// server-authoritative countdown, submit with confirmation.
export default function Player() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [attempt, setAttempt] = useState(location.state || null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(location.state?.answers || {});
  const [remainingSec, setRemainingSec] = useState(null);
  const [qRemaining, setQRemaining] = useState(null); // per-question countdown
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);
  const saveTimers = useRef({});
  const qRef = useRef(0);
  const tabWarnings = useRef(0);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const isOfficial = attempt?.mode === 'official';
  const antiCheat = (isOfficial && attempt?.antiCheat) || null;

  // Resume: fetch the attempt when opened directly (not via Start).
  useEffect(() => {
    if (attempt) return;
    api
      .get(`/attempts/${id}`)
      .then((response) => {
        setAttempt(response.data.data);
        setAnswers(response.data.data.answers || {});
      })
      .catch((error) => {
        toast.show(apiError(error).message, 'error');
        navigate('/app/my-tests');
      });
  }, [attempt, id, navigate, toast]);

  const doSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const response = await api.post(`/attempts/${id}/submit`);
      setSummary(response.data.data);
      toast.show(response.data.data.message, 'success');
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  }, [id, toast]);

  // Countdown from the server's startedAt (client clock is cosmetic only).
  useEffect(() => {
    if (!attempt?.timeLimitMin) return undefined;
    const deadline = new Date(attempt.startedAt).getTime() + attempt.timeLimitMin * 60000;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSec(left);
      if (left === 0 && !summary && !submitting) doSubmit();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [attempt, doSubmit, submitting, summary]);

  // Per-question time limit (TST-02): resets on every question; when it runs
  // out the player auto-advances (does not force-submit on the last question).
  useEffect(() => {
    if (!isOfficial || !attempt?.perQuestionSec || summary) {
      setQRemaining(null);
      return undefined;
    }
    qRef.current = attempt.perQuestionSec;
    setQRemaining(qRef.current);
    const interval = setInterval(() => {
      qRef.current -= 1;
      if (qRef.current <= 0) {
        clearInterval(interval);
        setQRemaining(0);
        setIndex((i) => Math.min(i + 1, attempt.questions.length - 1));
      } else {
        setQRemaining(qRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt, index, isOfficial, summary]);

  // TST-07 full-screen: enter on start; warn if the candidate leaves it.
  useEffect(() => {
    if (!antiCheat?.fullScreen || summary) return undefined;
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onChange = () => {
      if (!document.fullscreenElement && !summary) {
        toast.show('Please stay in full-screen mode during the test.', 'error');
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [antiCheat, summary, toast]);

  // TST-07 tab-switch detection: warn, then auto-submit past the limit.
  useEffect(() => {
    if (!antiCheat?.tabSwitchDetection || summary) return undefined;
    const limit = antiCheat.tabSwitchLimit || 3;
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') return;
      tabWarnings.current += 1;
      if (tabWarnings.current > limit) {
        toast.show('Too many tab switches — submitting your test.', 'error');
        doSubmit();
      } else {
        toast.show(
          `Warning ${tabWarnings.current}/${limit}: leaving the test tab is not allowed.`,
          'error'
        );
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [antiCheat, summary, doSubmit, toast]);

  // TST-07 disable copy/paste/cut/right-click.
  useEffect(() => {
    if (!antiCheat?.disableCopyPaste || summary) return undefined;
    const block = (event) => event.preventDefault();
    for (const type of ['copy', 'paste', 'cut', 'contextmenu'])
      document.addEventListener(type, block);
    return () => {
      for (const type of ['copy', 'paste', 'cut', 'contextmenu'])
        document.removeEventListener(type, block);
    };
  }, [antiCheat, summary]);

  // TST-07 webcam photo capture at intervals (Could). Frames are posted to the
  // server; the stream is stopped on unmount.
  useEffect(() => {
    if (!antiCheat?.webcamCapture || summary) return undefined;
    let cancelled = false;
    let interval;
    navigator.mediaDevices
      ?.getUserMedia?.({ video: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play?.().catch(() => {});
        }
        const capture = () => {
          const video = videoRef.current;
          if (!video || !video.videoWidth) return;
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          canvas.getContext('2d').drawImage(video, 0, 0, 320, 240);
          api
            .post(`/attempts/${id}/proctor-snapshot`, {
              image: canvas.toDataURL('image/jpeg', 0.5)
            })
            .catch(() => {});
        };
        setTimeout(capture, 3000);
        interval = setInterval(capture, 30000);
      })
      .catch(() => toast.show('Camera access is required for this test.', 'error'));
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, [antiCheat, summary, id, toast]);

  const saveAnswer = (questionId, answer) => {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
    // Debounced autosave per question.
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      api.patch(`/attempts/${id}/answers`, { questionId, answer }).catch(() => {});
    }, 600);
  };

  if (!attempt)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  if (summary) {
    return (
      <div className="page">
        <div className="card result-summary">
          <h2 className="page-title">
            {summary.passed ? 'Congratulations, you passed!' : 'Test submitted.'}
          </h2>
          <p className="result-score">
            {summary.obtained}/{summary.max} <span>({summary.percentage}%)</span>
          </p>
          <div className="result-metrics">
            <span>Accuracy: {summary.accuracy}%</span>
            {summary.detectionRate !== null && (
              <span>Detection rate: {summary.detectionRate}%</span>
            )}
            <span>
              Time taken: {Math.floor(summary.timeTakenSec / 60)}m {summary.timeTakenSec % 60}s
            </span>
          </div>
          <p className="answer-hint">
            Review every question to see what you missed and why — that is how you improve.
          </p>
          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={() =>
                navigate(attempt.mode === 'practice' ? '/app/practice' : '/app/my-tests')
              }
            >
              {attempt.mode === 'practice' ? 'Back to Practice' : 'Back to My Tests'}
            </Button>
            <Button variant="primary" onClick={() => navigate(`/app/results/${id}`)}>
              Review Mistakes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const question = attempt.questions[index];
  const answeredCount = attempt.questions.filter((entry) => answers[entry.id] !== undefined).length;
  const formatClock = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="page player-page">
      <div className="player-header">
        <div>
          <h2 className="page-title">{attempt.testTitle}</h2>
          <p className="page-subtitle">
            Question {index + 1} of {attempt.questions.length} · {answeredCount} answered
            {attempt.mode === 'practice' && ' · Practice (does not affect your official scores)'}
          </p>
        </div>
        <div className="player-timers">
          {qRemaining !== null && (
            <span
              className={`player-timer player-timer-q${qRemaining <= 5 ? ' player-timer-low' : ''}`}
              title="Time left on this question"
            >
              Q {formatClock(qRemaining)}
            </span>
          )}
          {remainingSec !== null && (
            <span
              className={`player-timer${remainingSec < 60 ? ' player-timer-low' : ''}`}
              title="Time remaining"
            >
              {formatClock(remainingSec)}
            </span>
          )}
        </div>
      </div>

      {antiCheat?.webcamCapture && (
        <div className="proctor-cam" title="Proctoring is active">
          <video ref={videoRef} muted playsInline width={120} height={90} />
          <span className="proctor-dot" aria-hidden="true" /> REC
        </div>
      )}

      <div className="card">
        <h3 className="player-question-title">
          {question.title}{' '}
          <span className="question-pick-meta">
            ({question.marks} marks
            {question.negativeMarks ? `, −${question.negativeMarks} per wrong claim` : ''})
          </span>
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
            Submit Test
          </Button>
        )}
      </div>

      <Modal
        open={confirmSubmit}
        title="Submit Test"
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
          Are you sure you want to submit {attempt.testTitle}? You have answered {answeredCount} of{' '}
          {attempt.questions.length} questions.
        </p>
      </Modal>
    </div>
  );
}
