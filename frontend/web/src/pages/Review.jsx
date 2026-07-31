import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, apiError } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { mediaUrl } from '../utils/media.js';
import { TYPE_LABELS } from '../utils/constants.js';

// The mistake-review screen (TRN-01): for every question — your answer, the
// correct answer, marks earned and the author's explanation. This screen is
// the heart of "every assessment is a learning opportunity".

function CorrectAnswerView({ question }) {
  const content = question.content;
  switch (question.type) {
    case 'mcq': {
      const correct = content.options.filter((option) =>
        content.correctOptionIds.includes(option.id)
      );
      return (
        <p>
          Correct answer: <strong>{correct.map((option) => option.text).join(', ')}</strong>
        </p>
      );
    }
    case 'true_false':
      return (
        <p>
          Correct answer: <strong>{content.correctAnswer ? 'True' : 'False'}</strong>
        </p>
      );
    case 'image_comparison': {
      // Accepts both the current {images:[{id,url}], correctImageId} shape
      // and the legacy {imageAUrl,imageBUrl,correctImage} shape.
      const images = Array.isArray(content.images)
        ? content.images
        : [
            content.imageAUrl && { id: 'a', url: content.imageAUrl },
            content.imageBUrl && { id: 'b', url: content.imageBUrl }
          ].filter(Boolean);
      const correctImageId =
        content.correctImageId ??
        (content.correctImage === 'A' ? 'a' : content.correctImage === 'B' ? 'b' : '');
      const correctIndex = images.findIndex((image) => image.id === correctImageId);
      return (
        <div>
          <p>
            Correct image: <strong>Image {correctIndex >= 0 ? correctIndex + 1 : '—'}</strong>
          </p>
          <div className="image-compare">
            {images.map((image, index) => (
              <div
                key={image.id}
                className={`image-compare-card${image.id === correctImageId ? ' selected' : ''}`}
              >
                <img src={mediaUrl(image.url)} alt={`Image ${index + 1}`} />
                <span>
                  Image {index + 1}
                  {image.id === correctImageId ? ' ✓' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'find_mistakes':
      return (
        <div>
          <p>Mistakes present:</p>
          <ul className="review-list">
            {content.mistakes.map((mistake) => (
              <li key={mistake.id}>{mistake.label}</li>
            ))}
          </ul>
        </div>
      );
    case 'hotspot':
      return (
        <div>
          <p>Mistake locations (highlighted):</p>
          <div className="hotspot-wrap">
            <img src={mediaUrl(content.imageUrl)} alt="Zones" className="question-image" />
            {content.zones.map((zone, index) => (
              <span
                key={zone.id}
                className="hotspot-zone"
                style={{
                  left: `${zone.x * 100}%`,
                  top: `${zone.y * 100}%`,
                  width: `${zone.w * 100}%`,
                  height: `${zone.h * 100}%`
                }}
                title={zone.label}
              >
                {index + 1}
              </span>
            ))}
          </div>
          <ul className="review-list">
            {content.zones.map((zone, index) => (
              <li key={zone.id}>
                {index + 1}. {zone.label}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'content_review': {
      const words = content.text.split(/\s+/);
      return (
        <div>
          <p>Errors in the paragraph:</p>
          <ul className="review-list">
            {content.errors.map((error) => (
              <li key={error.id}>
                "{words[error.wordIndex]}" → <strong>{error.correction || '(remove/fix)'}</strong>
                {error.explanation ? ` — ${error.explanation}` : ''}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case 'video_review': {
      const format = (seconds) =>
        `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
      return (
        <div>
          <p>Mistakes in the video:</p>
          <ul className="review-list">
            {content.mistakes.map((mistake) => (
              <li key={mistake.id}>
                {format(mistake.timestampSec)} — {mistake.label}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case 'drag_drop': {
      if (content.mode === 'sequence') {
        const textById = new Map(content.items.map((item) => [item.id, item.text]));
        return (
          <div>
            <p>Correct sequence:</p>
            <ol className="review-list">
              {content.correctOrder.map((itemId) => (
                <li key={itemId}>{textById.get(itemId)}</li>
              ))}
            </ol>
          </div>
        );
      }
      const leftById = new Map(content.left.map((item) => [item.id, item.text]));
      const rightById = new Map(content.right.map((item) => [item.id, item.text]));
      return (
        <div>
          <p>Correct pairs:</p>
          <ul className="review-list">
            {content.correctPairs.map((pair) => (
              <li key={pair.leftId}>
                {leftById.get(pair.leftId)} ↔ {rightById.get(pair.rightId)}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    default:
      return null;
  }
}

export default function Review() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get(`/attempts/${id}/review`)
      .then((response) => setData(response.data.data))
      .catch((error) => {
        toast.show(apiError(error).message, 'error');
        navigate('/app/my-tests');
      });
  }, [id, navigate, toast]);

  if (!data)
    return (
      <div className="page">
        <p className="loading-text">Loading…</p>
      </div>
    );

  return (
    <div className="page">
      <div className="page-header page-header-row">
        <div>
          <h2 className="page-title">Review: {data.testTitle}</h2>
          <p className="page-subtitle">
            {data.result.obtained}/{data.result.max} ({data.result.percentage}%) ·{' '}
            {data.result.passed ? 'Passed' : 'Not passed'} · Accuracy {data.result.accuracy}%
            {data.result.detectionRate !== null && ` · Detection ${data.result.detectionRate}%`}
            {data.result.pendingReview &&
              ' · Some typed answers are still being reviewed — this score is provisional.'}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate(data.mode === 'practice' ? '/app/practice' : '/app/my-tests')}
        >
          Back
        </Button>
      </div>

      {data.questions.map((question, index) => (
        <div
          key={question.id}
          className={`card review-card${question.fullMarks ? ' review-correct' : ''}`}
        >
          <div className="review-head">
            <h3 className="player-question-title">
              {index + 1}. {question.title}
            </h3>
            <span
              className={`state-badge ${question.fullMarks ? 'state-published' : 'state-closed'}`}
            >
              {question.obtained}/{question.marks} marks
            </span>
          </div>
          <p className="question-pick-meta">
            {TYPE_LABELS[question.type]}
            {!question.attempted && ' · Not attempted'}
            {question.detection &&
              ` · You found ${question.detection.found} of ${question.detection.total} mistakes`}
          </p>

          <CorrectAnswerView question={question} />

          {question.explanation && (
            <div className="review-explanation">
              <strong>Why:</strong> {question.explanation}
            </div>
          )}
          {question.trainingLink && (
            <p>
              <a
                className="text-link"
                href={question.trainingLink}
                target="_blank"
                rel="noreferrer"
              >
                Related training material
              </a>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
