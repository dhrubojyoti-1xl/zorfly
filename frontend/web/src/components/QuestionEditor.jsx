import { useRef, useState } from 'react';
import Button from './Button.jsx';
import FileUpload from './FileUpload.jsx';
import TextField from './TextField.jsx';
import { mediaUrl } from '../utils/media.js';

// Author-side content editors for every question type. Receives content and
// calls onChange(nextContent). IDs are generated locally (o1, m1, z1…).

let idCounter = 1;
const nextId = (prefix) => `${prefix}${Date.now().toString(36)}${idCounter++}`;

function McqEditor({ content, onChange }) {
  const options = content.options || [];
  const correct = new Set(content.correctOptionIds || []);
  const update = (patch) => onChange({ ...content, ...patch });

  const setOptionText = (id, text) =>
    update({ options: options.map((option) => (option.id === id ? { ...option, text } : option)) });
  const addOption = () => update({ options: [...options, { id: nextId('o'), text: '' }] });
  const removeOption = (id) =>
    update({
      options: options.filter((option) => option.id !== id),
      correctOptionIds: (content.correctOptionIds || []).filter((cid) => cid !== id)
    });
  const toggleCorrect = (id) => {
    let next;
    if (content.multiple) {
      next = new Set(correct);
      if (next.has(id)) next.delete(id);
      else next.add(id);
    } else {
      next = new Set([id]);
    }
    update({ correctOptionIds: [...next] });
  };

  return (
    <div>
      <div className="editor-toggles">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(content.multiple)}
            onChange={(event) =>
              update({
                multiple: event.target.checked,
                correctOptionIds: event.target.checked
                  ? content.correctOptionIds || []
                  : (content.correctOptionIds || []).slice(0, 1)
              })
            }
          />
          <span>Multiple correct answers</span>
        </label>
        {content.multiple && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(content.partialCredit)}
              onChange={(event) => update({ partialCredit: event.target.checked })}
            />
            <span>Partial credit</span>
          </label>
        )}
      </div>
      {options.map((option, index) => (
        <div key={option.id} className="editor-row">
          <label className="checkbox-label" title="Mark as correct">
            <input
              type={content.multiple ? 'checkbox' : 'radio'}
              checked={correct.has(option.id)}
              onChange={() => toggleCorrect(option.id)}
            />
          </label>
          <input
            type="text"
            className="field-input"
            placeholder={`Enter Option ${index + 1}`}
            value={option.text}
            maxLength={500}
            onChange={(event) => setOptionText(option.id, event.target.value)}
          />
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            onClick={() => removeOption(option.id)}
            data-tooltip="Remove option"
            aria-label="Remove option"
          >
            ✕
          </button>
        </div>
      ))}
      <Button variant="secondary" onClick={addOption}>
        Add Option
      </Button>
      <p className="answer-hint">Tick the correct option(s).</p>
    </div>
  );
}

function TrueFalseEditor({ content, onChange }) {
  return (
    <div className="editor-toggles">
      <span className="field-label">
        Correct Answer<span className="required-mark">*</span>
      </span>
      {[
        { value: true, label: 'True' },
        { value: false, label: 'False' }
      ].map((option) => (
        <label key={String(option.value)} className="checkbox-label">
          <input
            type="radio"
            checked={content.correctAnswer === option.value}
            onChange={() => onChange({ ...content, correctAnswer: option.value })}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

// Normalise legacy {imageAUrl,imageBUrl,correctImage} → {images,correctImageId}.
function normImageCompare(content) {
  if (Array.isArray(content.images)) {
    return { images: content.images, correctImageId: content.correctImageId || '' };
  }
  const images = [];
  if (content.imageAUrl) images.push({ id: 'a', url: content.imageAUrl });
  if (content.imageBUrl) images.push({ id: 'b', url: content.imageBUrl });
  const correctImageId =
    content.correctImage === 'A' ? 'a' : content.correctImage === 'B' ? 'b' : '';
  return { images, correctImageId };
}

function ImageComparisonEditor({ content, onChange }) {
  const { images, correctImageId } = normImageCompare(content);
  const emit = (nextImages, nextCorrect) =>
    onChange({
      images: nextImages,
      correctImageId: nextCorrect !== undefined ? nextCorrect : correctImageId
    });
  const setUrl = (id, url) => emit(images.map((im) => (im.id === id ? { ...im, url } : im)));
  const addImage = () => emit([...images, { id: nextId('img'), url: '' }]);
  const removeImage = (id) =>
    emit(
      images.filter((im) => im.id !== id),
      correctImageId === id ? '' : correctImageId
    );

  return (
    <div>
      <p className="answer-hint" style={{ marginBottom: '0.8rem' }}>
        Add 2–6 images and mark the one that is correct.
      </p>
      <div className="image-editor-grid">
        {images.map((image, index) => (
          <div key={image.id} className="image-editor-item">
            <div className="field-label-row">
              <span className="field-label">Image {index + 1}</span>
              {images.length > 2 && (
                <button type="button" className="link-btn" onClick={() => removeImage(image.id)}>
                  Remove
                </button>
              )}
            </div>
            <FileUpload
              label={`Image ${index + 1}`}
              hideLabel
              accept="image/*"
              value={image.url || ''}
              onChange={(url) => setUrl(image.id, url)}
            />
            <label className="checkbox-label image-correct-radio">
              <input
                type="radio"
                name="correctImage"
                checked={correctImageId === image.id}
                onChange={() => emit(images, image.id)}
              />
              <span>Correct answer</span>
            </label>
          </div>
        ))}
      </div>
      {images.length < 6 && (
        <Button variant="secondary" onClick={addImage}>
          ＋ Add Image
        </Button>
      )}
    </div>
  );
}

function LabelListEditor({ title, items, onChange, prefix }) {
  const setLabel = (id, label) =>
    onChange(items.map((item) => (item.id === id ? { ...item, label } : item)));
  return (
    <div className="field">
      <span className="field-label">{title}</span>
      {items.map((item) => (
        <div key={item.id} className="editor-row">
          <input
            type="text"
            className="field-input"
            placeholder="Enter Mistake Description"
            value={item.label}
            maxLength={200}
            onChange={(event) => setLabel(item.id, event.target.value)}
          />
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            onClick={() => onChange(items.filter((i) => i.id !== item.id))}
            data-tooltip="Remove"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => onChange([...items, { id: nextId(prefix), label: '' }])}
      >
        Add
      </Button>
    </div>
  );
}

function FindMistakesEditor({ content, onChange }) {
  const mode = content.mode || 'checklist';
  return (
    <div>
      <FileUpload
        label="Creative Image"
        accept="image/*"
        required
        value={content.imageUrl || ''}
        onChange={(url) => onChange({ ...content, imageUrl: url })}
      />
      <div className="editor-toggles">
        <span className="field-label">
          Answer Mode<span className="required-mark">*</span>
        </span>
        {[
          { value: 'checklist', label: 'Checklist (auto-scored)' },
          { value: 'typed', label: 'Typed answers (manual review queue)' }
        ].map((option) => (
          <label key={option.value} className="checkbox-label">
            <input
              type="radio"
              checked={mode === option.value}
              onChange={() =>
                onChange({
                  ...content,
                  mode: option.value,
                  distractors: option.value === 'typed' ? [] : content.distractors || []
                })
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <LabelListEditor
        title="Mistakes present in the image (the candidate must find these)"
        items={content.mistakes || []}
        onChange={(mistakes) => onChange({ ...content, mistakes })}
        prefix="m"
      />
      {mode === 'checklist' && (
        <LabelListEditor
          title="Distractors (NOT actually in the image — wrong claims can attract negative marks)"
          items={content.distractors || []}
          onChange={(distractors) => onChange({ ...content, distractors })}
          prefix="d"
        />
      )}
    </div>
  );
}

function HotspotEditor({ content, onChange }) {
  const imageRef = useRef(null);
  const [draft, setDraft] = useState(null); // {x1,y1,x2,y2} while dragging
  const zones = content.zones || [];

  const pointFrom = (event) => {
    const rect = imageRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    };
  };

  const onMouseDown = (event) => {
    event.preventDefault();
    const point = pointFrom(event);
    setDraft({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
  };
  const onMouseMove = (event) => {
    if (!draft) return;
    const point = pointFrom(event);
    setDraft({ ...draft, x2: point.x, y2: point.y });
  };
  const onMouseUp = () => {
    if (!draft) return;
    const x = Math.min(draft.x1, draft.x2);
    const y = Math.min(draft.y1, draft.y2);
    const w = Math.abs(draft.x2 - draft.x1);
    const h = Math.abs(draft.y2 - draft.y1);
    setDraft(null);
    if (w < 0.01 || h < 0.01) return; // ignore accidental clicks
    onChange({
      ...content,
      zones: [
        ...zones,
        {
          id: nextId('z'),
          label: `Zone ${zones.length + 1}`,
          x: Math.round(x * 1000) / 1000,
          y: Math.round(y * 1000) / 1000,
          w: Math.round(w * 1000) / 1000,
          h: Math.round(h * 1000) / 1000
        }
      ]
    });
  };

  const setZoneLabel = (id, label) =>
    onChange({
      ...content,
      zones: zones.map((zone) => (zone.id === id ? { ...zone, label } : zone))
    });

  return (
    <div>
      <FileUpload
        label="Image"
        accept="image/*"
        required
        value={content.imageUrl || ''}
        onChange={(url) => onChange({ ...content, imageUrl: url })}
      />
      {content.imageUrl && (
        <>
          <p className="answer-hint">Drag on the image to draw an answer zone over each mistake.</p>
          <div
            className="hotspot-wrap hotspot-editor"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <img
              ref={imageRef}
              src={mediaUrl(content.imageUrl)}
              alt="Hotspot"
              className="question-image"
              draggable={false}
            />
            {zones.map((zone, index) => (
              <span
                key={zone.id}
                className="hotspot-zone"
                style={{
                  left: `${zone.x * 100}%`,
                  top: `${zone.y * 100}%`,
                  width: `${zone.w * 100}%`,
                  height: `${zone.h * 100}%`
                }}
              >
                {index + 1}
              </span>
            ))}
            {draft && (
              <span
                className="hotspot-zone hotspot-zone-draft"
                style={{
                  left: `${Math.min(draft.x1, draft.x2) * 100}%`,
                  top: `${Math.min(draft.y1, draft.y2) * 100}%`,
                  width: `${Math.abs(draft.x2 - draft.x1) * 100}%`,
                  height: `${Math.abs(draft.y2 - draft.y1) * 100}%`
                }}
              />
            )}
          </div>
          {zones.map((zone, index) => (
            <div key={zone.id} className="editor-row">
              <span className="sequence-number">{index + 1}.</span>
              <input
                type="text"
                className="field-input"
                placeholder="Enter Zone Label"
                value={zone.label}
                maxLength={200}
                onChange={(event) => setZoneLabel(zone.id, event.target.value)}
              />
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={() =>
                  onChange({ ...content, zones: zones.filter((z) => z.id !== zone.id) })
                }
                data-tooltip="Remove zone"
                aria-label="Remove zone"
              >
                ✕
              </button>
            </div>
          ))}
          <TextField
            label="Click Tolerance (% of image)"
            name="tolerancePct"
            type="number"
            value={content.tolerancePct ?? 2}
            onChange={(event) => onChange({ ...content, tolerancePct: Number(event.target.value) })}
            placeholder="2"
          />
        </>
      )}
    </div>
  );
}

function ContentReviewEditor({ content, onChange }) {
  const words = (content.text || '').split(/\s+/).filter(Boolean);
  const errors = content.errors || [];
  const errorByIndex = new Map(errors.map((error) => [error.wordIndex, error]));

  const toggleWord = (index) => {
    if (errorByIndex.has(index)) {
      onChange({ ...content, errors: errors.filter((error) => error.wordIndex !== index) });
    } else {
      onChange({
        ...content,
        errors: [...errors, { id: nextId('e'), wordIndex: index, correction: '', explanation: '' }]
      });
    }
  };
  const setErrorField = (id, field, value) =>
    onChange({
      ...content,
      errors: errors.map((error) => (error.id === id ? { ...error, [field]: value } : error))
    });

  return (
    <div>
      <div className="field">
        <label className="field-label" htmlFor="content-text">
          Paragraph<span className="required-mark">*</span>
        </label>
        <textarea
          id="content-text"
          className="field-input field-textarea"
          placeholder="Paste the paragraph containing the mistakes"
          value={content.text || ''}
          maxLength={10000}
          onChange={(event) => onChange({ ...content, text: event.target.value, errors: [] })}
        />
      </div>
      {words.length > 0 && (
        <>
          <p className="answer-hint">Click each word that is wrong, then add its correction.</p>
          <p className="content-review-text">
            {words.map((word, index) => (
              <button
                key={`${word}-${index}`}
                type="button"
                className={`word-token${errorByIndex.has(index) ? ' selected' : ''}`}
                onClick={() => toggleWord(index)}
              >
                {word}
              </button>
            ))}
          </p>
          {errors.map((error) => (
            <div key={error.id} className="editor-error-block">
              <span className="field-label">"{words[error.wordIndex]}"</span>
              <div className="editor-two-col">
                <input
                  type="text"
                  className="field-input"
                  placeholder="Enter Correction"
                  value={error.correction}
                  maxLength={500}
                  onChange={(event) => setErrorField(error.id, 'correction', event.target.value)}
                />
                <input
                  type="text"
                  className="field-input"
                  placeholder="Enter Explanation"
                  value={error.explanation}
                  maxLength={1000}
                  onChange={(event) => setErrorField(error.id, 'explanation', event.target.value)}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function VideoReviewEditor({ content, onChange }) {
  const videoRef = useRef(null);
  const mistakes = content.mistakes || [];

  const addMistake = () => {
    const timestampSec = Math.round((videoRef.current?.currentTime || 0) * 10) / 10;
    videoRef.current?.pause();
    onChange({
      ...content,
      mistakes: [...mistakes, { id: nextId('v'), timestampSec, label: '' }]
    });
  };
  const setMistake = (id, patch) =>
    onChange({
      ...content,
      mistakes: mistakes.map((mistake) => (mistake.id === id ? { ...mistake, ...patch } : mistake))
    });

  const format = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  return (
    <div>
      <FileUpload
        label="Video"
        accept="video/*"
        required
        value={content.videoUrl || ''}
        onChange={(url) => onChange({ ...content, videoUrl: url })}
      />
      {content.videoUrl && (
        <>
          <video
            ref={videoRef}
            src={mediaUrl(content.videoUrl)}
            controls
            className="question-video"
          />
          <p className="answer-hint">
            Play the video, pause at each mistake and press "Add mistake at current time".
          </p>
          <Button variant="secondary" onClick={addMistake}>
            Add mistake at current time
          </Button>
          {mistakes.map((mistake) => (
            <div key={mistake.id} className="editor-row">
              <span className="sequence-number">{format(mistake.timestampSec)}</span>
              <input
                type="text"
                className="field-input"
                placeholder="Enter Mistake Description"
                value={mistake.label}
                maxLength={200}
                onChange={(event) => setMistake(mistake.id, { label: event.target.value })}
              />
              <button
                type="button"
                className="icon-btn icon-btn-danger"
                onClick={() =>
                  onChange({ ...content, mistakes: mistakes.filter((m) => m.id !== mistake.id) })
                }
                data-tooltip="Remove"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          <TextField
            label="Timestamp Tolerance (seconds)"
            name="toleranceSec"
            type="number"
            value={content.toleranceSec ?? 2}
            onChange={(event) => onChange({ ...content, toleranceSec: Number(event.target.value) })}
            placeholder="2"
          />
        </>
      )}
    </div>
  );
}

function DragDropEditor({ content, onChange }) {
  const mode = content.mode || 'sequence';

  const setMode = (nextMode) => {
    if (nextMode === 'sequence') {
      onChange({ mode: 'sequence', items: [], correctOrder: [], partialCredit: true });
    } else {
      onChange({ mode: 'match', left: [], right: [], correctPairs: [], partialCredit: true });
    }
  };

  return (
    <div>
      <div className="editor-toggles">
        <span className="field-label">
          Mode<span className="required-mark">*</span>
        </span>
        {[
          { value: 'sequence', label: 'Arrange in sequence' },
          { value: 'match', label: 'Match two lists' }
        ].map((option) => (
          <label key={option.value} className="checkbox-label">
            <input
              type="radio"
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      {mode === 'sequence' ? (
        <SequenceEditor content={content} onChange={onChange} />
      ) : (
        <MatchEditor content={content} onChange={onChange} />
      )}
    </div>
  );
}

function SequenceEditor({ content, onChange }) {
  const items = content.items || [];
  const sync = (nextItems) =>
    onChange({ ...content, items: nextItems, correctOrder: nextItems.map((item) => item.id) });
  return (
    <div className="field">
      <span className="field-label">Items in the CORRECT order (candidates see them shuffled)</span>
      {items.map((item, index) => (
        <div key={item.id} className="editor-row">
          <span className="sequence-number">{index + 1}.</span>
          <input
            type="text"
            className="field-input"
            placeholder="Enter Item Text"
            value={item.text}
            maxLength={300}
            onChange={(event) =>
              sync(items.map((i) => (i.id === item.id ? { ...i, text: event.target.value } : i)))
            }
          />
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            onClick={() => sync(items.filter((i) => i.id !== item.id))}
            data-tooltip="Remove"
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      ))}
      <Button variant="secondary" onClick={() => sync([...items, { id: nextId('i'), text: '' }])}>
        Add Item
      </Button>
    </div>
  );
}

function MatchEditor({ content, onChange }) {
  const left = content.left || [];
  const right = content.right || [];
  const pairs = new Map((content.correctPairs || []).map((pair) => [pair.leftId, pair.rightId]));

  const addPairRow = () => {
    const leftItem = { id: nextId('l'), text: '' };
    const rightItem = { id: nextId('r'), text: '' };
    onChange({
      ...content,
      left: [...left, leftItem],
      right: [...right, rightItem],
      correctPairs: [
        ...(content.correctPairs || []),
        { leftId: leftItem.id, rightId: rightItem.id }
      ]
    });
  };
  const setText = (side, id, text) =>
    onChange({
      ...content,
      [side]: (side === 'left' ? left : right).map((item) =>
        item.id === id ? { ...item, text } : item
      )
    });
  const removeRow = (leftId) => {
    const rightId = pairs.get(leftId);
    onChange({
      ...content,
      left: left.filter((item) => item.id !== leftId),
      right: right.filter((item) => item.id !== rightId),
      correctPairs: (content.correctPairs || []).filter((pair) => pair.leftId !== leftId)
    });
  };

  return (
    <div className="field">
      <span className="field-label">
        Matching pairs (left ↔ right; candidates see the right side shuffled)
      </span>
      {left.map((leftItem) => (
        <div key={leftItem.id} className="editor-row">
          <input
            type="text"
            className="field-input"
            placeholder="Enter Left Item"
            value={leftItem.text}
            maxLength={300}
            onChange={(event) => setText('left', leftItem.id, event.target.value)}
          />
          <span>↔</span>
          <input
            type="text"
            className="field-input"
            placeholder="Enter Right Item"
            value={right.find((item) => item.id === pairs.get(leftItem.id))?.text || ''}
            maxLength={300}
            onChange={(event) => setText('right', pairs.get(leftItem.id), event.target.value)}
          />
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            onClick={() => removeRow(leftItem.id)}
            data-tooltip="Remove pair"
            aria-label="Remove pair"
          >
            ✕
          </button>
        </div>
      ))}
      <Button variant="secondary" onClick={addPairRow}>
        Add Pair
      </Button>
    </div>
  );
}

const EDITORS = {
  mcq: McqEditor,
  true_false: TrueFalseEditor,
  image_comparison: ImageComparisonEditor,
  find_mistakes: FindMistakesEditor,
  hotspot: HotspotEditor,
  content_review: ContentReviewEditor,
  video_review: VideoReviewEditor,
  drag_drop: DragDropEditor,
  multiple_error_detection: HotspotEditor // 6.9 — mark 5–20 mistakes on the image
};

export const EMPTY_CONTENT = {
  mcq: { options: [], correctOptionIds: [], multiple: false, partialCredit: false },
  true_false: { correctAnswer: null },
  image_comparison: {
    images: [
      { id: 'img1', url: '' },
      { id: 'img2', url: '' }
    ],
    correctImageId: ''
  },
  find_mistakes: { imageUrl: '', mistakes: [], distractors: [] },
  hotspot: { imageUrl: '', zones: [], tolerancePct: 2 },
  content_review: { text: '', errors: [] },
  video_review: { videoUrl: '', toleranceSec: 2, mistakes: [] },
  drag_drop: { mode: 'sequence', items: [], correctOrder: [], partialCredit: true },
  multiple_error_detection: { imageUrl: '', zones: [], tolerancePct: 2 }
};

export default function QuestionEditor({ type, content, onChange }) {
  const Editor = EDITORS[type];
  if (!Editor) return null;
  return <Editor content={content} onChange={onChange} />;
}
