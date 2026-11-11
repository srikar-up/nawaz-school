import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import PhotoCropDialog from './PhotoCropDialog';
import { api } from '../lib/api';
import { isAcceptedImage } from '../lib/image';
import { uploadProfilePhoto } from '../lib/upload';

const MAX_FILE_BYTES = 12 * 1024 * 1024;

/**
 * Avatar with an optional upload control.
 *
 * Choosing a file opens the crop dialog first: preview, zoom, rotate and drag
 * before anything is uploaded. lib/upload.js then compresses to WebP, requests
 * a signature for this exact record, uploads, and persists the metadata.
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
  const [cropFile, setCropFile] = useState(null);

  const editable = !readOnly && Boolean(id);

  const choose = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    if (!isAcceptedImage(file)) {
      setError('Choose a PNG, JPG or WebP image.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Choose an image smaller than 12 MB.');
      return;
    }
    setCropFile(file);
  };

  const saveCropped = async (cropped) => {
    setBusy(true);
    setProgress(0);
    try {
      await uploadProfilePhoto(cropped, { kind, id, onProgress: setProgress });
      await onSaved?.();
      setCropFile(null);
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
        <Avatar name={name} size={size} photo={photo} />
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

      {cropFile ? (
        <PhotoCropDialog
          file={cropFile}
          progress={progress}
          onCancel={() => (busy ? null : setCropFile(null))}
          onSave={saveCropped}
        />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        hidden
      />
    </div>
  );
}
