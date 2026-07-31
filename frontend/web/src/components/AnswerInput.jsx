import { useRef } from 'react';
import { mediaUrl } from '../utils/media.js';

// The test-taker's answer UI for every question type. Receives the SANITIZED
// question (no correct answers) and the current answer; calls onChange with
// the new answer payload (autosaved upstream). Works with mouse and touch.

function McqAnswer({ question, answer, onChange }) {
  const selected = new Set(answer?.selectedIds || []);
  const toggle = (id) => {
    const next = new Set(selected);
    if (question.content.multiple) {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    } else {
      next.clear();
      next.add(id);
    }
    onChange({ selectedIds: [...next] });
  };
  return (
    <div className="answer-options">
      {question.content.options.map((option) => (
        <label
          key={option.id}
          className={`answer-option${selected.has(option.id) ? ' selected' : ''}`}
        >
          <input
            type={question.content.multiple ? 'checkbox' : 'radio'}
            name={`q-${question.id}`}
            checked={selected.has(option.id)}
            onChange={() => toggle(option.id)}
          />
          <span>{option.text}</span>
          {option.imageUrl && (
            <img src={mediaUrl(option.imageUrl)} alt="" className="option-image" />
          )}
        </label>
      ))}
    </div>
  );
}

function TrueFalseAnswer({ answer, onChange }) {
  return (
    <div className="answer-options answer-options-row">
      {[
        { value: true, label: 'True' },
        { value: false, label: 'False' }
      ].map((option) => (
        <label
          key={String(option.value)}
          className={`answer-option${answer?.value === option.value ? ' selected' : ''}`}
        >
          <input
            type="radio"
            checked={answer?.value === option.value}
            onChange={() => onChange({ value: option.value })}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function ImageComparisonAnswer({ question, answer, onChange }) {
  const content = question.content;
  const images = Array.isArray(content.images)
    ? content.images
    : [
        content.imageAUrl && { id: 'a', url: content.imageAUrl },
        content.imageBUrl && { id: 'b', url: content.imageBUrl }
      ].filter(Boolean);
  // Accept the new answer {choiceId} or legacy {choice:'A'|'B'}.
  const selectedId =
    answer?.choiceId ?? (answer?.choice === 'A' ? 'a' : answer?.choice === 'B' ? 'b' : null);
  return (
    <div className="image-compare">
      {images.map((image, index) => (
        <button
          key={image.id}
          type="button"
          className={`image-compare-card${selectedId === image.id ? ' selected' : ''}`}
          onClick={() => onChange({ choiceId: image.id })}
          title={`Select Image ${index + 1}`}
        >
          <img src={mediaUrl(image.url)} alt={`Image ${index + 1}`} />
          <span>
            Image {index + 1}
            {selectedId === image.id ? ' ✓' : ''}
          </span>
        </button>
      ))}
      <p className="answer-hint">Select the image that is correct.</p>
    </div>
  );
}

function FindMistakesAnswer({ question, answer, onChange }) {
  // Typed mode: the candidate writes each mistake they find (one per line);
  // a reviewer scores it afterwards.
  if (question.content.mode === 'typed') {
    return (
      <div>
        <img
          src={mediaUrl(question.content.imageUrl)}
          alt="Creative to review"
          className="question-image"
        />
        <p className="answer-hint">
          Type every mistake you can find — one per line. Your answers will be reviewed and your
          final score confirmed afterwards.
        </p>
        <textarea
          className="field-input field-textarea"
          placeholder="Enter one mistake per line"
          value={(answer?.typedAnswers || []).join('\n')}
          maxLength={2000}
          onChange={(event) => onChange({ typedAnswers: event.target.value.split('\n') })}
        />
      </div>
    );
  }

  const selected = new Set(answer?.selectedIds || []);
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ selectedIds: [...next] });
  };
  return (
    <div>
      <img
        src={mediaUrl(question.content.imageUrl)}
        alt="Creative to review"
        className="question-image"
      />
      <p className="answer-hint">Select every mistake you can find in this creative.</p>
      <div className="answer-options">
        {question.content.options.map((option) => (
          <label
            key={option.id}
            className={`answer-option${selected.has(option.id) ? ' selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.has(option.id)}
              onChange={() => toggle(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function HotspotAnswer({ question, answer, onChange }) {
  const imageRef = useRef(null);
  const clicks = answer?.clicks || [];

  const handleClick = (event) => {
    const rect = imageRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    onChange({
      clicks: [...clicks, { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }]
    });
  };

  const removeClick = (index) => {
    onChange({ clicks: clicks.filter((_, i) => i !== index) });
  };

  return (
    <div>
      <p className="answer-hint">
        Tap or click the exact places where the mistakes are. {question.content.zonesCount}{' '}
        mistake(s) exist. Tap a marker to remove it.
      </p>
      <div className="hotspot-wrap">
        <img
          ref={imageRef}
          src={mediaUrl(question.content.imageUrl)}
          alt="Find the mistakes"
          className="question-image hotspot-image"
          onClick={handleClick}
        />
        {clicks.map((click, index) => (
          <button
            key={`${click.x}-${click.y}-${index}`}
            type="button"
            className="hotspot-marker"
            style={{ left: `${click.x * 100}%`, top: `${click.y * 100}%` }}
            onClick={(event) => {
              event.stopPropagation();
              removeClick(index);
            }}
            title="Remove this mark"
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContentReviewAnswer({ question, answer, onChange }) {
  const words = question.content.text.split(/\s+/);
  const selected = new Set(answer?.selectedWordIndexes || []);
  const toggle = (index) => {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    onChange({ selectedWordIndexes: [...next] });
  };
  return (
    <div>
      <p className="answer-hint">Click every word that you believe is wrong.</p>
      <p className="content-review-text">
        {words.map((word, index) => (
          <button
            key={`${word}-${index}`}
            type="button"
            className={`word-token${selected.has(index) ? ' selected' : ''}`}
            onClick={() => toggle(index)}
          >
            {word}
          </button>
        ))}
      </p>
    </div>
  );
}

function VideoReviewAnswer({ question, answer, onChange }) {
  const videoRef = useRef(null);
  const marks = answer?.marks || [];

  const addMark = () => {
    const timestampSec = Math.round((videoRef.current?.currentTime || 0) * 10) / 10;
    videoRef.current?.pause();
    onChange({ marks: [...marks, { timestampSec }] });
  };

  const removeMark = (index) => {
    onChange({ marks: marks.filter((_, i) => i !== index) });
  };

  const format = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  return (
    <div>
      <video
        ref={videoRef}
        src={mediaUrl(question.content.videoUrl)}
        controls
        className="question-video"
      />
      <p className="answer-hint">
        Watch the video. Pause and press "Mark mistake here" at every moment where a mistake occurs
        (tolerance ±{question.content.toleranceSec} seconds).
      </p>
      <button type="button" className="btn btn-primary btn-sm" onClick={addMark}>
        Mark mistake here
      </button>
      {marks.length > 0 && (
        <ul className="video-marks">
          {marks.map((mark, index) => (
            <li key={`${mark.timestampSec}-${index}`}>
              <span>Mistake at {format(mark.timestampSec)}</span>
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={() => removeMark(index)}
                title="Remove"
                aria-label={`Remove mark at ${format(mark.timestampSec)}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DragDropAnswer({ question, answer, onChange }) {
  if (question.content.mode === 'sequence') {
    const items = question.content.items;
    const order = answer?.order?.length ? answer.order : items.map((item) => item.id);
    const textById = new Map(items.map((item) => [item.id, item.text]));
    const move = (index, direction) => {
      const next = [...order];
      const swap = index + direction;
      if (swap < 0 || swap >= next.length) return;
      [next[index], next[swap]] = [next[swap], next[index]];
      onChange({ order: next });
    };
    return (
      <div>
        <p className="answer-hint">Arrange the items into the correct sequence.</p>
        <ul className="sequence-list">
          {order.map((id, index) => (
            <li key={id} className="sequence-item">
              <span className="sequence-number">{index + 1}.</span>
              <span className="sequence-text">{textById.get(id)}</span>
              <span className="sequence-controls">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  data-tooltip="Move up"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(index, 1)}
                  disabled={index === order.length - 1}
                  data-tooltip="Move down"
                  aria-label="Move down"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const pairs = new Map((answer?.pairs || []).map((pair) => [pair.leftId, pair.rightId]));
  const setPair = (leftId, rightId) => {
    const next = new Map(pairs);
    if (rightId) next.set(leftId, rightId);
    else next.delete(leftId);
    onChange({ pairs: [...next.entries()].map(([l, r]) => ({ leftId: l, rightId: r })) });
  };
  return (
    <div>
      <p className="answer-hint">Match each item on the left with the correct item on the right.</p>
      <div className="match-list">
        {question.content.left.map((leftItem) => (
          <div key={leftItem.id} className="match-row">
            <span className="match-left">{leftItem.text}</span>
            <select
              className="field-input match-select"
              value={pairs.get(leftItem.id) || ''}
              onChange={(event) => setPair(leftItem.id, event.target.value)}
            >
              <option value="">Select</option>
              {question.content.right.map((rightItem) => (
                <option key={rightItem.id} value={rightItem.id}>
                  {rightItem.text}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

const COMPONENTS = {
  mcq: McqAnswer,
  true_false: TrueFalseAnswer,
  image_comparison: ImageComparisonAnswer,
  find_mistakes: FindMistakesAnswer,
  hotspot: HotspotAnswer,
  content_review: ContentReviewAnswer,
  video_review: VideoReviewAnswer,
  drag_drop: DragDropAnswer,
  multiple_error_detection: HotspotAnswer // 6.9 — click each mistake on the image
};

export default function AnswerInput({ question, answer, onChange }) {
  const Component = COMPONENTS[question.type];
  if (!Component) return <p>Unsupported question type.</p>;
  return <Component question={question} answer={answer} onChange={onChange} />;
}
