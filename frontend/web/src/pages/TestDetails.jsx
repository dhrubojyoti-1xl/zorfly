import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AnswerInput from '../components/AnswerInput.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_TARGET_TYPE_LABELS,
  DIFFICULTY_LABELS
} from '../utils/constants.js';

const LIFECYCLE_LABELS = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived',
  scheduled: 'Scheduled',
  active: 'Active'
};

// Test Details — the central hub for one test: what it is, how it's set up,
// how it's currently doing (assignment summary + recent history), and quick
// actions. Replaces the old "Preview" popup as the default click target;
// candidate-simulation preview is still here, just as a Quick Action.
export default function TestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get(`/tests/${id}`), api.get(`/tests/${id}/assignments`).catch(() => null)])
      .then(([testResponse, assignmentsResponse]) => {
        setTest(testResponse.data.data);
        if (assignmentsResponse)
          setRecentAssignments(assignmentsResponse.data.data.rows.slice(0, 5));
      })
      .catch((error) => {
        toast.show(apiError(error).message, 'error');
        navigate('/app/tests');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openPreview = async () => {
    setPreviewOpen(true);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const response = await api.get(`/tests/${id}/preview`);
      setPreviewData(response.data.data);
    } catch (error) {
      toast.show(apiError(error).message, 'error');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );
  if (!test) return null;

  const questionCount =
    test.mode === 'fixed' ? test.questionIds.length : test.randomConfig?.count || 0;
  const duration =
    test.settings.timeLimitMin > 0 ? `${test.settings.timeLimitMin} min` : 'No time limit';
  const anticheat = test.settings.antiCheat || {};
  const anticheatFlags = [
    anticheat.fullScreen && 'Full-screen enforced',
    anticheat.tabSwitchDetection && `Tab-switch detection (limit ${anticheat.tabSwitchLimit})`,
    anticheat.disableCopyPaste && 'Copy/paste disabled',
    anticheat.webcamCapture && 'Webcam capture'
  ].filter(Boolean);

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">{test.title}</h2>
          <p className="page-subtitle">
            <span className={`test-status-badge test-status-${test.lifecycleStatus || test.state}`}>
              {LIFECYCLE_LABELS[test.lifecycleStatus || test.state]}
            </span>
            {' · '}
            {test.scheduleText || 'Not assigned yet'}
          </p>
        </div>
        <span className="action-group">
          <Button variant="secondary" onClick={openPreview}>
            Preview as Candidate
          </Button>
          {test.state === 'draft' && (
            <Button variant="secondary" onClick={() => navigate(`/app/tests/${id}`)}>
              Edit
            </Button>
          )}
          {test.state === 'published' && (
            <Button variant="secondary" onClick={() => navigate(`/app/tests/${id}/results`)}>
              View Results
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/app/tests')}>
            Back to Tests
          </Button>
        </span>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-body">
            <span className="kpi-value">{questionCount}</span>
            <span className="kpi-label">Questions</span>
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-body">
            <span className="kpi-value">{test.totalMarks || '—'}</span>
            <span className="kpi-label">Total Marks</span>
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-body">
            <span className="kpi-value">{duration}</span>
            <span className="kpi-label">Duration</span>
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-body">
            <span className="kpi-value">{test.settings.passingPercentage}%</span>
            <span className="kpi-label">Passing Criteria</span>
          </span>
        </div>
      </div>

      <div className="master-two-col">
        <div className="card">
          <h3 className="card-title">Test Information</h3>
          <p className="answer-hint">{test.description || 'No description provided.'}</p>
          <dl className="detail-list">
            <div className="detail-row">
              <dt>Category</dt>
              <dd>{test.categoryId?.name || '—'}</dd>
            </div>
            <div className="detail-row">
              <dt>Sub-category</dt>
              <dd>{test.subCategoryId?.name || '—'}</dd>
            </div>
            <div className="detail-row">
              <dt>Difficulty</dt>
              <dd>{DIFFICULTY_LABELS[test.difficulty] || '—'}</dd>
            </div>
            <div className="detail-row">
              <dt>Paper Type</dt>
              <dd>{test.mode === 'random' ? 'Random per attempt' : 'Fixed'}</dd>
            </div>
          </dl>

          <h3 className="card-title" style={{ marginTop: '1.2rem' }}>
            Instructions &amp; Rules
          </h3>
          <dl className="detail-list">
            <div className="detail-row">
              <dt>Attempts Allowed</dt>
              <dd>{test.settings.attemptsAllowed}</dd>
            </div>
            <div className="detail-row">
              <dt>Negative Marking</dt>
              <dd>{test.settings.negativeMarking ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div className="detail-row">
              <dt>Question Order</dt>
              <dd>{test.settings.shuffleQuestions ? 'Shuffled' : 'Fixed'}</dd>
            </div>
            <div className="detail-row">
              <dt>Option Order</dt>
              <dd>{test.settings.shuffleOptions ? 'Shuffled' : 'Fixed'}</dd>
            </div>
          </dl>
          {anticheatFlags.length > 0 && (
            <p className="answer-hint">Anti-cheat: {anticheatFlags.join(' · ')}</p>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Assignment Summary</h3>
          <dl className="detail-list">
            <div className="detail-row">
              <dt>Total Assignments</dt>
              <dd>{test.assignmentsTotal}</dd>
            </div>
            <div className="detail-row">
              <dt>Active</dt>
              <dd>{test.assignmentsActive}</dd>
            </div>
            <div className="detail-row">
              <dt>Recurring/Scheduled</dt>
              <dd>{test.assignmentsScheduled}</dd>
            </div>
          </dl>
          {test.state === 'published' && (
            <div className="form-actions" style={{ marginTop: '0.8rem' }}>
              <Button variant="primary" onClick={() => navigate('/app/tests')}>
                Manage from Tests list
              </Button>
            </div>
          )}

          <h3 className="card-title" style={{ marginTop: '1.2rem' }}>
            Recent Assignment History
          </h3>
          {recentAssignments.length === 0 ? (
            <p className="table-empty">This test has not been assigned to anyone yet.</p>
          ) : (
            <ul className="preview-assignment-list">
              {recentAssignments.map((assignment) => (
                <li key={assignment.id} className="preview-assignment-row">
                  <span className="preview-assignment-target">
                    {ASSIGNMENT_TARGET_TYPE_LABELS[assignment.targetType] || assignment.targetType}:{' '}
                    {assignment.targetLabel}
                  </span>
                  <span className={`state-badge state-assign-${assignment.status}`}>
                    {ASSIGNMENT_STATUS_LABELS[assignment.status] || assignment.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="form-actions" style={{ marginTop: '0.8rem' }}>
            <Button variant="secondary" onClick={() => navigate(`/app/tests/${id}/assignments`)}>
              View Full History
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={previewOpen}
        title={`Preview: ${test.title}`}
        size="lg"
        onClose={() => setPreviewOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        }
      >
        {previewLoading ? (
          <p className="answer-hint">Loading preview…</p>
        ) : previewData ? (
          <div className="test-preview">
            <p className="answer-hint">
              This is exactly what candidates see — correct answers are hidden.
            </p>
            {previewData.questions.length === 0 ? (
              <p className="table-empty">This test has no questions yet.</p>
            ) : (
              previewData.questions.map((question, index) => (
                <div key={question.id || index} className="preview-question">
                  <p className="preview-question-title">
                    <strong>Q{index + 1}.</strong> {question.title}{' '}
                    <span className="question-pick-meta">({question.marks} marks)</span>
                  </p>
                  <div className="preview-answer">
                    <AnswerInput question={question} answer={undefined} onChange={() => {}} />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
