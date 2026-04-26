import { useRef, useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import AssetPicker from './AssetPicker';

export default function SpritesheetPanel() {
  const spritesheets = useStore((s) => s.spritesheets);
  const activeSpritesheetId = useStore((s) => s.activeSpritesheetId);
  const activeAnimationIndex = useStore((s) => s.activeAnimationIndex);
  const addSpritesheet = useStore((s) => s.addSpritesheet);
  const removeSpritesheet = useStore((s) => s.removeSpritesheet);
  const setActiveSpritesheet = useStore((s) => s.setActiveSpritesheet);
  const setActiveAnimationIndex = useStore((s) => s.setActiveAnimationIndex);
  const activeFrame = useStore((s) => s.activeFrame);
  const setActiveFrame = useStore((s) => s.setActiveFrame);
  const setActiveTool = useStore((s) => s.setActiveTool);

  const [frameWidth, setFrameWidth] = useState(32);
  const [frameHeight, setFrameHeight] = useState(32);
  const [isDragging, setIsDragging] = useState(false);
  const [imageCache, setImageCache] = useState({});
  const [expandedAnims, setExpandedAnims] = useState({}); // { animIndex: true }

  const activeSpritesheet = spritesheets.find((s) => s.id === activeSpritesheetId);

  useEffect(() => {
    spritesheets.forEach((ss) => {
      if (!imageCache[ss.id]) {
        const img = new Image();
        img.onload = () => setImageCache((prev) => ({ ...prev, [ss.id]: img }));
        img.src = ss.dataUrl;
      }
    });
  }, [spritesheets]);

  const importSpritesheet = useCallback(
    (imageFile, meta) => {
      if (!imageFile || !imageFile.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const fw = meta?.frameWidth || frameWidth;
          const fh = meta?.frameHeight || frameHeight;
          const cols = Math.floor(img.width / fw);
          const rows = Math.floor(img.height / fh);
          const animations = meta?.animations
            ? meta.animations.map((a) => ({
                name: a.name,
                row: a.row,
                frameCount: Math.min(a.frameCount, cols),
              }))
            : Array.from({ length: rows }, (_, r) => ({
                name: `Animation ${r + 1}`,
                row: r,
                frameCount: cols,
              }));
          const spritesheet = {
            id: `ss-${Date.now()}`,
            name: imageFile.name,
            dataUrl,
            imageWidth: img.width,
            imageHeight: img.height,
            frameWidth: fw,
            frameHeight: fh,
            cols,
            rows,
            animations,
          };
          addSpritesheet(spritesheet);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(imageFile);
    },
    [frameWidth, frameHeight, addSpritesheet]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((f) => f.type.startsWith('image/'));
      const jsonFile = files.find((f) => f.name.endsWith('.json'));

      if (!imageFile) return;

      if (jsonFile) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const meta = JSON.parse(ev.target.result);
            importSpritesheet(imageFile, meta);
          } catch {
            importSpritesheet(imageFile, null);
          }
        };
        reader.readAsText(jsonFile);
      } else {
        importSpritesheet(imageFile, null);
      }
    },
    [importSpritesheet]
  );

  const updateAnimationName = (ssId, animIdx, name) => {
    const ss = spritesheets.find((s) => s.id === ssId);
    if (!ss) return;
    const newAnims = [...ss.animations];
    newAnims[animIdx] = { ...newAnims[animIdx], name };
    // Directly update the spritesheet in the store
    useStore.setState((state) => ({
      spritesheets: state.spritesheets.map((s) =>
        s.id === ssId ? { ...s, animations: newAnims } : s
      ),
    }));
  };

  const updateAnimationFrameCount = (ssId, animIdx, count) => {
    const ss = spritesheets.find((s) => s.id === ssId);
    if (!ss) return;
    const clamped = Math.max(1, Math.min(count, ss.cols));
    const newAnims = [...ss.animations];
    newAnims[animIdx] = { ...newAnims[animIdx], frameCount: clamped };
    useStore.setState((state) => ({
      spritesheets: state.spritesheets.map((s) =>
        s.id === ssId ? { ...s, animations: newAnims } : s
      ),
    }));
  };

  return (
    <div className="panel spritesheet-panel">
      <div className="panel-header">Objects</div>

      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="drop-zone-content">
          <span className="drop-icon">+</span>
          <span>Drop PNG + JSON here</span>
          <label className="file-input-label">
            or browse
            <input
              type="file"
              accept="image/*,.json"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files);
                const imageFile = files.find((f) => f.type.startsWith('image/'));
                const jsonFile = files.find((f) => f.name.endsWith('.json'));
                if (imageFile && jsonFile) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const meta = JSON.parse(ev.target.result);
                      importSpritesheet(imageFile, meta);
                    } catch {
                      importSpritesheet(imageFile, null);
                    }
                  };
                  reader.readAsText(jsonFile);
                } else if (imageFile) {
                  importSpritesheet(imageFile, null);
                }
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <div className="tile-size-input">
          <label>
            Frame:
            <input
              type="number"
              min="8"
              max="512"
              value={frameWidth}
              onChange={(e) => setFrameWidth(Number(e.target.value))}
              style={{ width: 40 }}
            />
            x
            <input
              type="number"
              min="8"
              max="512"
              value={frameHeight}
              onChange={(e) => setFrameHeight(Number(e.target.value))}
              style={{ width: 40 }}
            />
            px
          </label>
        </div>
      </div>

      {spritesheets.length > 0 && (
        <AssetPicker
          items={spritesheets}
          activeId={activeSpritesheetId}
          onSelect={setActiveSpritesheet}
          onRemove={removeSpritesheet}
          label="spritesheet"
        />
      )}

      {activeSpritesheet && (
        <div className="animation-list">
          {activeSpritesheet.animations.map((anim, idx) => {
            const isExpanded = expandedAnims[idx];
            const isActive = idx === activeAnimationIndex && activeFrame === null;
            return (
              <div key={idx} className="animation-entry">
                <div
                  className={`animation-item ${isActive ? 'active' : ''} ${
                    idx === activeAnimationIndex && activeFrame !== null ? 'has-frame-selected' : ''
                  }`}
                  onClick={() => {
                    setActiveAnimationIndex(idx);
                    setActiveFrame(null);
                    setActiveTool('object');
                  }}
                >
                  <AnimationPreview
                    spritesheet={activeSpritesheet}
                    animIndex={idx}
                    imageCache={imageCache}
                  />
                  <div className="animation-info">
                    <input
                      className="animation-name-input"
                      value={anim.name}
                      onChange={(e) => updateAnimationName(activeSpritesheet.id, idx, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="animation-meta">
                      <label onClick={(e) => e.stopPropagation()}>
                        Frames:
                        <input
                          type="number"
                          min="1"
                          max={activeSpritesheet.cols}
                          value={anim.frameCount}
                          onChange={(e) =>
                            updateAnimationFrameCount(activeSpritesheet.id, idx, Number(e.target.value))
                          }
                        />
                      </label>
                    </div>
                  </div>
                  {anim.frameCount > 1 && (
                    <button
                      className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedAnims((prev) => ({ ...prev, [idx]: !prev[idx] }));
                      }}
                      title={isExpanded ? 'Collapse frames' : 'Expand frames'}
                    >
                      {isExpanded ? '\u25B2' : '\u25BC'}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="frame-grid">
                    {Array.from({ length: anim.frameCount }, (_, f) => (
                      <div
                        key={f}
                        className={`frame-cell ${
                          idx === activeAnimationIndex && activeFrame === f ? 'active' : ''
                        }`}
                        onClick={() => {
                          setActiveAnimationIndex(idx);
                          setActiveFrame(f);
                          setActiveTool('object');
                        }}
                        title={`Frame ${f}`}
                      >
                        <FramePreview
                          spritesheet={activeSpritesheet}
                          animIndex={idx}
                          frameIndex={f}
                          imageCache={imageCache}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnimationPreview({ spritesheet, animIndex, imageCache }) {
  const canvasRef = useRef(null);
  const anim = spritesheet.animations[animIndex];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = imageCache[spritesheet.id];
    if (!img) return;

    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    const fw = spritesheet.frameWidth;
    const fh = spritesheet.frameHeight;
    const scale = Math.min(size / fw, size / fh);
    const dw = fw * scale;
    const dh = fh * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    ctx.drawImage(
      img,
      0, anim.row * fh, fw, fh,
      dx, dy, dw, dh
    );
  }, [spritesheet, animIndex, imageCache, anim]);

  return <canvas ref={canvasRef} className="animation-preview-canvas" />;
}

function FramePreview({ spritesheet, animIndex, frameIndex, imageCache }) {
  const canvasRef = useRef(null);
  const anim = spritesheet.animations[animIndex];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = imageCache[spritesheet.id];
    if (!img) return;

    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    const fw = spritesheet.frameWidth;
    const fh = spritesheet.frameHeight;
    const scale = Math.min(size / fw, size / fh);
    const dw = fw * scale;
    const dh = fh * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    ctx.drawImage(
      img,
      frameIndex * fw, anim.row * fh, fw, fh,
      dx, dy, dw, dh
    );
  }, [spritesheet, animIndex, frameIndex, imageCache, anim]);

  return <canvas ref={canvasRef} className="frame-preview-canvas" />;
}
