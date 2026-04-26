import { useRef, useState, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import AssetPicker from './AssetPicker';

export default function TilesetPanel() {
  const tilesets = useStore((s) => s.tilesets);
  const activeTilesetId = useStore((s) => s.activeTilesetId);
  const selectedTiles = useStore((s) => s.selectedTiles);
  const addTileset = useStore((s) => s.addTileset);
  const removeTileset = useStore((s) => s.removeTileset);
  const setActiveTileset = useStore((s) => s.setActiveTileset);
  const setSelectedTiles = useStore((s) => s.setSelectedTiles);
  const editingRuleId = useStore((s) => s.editingRuleId);
  const assignTileToSlot = useStore((s) => s.assignTileToSlot);
  const clearActiveTileRule = useStore((s) => s.clearActiveTileRule);

  const [tileSizeInput, setTileSizeInput] = useState(32);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef(null);
  const [imageCache, setImageCache] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);

  const activeTileset = tilesets.find((t) => t.id === activeTilesetId);

  // Load images into cache
  useEffect(() => {
    tilesets.forEach((ts) => {
      if (!imageCache[ts.id]) {
        const img = new Image();
        img.onload = () => {
          setImageCache((prev) => ({ ...prev, [ts.id]: img }));
        };
        img.src = ts.dataUrl;
      }
    });
  }, [tilesets]);

  const handleFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const tileset = {
            id: `tileset-${Date.now()}`,
            name: file.name,
            dataUrl,
            tileWidth: tileSizeInput,
            tileHeight: tileSizeInput,
            imageWidth: img.width,
            imageHeight: img.height,
            cols: Math.floor(img.width / tileSizeInput),
            rows: Math.floor(img.height / tileSizeInput),
          };
          addTileset(tileset);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [tileSizeInput, addTileset]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          handleFile(item.getAsFile());
          break;
        }
      }
    },
    [handleFile]
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Draw tileset on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeTileset) return;
    const img = imageCache[activeTileset.id];
    if (!img) return;

    const cols = activeTileset.cols;
    const rows = activeTileset.rows;
    const tw = activeTileset.tileWidth;
    const th = activeTileset.tileHeight;
    const displayTileSize = 32;

    canvas.width = cols * displayTileSize;
    canvas.height = rows * displayTileSize;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.drawImage(
          img,
          c * tw,
          r * th,
          tw,
          th,
          c * displayTileSize,
          r * displayTileSize,
          displayTileSize,
          displayTileSize
        );
      }
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * displayTileSize + 0.5, 0);
      ctx.lineTo(c * displayTileSize + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * displayTileSize + 0.5);
      ctx.lineTo(canvas.width, r * displayTileSize + 0.5);
      ctx.stroke();
    }

    // Draw selection highlight
    const sel = selEnd || (selectedTiles?.tilesetId === activeTileset.id ? selectedTiles : null);
    if (sel) {
      const startCol = sel.startCol ?? sel.startCol;
      const startRow = sel.startRow ?? sel.startRow;
      const endCol = sel.endCol ?? sel.endCol;
      const endRow = sel.endRow ?? sel.endRow;
      const sx = Math.min(startCol, endCol);
      const sy = Math.min(startRow, endRow);
      const ex = Math.max(startCol, endCol);
      const ey = Math.max(startRow, endRow);

      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(79, 195, 247, 0.25)';
      ctx.fillRect(
        sx * displayTileSize,
        sy * displayTileSize,
        (ex - sx + 1) * displayTileSize,
        (ey - sy + 1) * displayTileSize
      );
      ctx.strokeRect(
        sx * displayTileSize,
        sy * displayTileSize,
        (ex - sx + 1) * displayTileSize,
        (ey - sy + 1) * displayTileSize
      );
    }
  }, [activeTileset, imageCache, selectedTiles, selEnd]);

  const getTileCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const displayTileSize = 32;
    const col = Math.floor((e.clientX - rect.left) / displayTileSize);
    const row = Math.floor((e.clientY - rect.top) / displayTileSize);
    return { col, row };
  };

  const handleCanvasMouseDown = (e) => {
    if (!activeTileset) return;
    const { col, row } = getTileCoords(e);
    if (col < 0 || col >= activeTileset.cols || row < 0 || row >= activeTileset.rows)
      return;

    // If editing a tile rule, assign to slot instead of selecting
    if (editingRuleId) {
      e.preventDefault();
      const autoAdvance = e.ctrlKey || e.metaKey;
      assignTileToSlot(activeTileset.id, col, row, autoAdvance);
      return;
    }

    setSelecting(true);
    setSelStart({ col, row });
    setSelEnd({
      tilesetId: activeTileset.id,
      startCol: col,
      startRow: row,
      endCol: col,
      endRow: row,
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!selecting || !selStart || !activeTileset) return;
    const { col, row } = getTileCoords(e);
    const clampedCol = Math.max(0, Math.min(col, activeTileset.cols - 1));
    const clampedRow = Math.max(0, Math.min(row, activeTileset.rows - 1));
    setSelEnd({
      tilesetId: activeTileset.id,
      startCol: Math.min(selStart.col, clampedCol),
      startRow: Math.min(selStart.row, clampedRow),
      endCol: Math.max(selStart.col, clampedCol),
      endRow: Math.max(selStart.row, clampedRow),
    });
  };

  const handleCanvasMouseUp = () => {
    if (!selecting || !selEnd) return;
    setSelecting(false);
    setSelectedTiles(selEnd);
    clearActiveTileRule();
    setSelEnd(null);
    setSelStart(null);
  };

  return (
    <div className={`panel tileset-panel ${editingRuleId ? 'rule-assign-mode' : ''}`}>
      <div className="panel-header">
        Tilesets
        {editingRuleId && <span className="assign-mode-badge">Assign Mode</span>}
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="drop-zone-content">
          <span className="drop-icon">+</span>
          <span>Drop tileset image here</span>
          <label className="file-input-label">
            or browse
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        <div className="tile-size-input">
          <label>
            Tile size:
            <input
              type="number"
              min="8"
              max="256"
              value={tileSizeInput}
              onChange={(e) => setTileSizeInput(Number(e.target.value))}
            />
            px
          </label>
        </div>
      </div>

      {/* Tileset selector */}
      {tilesets.length > 0 && (
        <AssetPicker
          items={tilesets}
          activeId={activeTilesetId}
          onSelect={setActiveTileset}
          onRemove={removeTileset}
          label="tileset"
        />
      )}

      {/* Tile grid */}
      {activeTileset && (
        <div className="tileset-grid-container">
          <canvas
            ref={canvasRef}
            className="tileset-canvas"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => {
              if (selecting) handleCanvasMouseUp();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              // On macOS, Ctrl+Click fires as contextmenu instead of mousedown
              if (editingRuleId && activeTileset) {
                const { col, row } = getTileCoords(e);
                if (col >= 0 && col < activeTileset.cols && row >= 0 && row < activeTileset.rows) {
                  assignTileToSlot(activeTileset.id, col, row, true);
                }
              }
            }}
          />
          {selectedTiles && selectedTiles.tilesetId === activeTileset.id && (
            <div className="selection-info">
              Selected: {selectedTiles.endCol - selectedTiles.startCol + 1}x
              {selectedTiles.endRow - selectedTiles.startRow + 1} tiles
            </div>
          )}
        </div>
      )}
    </div>
  );
}
