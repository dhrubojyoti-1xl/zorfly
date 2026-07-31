import { useEffect, useRef, useState } from 'react';
import { api, apiError } from '../api/client.js';
import { mediaUrl } from '../utils/media.js';
import { useToast } from '../context/ToastContext.jsx';

// Upload an image/video to the media endpoint and hand back its URL.
export default function FileUpload({
  label,
  accept,
  value,
  onChange,
  required = false,
  hideLabel = false
}) {
  const inputRef = useRef(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  // The upload itself succeeded (we have a stored URL) but the browser
  // couldn't load it back — almost always a CDN/S3 delivery problem on the
  // server, not the upload. Shown as a visible placeholder instead of the
  // tiny native broken-image icon, which is easy to miss.
  const [previewFailed, setPreviewFailed] = useState(false);

  // A different question/row can hand this same component instance a new
  // `value` (e.g. switching between image slots) — don't keep showing last
  // slot's load failure against this one.
  useEffect(() => {
    setPreviewFailed(false);
  }, [value]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setPreviewFailed(false);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await api.post('/media/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onChange(response.data.data.url);
      toast.show(response.data.data.message, 'success');
    } catch (error) {
      toast.show(apiError(error).message, 'error');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const isVideo = accept?.includes('video');
  const isDocument = accept?.includes('pdf');

  return (
    <div className="field">
      {!hideLabel && (
        <label className="field-label">
          {label}
          {required && <span className="required-mark">*</span>}
        </label>
      )}
      <div className="upload-row">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          title={`Upload ${label}`}
        >
          {uploading ? 'Uploading…' : value ? 'Replace File' : 'Upload File'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>
      {value && previewFailed && (
        <p className="upload-preview-error">
          Couldn't load this preview — the file uploaded, but the server hosting it isn't serving it
          back. Check the CDN/S3 configuration on this environment.
        </p>
      )}
      {value && !previewFailed && isDocument && (
        <a href={mediaUrl(value)} target="_blank" rel="noreferrer" className="upload-preview-file">
          📄 View uploaded PDF
        </a>
      )}
      {value &&
        !previewFailed &&
        !isDocument &&
        (isVideo ? (
          <video
            src={mediaUrl(value)}
            controls
            className="upload-preview"
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <img
            src={mediaUrl(value)}
            alt={label}
            className="upload-preview"
            onError={() => setPreviewFailed(true)}
          />
        ))}
    </div>
  );
}
