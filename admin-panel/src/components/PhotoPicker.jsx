import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { api } from '../lib/api';
import { avatarUrl } from '../lib/image';
import { uploadProfilePhoto } from '../lib/upload';

/**
 * Avatar with an optional upload control.
 *
 * The heavy lifting lives in lib/upload.js: compress to WebP, request a
 * signature for this exact record, upload, then persist the metadata.
 */
export default function PhotoPicker({
  kind,
  id,
  name,
  photo,
  size = 96,
  onSaved,
  readOnly = false,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const editable = !readOnly && Boolean(id);

  const choose = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setBusy(true);
    setProgress(0);

    try {
      await uploadProfilePhoto(file, { kind, id, onProgress: setProgress });
      await onSaved?.();
    } catch (uploadError) {
      setError(uploadError.message || 'Could not upload that photo.');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const remove = async () => {
    setError('');
    setBusy(true);
    try {
      await api.deletePhoto(kind, id);
      await onSaved?.();
    } catch (removeError) {
      setError(removeError.message || 'Could not remove the photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-picker">
      <button
        type="button"
        className="photo-picker-frame"
        onClick={editable ? choose : undefined}
        disabled={!editable || busy}
        aria-label={editable ? 'Change profile photo' : `${name} photo`}
        style={{ width: size, height: size }}
      >
        <Avatar name={name} size={size} image={avatarUrl(photo, { size: size * 2 })} />
        {editable && (
          <span className="photo-picker-badge" aria-hidden="true">
            {busy ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
          </span>
        )}
      </button>

      {busy && progress > 0 && progress < 100 && (
        <span className="photo-picker-progress" role="status">
          Uploading {progress}%
        </span>
      )}

      {editable && !busy && (
        <div className="photo-picker-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={choose}>
            {photo ? 'Replace' : 'Add photo'}
          </button>
          {photo && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>
              <Trash2 size={14} /> Remove
            </button>
          )}
        </div>
      )}

      {error && (
        <span className="photo-picker-error" role="alert">
          {error}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleFile}
        hidden
      />
    </div>
  );
}
