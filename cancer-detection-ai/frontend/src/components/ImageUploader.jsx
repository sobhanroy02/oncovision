/**
 * Drag-and-drop image uploader.
 * Validates file type and size, shows preview.
 */
import React, { useRef, useState } from 'react';
import './ImageUploader.css';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'];
const MAX_SIZE_MB = 10;

function ImageUploader({ onFileSelected, previewUrl, onClear }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  function validate(file) {
    if (!file) return 'No file selected';
    if (!ACCEPTED.includes(file.type) && !file.name.match(/\.(jpe?g|png|tiff?|bmp)$/i)) {
      return 'Unsupported file type. Use JPG, PNG, TIFF, or BMP.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Max ${MAX_SIZE_MB} MB.`;
    }
    return null;
  }

  function handleFile(file) {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError('');
    onFileSelected(file);
  }

  return (
    <div>
      <div
        className={`drop-zone ${dragOver ? 'drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {previewUrl ? (
          <div className="preview">
            <img src={previewUrl} alt="Selected preview" />
            <button
              className="clear-btn"
              onClick={(e) => { e.stopPropagation(); onClear(); setError(''); }}
              aria-label="Clear selection"
            >×</button>
          </div>
        ) : (
          <div className="placeholder">
            <div className="upload-icon">⬆</div>
            <p className="drop-title">Drop your image here</p>
            <p className="drop-sub">or <span className="drop-link">click to browse</span></p>
            <p className="drop-meta">JPG, PNG, TIFF • Max {MAX_SIZE_MB} MB</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/tiff,image/bmp,.jpg,.jpeg,.png,.tif,.tiff,.bmp"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}

export default ImageUploader;