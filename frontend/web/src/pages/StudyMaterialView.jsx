import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { DIFFICULTY_LABELS, STUDY_CONTENT_TYPE_LABELS } from '../utils/constants.js';

// Reader + self-check practice for one Study Library entry. Practice here is
// self-assessment only — nothing is sent to the server or counted in stats.
export default function StudyMaterialView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({}); // questionIndex -> chosen option index
  const [revealed, setRevealed] = useState({}); // flashcard index -> bool

  useEffect(() => {
    api
      .get(`/study/${id}`)
      .then((response) => setMaterial(response.data.data))
      .catch((error) => {
        toast.show(apiError(error).message, 'error');
        navigate('/app/study');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, toast]);

  if (loading)
    return (
      <div className="page">
        <p className="page-subtitle">Loading…</p>
      </div>
    );
  if (!material) return null;

  const body = material.body || {};
  const sections = body.sections || [];
  const keyPoints = body.keyPoints || [];
  const questions = material.questions || [];
  const isFlashcards = material.contentType === 'flashcards';

  const answered = Object.keys(answers).length;
  const correct = questions.reduce((sum, q, i) => sum + (answers[i] === q.correctIndex ? 1 : 0), 0);

  return (
    <div className="page study-view">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">{material.title}</h2>
          <p className="page-subtitle">
            <span className="study-badge">
              {STUDY_CONTENT_TYPE_LABELS[material.contentType] || material.contentType}
            </span>
            {material.category && <span className="study-meta"> · {material.category}</span>}
            {material.difficulty && (
              <span className="study-meta">
                {' '}
                · {DIFFICULTY_LABELS[material.difficulty] || material.difficulty}
              </span>
            )}
            {material.source === 'ai' && <span className="study-meta"> · ✨ AI-generated</span>}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/app/study')}>
          Back to Library
        </Button>
      </div>

      {body.overview && (
        <div className="card study-card">
          <p className="study-overview">{body.overview}</p>
        </div>
      )}

      {sections.length > 0 && (
        <div className="card study-card">
          {isFlashcards ? (
            <div className="flashcard-grid">
              {sections.map((section, i) => (
                <button
                  key={i}
                  type="button"
                  className={`flashcard${revealed[i] ? ' flipped' : ''}`}
                  onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}
                >
                  <span className="flashcard-term">{section.heading}</span>
                  {revealed[i] ? (
                    <span className="flashcard-body">{section.body}</span>
                  ) : (
                    <span className="flashcard-hint">Click to reveal</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            sections.map((section, i) => (
              <section key={i} className="study-section">
                <h3 className="study-section-heading">{section.heading}</h3>
                <p className="study-section-body">{section.body}</p>
              </section>
            ))
          )}
        </div>
      )}

      {keyPoints.length > 0 && (
        <div className="card study-card">
          <h3 className="study-section-heading">Key Points</h3>
          <ul className="study-keypoints">
            {keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {questions.length > 0 && (
        <div className="card study-card">
          <div className="page-header-row">
            <h3 className="study-section-heading">Practice ({questions.length})</h3>
            {answered > 0 && (
              <span className="study-score">
                {correct}/{answered} correct
              </span>
            )}
          </div>
          <ol className="study-quiz">
            {questions.map((q, qi) => {
              const chosen = answers[qi];
              const done = chosen !== undefined;
              return (
                <li key={qi} className="study-quiz-item">
                  <p className="study-quiz-prompt">{q.prompt}</p>
                  <div className="study-quiz-options">
                    {q.options.map((opt, oi) => {
                      let cls = 'study-option';
                      if (done) {
                        if (oi === q.correctIndex) cls += ' correct';
                        else if (oi === chosen) cls += ' wrong';
                      }
                      return (
                        <button
                          key={oi}
                          type="button"
                          className={cls}
                          disabled={done}
                          onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {done && q.explanation && (
                    <p className="study-explanation">
                      {chosen === q.correctIndex ? '✓ Correct. ' : '✗ Not quite. '}
                      {q.explanation}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
