import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RotateCcw, RotateCw, X, ZoomIn } from 'lucide-react';
import { cropImageToFile } from '../lib/image';

const VIEW = 240;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const PREVIEW_SIZES = [40, 88];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Square crop dialog.
 *
 * The stage is a fixed square. The photo is scaled to cover it, then the user
 * drags it, zooms it and rotates it. The same transform is drawn to a 512px
 * canvas on save, so the saved avatar matches the preview exactly.
 */
export default function PhotoCropDialog({ file, progress = 0, onCancel, onSave }) {
  const [src, setSrc] = useState('');
  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const imageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNatural(null);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setError('');
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !working) onCancel?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel, working]);

  const geometry = useMemo(() => {
    if (!natural) return null;
    const radians = (rotation * Math.PI) / 180;
    const width =
      Math.abs(natural.width * Math.cos(radians)) + Math.abs(natural.height * Math.sin(radians));
    const height =
      Math.abs(natural.width * Math.sin(radians)) + Math.abs(natural.height * Math.cos(radians));
    const scale = Math.max(VIEW / width, VIEW / height) * zoom;
    return {
      width,
      height,
      scale,
      maxX: Math.max(0, (width * scale - VIEW) / 2),
      maxY: Math.max(0, (height * scale - VIEW) / 2),
    };
  }, [natural, rotation, zoom]);

  useEffect(() => {
    if (!geometry) return;
    setOffset((current) => {
      const x = clamp(current.x, -geometry.maxX, geometry.maxX);
      const y = clamp(current.y, -geometry.maxY, geometry.maxY);
      return x === current.x && y === current.y ? current : { x, y };
    });
  }, [geometry]);

  const bounded = geometry
    ? {
        x: clamp(offset.x, -geometry.maxX, geometry.maxX),
        y: clamp(offset.y, -geometry.maxY, geometry.maxY),
      }
    : offset;

  const frameStyle = (target) => {
    const ratio = target / VIEW;
    return {
      width: natural.width * geometry.scale * ratio,
      height: natural.height * geometry.scale * ratio,
      transform: `translate(calc(-50% + ${bounded.x * ratio}px), calc(-50% + ${
        bounded.y * ratio
      }px)) rotate(${rotation}deg)`,
    };
  };

  const startDrag = (event) => {
    if (!geometry || working) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: bounded.x,
      offsetY: bounded.y,
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId || !geometry) return;
    setOffset({
      x: clamp(drag.offsetX + (event.clientX - drag.x), -geometry.maxX, geometry.maxX),
      y: clamp(drag.offsetY + (event.clientY - drag.y), -geometry.maxY, geometry.maxY),
    });
  };

  const endDrag = (event) => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  const rotate = (delta) => {
    setRotation((current) => (current + delta + 360) % 360);
  };

  const reset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const save = async () => {
    if (!geometry || !imageRef.current || working) return;
    setWorking(true);
    setError('');
    try {
      const cropped = await cropImageToFile(imageRef.current, {
        zoom,
        rotation,
        offset: bounded,
        viewSize: VIEW,
      });
      await onSave?.(cropped);
    } catch (saveError) {
      setError(saveError.message || 'Could not prepare that photo.');
    } finally {
      setWorking(false);
    }
  };

  return createPortal(
    <div
      className="photo-crop-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onCancel?.();
      }}
    >
      <div
        className="photo-crop-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-crop-title"
      >
        <div className="photo-crop-head">
          <div>
            <h2 id="photo-crop-title">Adjust your profile photo</h2>
            <p>Drag the photo, then zoom or rotate until the circle looks right.</p>
          </div>
          <button
            type="button"
            className="photo-crop-close"
            onClick={onCancel}
            disabled={working}
            aria-label="Cancel photo edit"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="photo-crop-stage"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="application"
          aria-label="Photo framing area. Drag to reposition the photo."
        >
          {src ? (
            <img
              ref={imageRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(event) =>
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              style={natural && geometry ? frameStyle(VIEW) : { opacity: 0 }}
            />
          ) : null}
          {!natural ? (
            <span className="photo-crop-loading">
              <Loader2 size={18} className="spin" /> Loading photo…
            </span>
          ) : null}
          <span className="photo-crop-ring" aria-hidden="true" />
        </div>

        <div className="photo-crop-preview-row">
          <span className="photo-crop-preview-label">How it will look</span>
          {PREVIEW_SIZES.map((size) => (
            <span
              key={size}
              className="photo-crop-preview"
              style={{ width: size, height: size }}
              aria-hidden="true"
            >
              {src && natural ? (
                <img src={src} alt="" style={frameStyle(size)} draggable={false} />
              ) : null}
            </span>
          ))}
          <span className="photo-crop-preview-hint">Small and large avatar</span>
        </div>

        <label className="photo-crop-zoom">
          <span>
            <ZoomIn size={14} /> Zoom
          </span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Zoom photo"
          />
        </label>

        <div className="photo-crop-tools">
          <button type="button" className="photo-crop-tool" onClick={() => rotate(-90)}>
            <RotateCcw size={15} /> Rotate left
          </button>
          <button type="button" className="photo-crop-tool" onClick={() => rotate(90)}>
            <RotateCw size={15} /> Rotate right
          </button>
          <button type="button" className="photo-crop-tool" onClick={reset}>
            Reset
          </button>
        </div>

        {error ? (
          <p className="photo-crop-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="photo-crop-actions">
          <button
            type="button"
            className="photo-crop-cancel"
            onClick={onCancel}
            disabled={working}
          >
            Cancel
          </button>
          <button
            type="button"
            className="photo-crop-save"
            onClick={save}
            disabled={!natural || working}
          >
            {working ? <Loader2 size={16} className="spin" /> : null}
            {working
              ? progress > 0 && progress < 100
                ? `Uploading ${progress}%`
                : 'Saving…'
              : 'Save photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
