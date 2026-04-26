import { useState, useRef } from 'react';
import JSZip from 'jszip';
import useStore from '../store/useStore';

export default function Toolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const showGrid = useStore((s) => s.showGrid);
  const toggleGrid = useStore((s) => s.toggleGrid);
  const mapWidth = useStore((s) => s.mapWidth);
  const mapHeight = useStore((s) => s.mapHeight);
  const setMapSize = useStore((s) => s.setMapSize);
  const tileSize = useStore((s) => s.tileSize);
  const setTileSize = useStore((s) => s.setTileSize);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const newProject = useStore((s) => s.newProject);
  const layers = useStore((s) => s.layers);
  const tilesets = useStore((s) => s.tilesets);
  const spritesheets = useStore((s) => s.spritesheets);
  const snapToGrid = useStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useStore((s) => s.toggleSnapToGrid);
  const activeColor = useStore((s) => s.activeColor);
  const setActiveColor = useStore((s) => s.setActiveColor);
  const addTileset = useStore((s) => s.addTileset);
  const addSpritesheet = useStore((s) => s.addSpritesheet);

  const zipInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [widthInput, setWidthInput] = useState(mapWidth);
  const [heightInput, setHeightInput] = useState(mapHeight);
  const [tileSizeInput, setTileSizeInput] = useState(tileSize);

  const tools = [
    { id: 'brush', label: 'B', title: 'Brush (B)' },
    { id: 'eraser', label: 'E', title: 'Eraser (E)' },
    { id: 'fill', label: 'F', title: 'Fill (F)' },
    { id: 'tint', label: 'T', title: 'Tint (T)' },
    { id: 'object', label: 'O', title: 'Place Object (O)' },
    { id: 'select', label: 'V', title: 'Select/Move (V)' },
  ];

  const applySettings = () => {
    const w = Math.max(1, Math.min(200, widthInput));
    const h = Math.max(1, Math.min(200, heightInput));
    const ts = Math.max(8, Math.min(256, tileSizeInput));
    setMapSize(w, h);
    setTileSize(ts);
    setShowSettings(false);
  };

  const importZip = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const zip = await JSZip.loadAsync(file);

      // Collect all png files and their potential json sidecars
      const pngFiles = {};
      const jsonFiles = {};

      zip.forEach((path, entry) => {
        if (entry.dir) return;
        const lower = path.toLowerCase();
        if (lower.endsWith('.png')) {
          pngFiles[path] = entry;
        } else if (lower.endsWith('.json')) {
          jsonFiles[path] = entry;
        }
      });

      let tilesetCount = 0;
      let spritesheetCount = 0;

      for (const [pngPath, pngEntry] of Object.entries(pngFiles)) {
        const jsonPath = pngPath.replace(/\.png$/i, '.json');
        const jsonEntry = jsonFiles[jsonPath];

        // Read image as data URL
        const blob = await pngEntry.async('blob');
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(blob);
        });

        // Load image to get dimensions
        const img = await new Promise((resolve) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.src = dataUrl;
        });

        const baseName = pngPath.split('/').pop().replace(/\.png$/i, '');

        if (jsonEntry) {
          // Has JSON sidecar → spritesheet
          const jsonText = await jsonEntry.async('text');
          let meta;
          try { meta = JSON.parse(jsonText); } catch { meta = null; }

          const fw = meta?.frameWidth || 32;
          const fh = meta?.frameHeight || 32;
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

          addSpritesheet({
            id: `ss-${Date.now()}-${spritesheetCount}`,
            name: baseName,
            dataUrl,
            imageWidth: img.width,
            imageHeight: img.height,
            frameWidth: fw,
            frameHeight: fh,
            cols,
            rows,
            animations,
          });
          spritesheetCount++;
        } else {
          // No JSON → tileset/tilemap
          // Try to parse tile size from filename like "Terrain (32x32).png"
          const sizeMatch = baseName.match(/\((\d+)x(\d+)\)/);
          const tw = sizeMatch ? parseInt(sizeMatch[1]) : tileSize;
          const th = sizeMatch ? parseInt(sizeMatch[2]) : tileSize;

          addTileset({
            id: `tileset-${Date.now()}-${tilesetCount}`,
            name: baseName,
            dataUrl,
            tileWidth: tw,
            tileHeight: th,
            imageWidth: img.width,
            imageHeight: img.height,
            cols: Math.floor(img.width / tw),
            rows: Math.floor(img.height / th),
          });
          tilesetCount++;
        }
      }

      alert(`Imported ${tilesetCount} tilesets and ${spritesheetCount} spritesheets.`);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  const exportJSON = () => {
    const data = {
      mapWidth,
      mapHeight,
      tileSize,
      layers: layers.map((l) => ({
        name: l.name,
        collision: l.collision,
        data: l.data,
        objects: (l.objects || []).map((o) => ({
          name: o.name,
          spritesheetId: o.spritesheetId,
          x: o.x,
          y: o.y,
          animationIndex: o.animationIndex,
          frame: o.frame,
          scaleX: o.scaleX,
          scaleY: o.scaleY,
        })),
      })),
      tilesets: tilesets.map((ts) => ({
        name: ts.name,
        tileWidth: ts.tileWidth,
        tileHeight: ts.tileHeight,
        cols: ts.cols,
        rows: ts.rows,
      })),
      spritesheets: spritesheets.map((ss) => ({
        name: ss.name,
        frameWidth: ss.frameWidth,
        frameHeight: ss.frameHeight,
        cols: ss.cols,
        rows: ss.rows,
        animations: ss.animations,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tilemap.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = () => {
    const canvas = document.createElement('canvas');
    canvas.width = mapWidth * tileSize;
    canvas.height = mapHeight * tileSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Build image cache from tileset data URLs
    const images = {};
    const promises = tilesets.map(
      (ts) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images[ts.id] = img;
            resolve();
          };
          img.src = ts.dataUrl;
        })
    );

    Promise.all(promises).then(() => {
      layers
        .filter((l) => l.visible)
        .forEach((layer) => {
          for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
              const tile = layer.data[y]?.[x];
              if (!tile) continue;
              if (tile.color) {
                ctx.fillStyle = tile.color;
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                continue;
              }
              const img = images[tile.tilesetId];
              const ts = tilesets.find((t) => t.id === tile.tilesetId);
              if (!img || !ts) continue;
              ctx.drawImage(
                img,
                tile.col * ts.tileWidth,
                tile.row * ts.tileHeight,
                ts.tileWidth,
                ts.tileHeight,
                x * tileSize,
                y * tileSize,
                tileSize,
                tileSize
              );
            }
          }
        });

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tilemap.png';
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={() => {
            if (confirm('Create new project? Unsaved changes will be lost.'))
              newProject();
          }}
          title="New Project"
        >
          New
        </button>
        <button
          className="toolbar-btn import-btn"
          onClick={() => zipInputRef.current?.click()}
          disabled={importing}
          title="Import asset zip (PNG + JSON sidecars)"
        >
          {importing ? '...' : 'Import'}
        </button>
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={(e) => importZip(e.target.files[0])}
        />
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`toolbar-btn tool-btn ${
              activeTool === tool.id ? 'active' : ''
            }`}
            onClick={() => setActiveTool(tool.id)}
            title={tool.title}
          >
            {tool.label}
          </button>
        ))}
        <div className="color-picker-wrapper" title="Tint color">
          <input
            type="color"
            className="color-picker-input"
            value={activeColor}
            onChange={(e) => setActiveColor(e.target.value)}
            onClick={() => setActiveTool('tint')}
          />
        </div>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={undo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button
          className="toolbar-btn"
          onClick={redo}
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${showGrid ? 'active' : ''}`}
          onClick={toggleGrid}
          title="Toggle Grid (G)"
        >
          Grid
        </button>
        <button
          className={`toolbar-btn ${snapToGrid ? 'active' : ''}`}
          onClick={toggleSnapToGrid}
          title="Snap Objects to Grid"
        >
          Snap
        </button>
        <button
          className="toolbar-btn"
          onClick={() => {
            setWidthInput(mapWidth);
            setHeightInput(mapHeight);
            setTileSizeInput(tileSize);
            setShowSettings(!showSettings);
          }}
          title="Map Settings"
        >
          Settings
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn export-btn"
          onClick={exportJSON}
          title="Export as JSON"
        >
          JSON
        </button>
        <button
          className="toolbar-btn export-btn"
          onClick={exportPNG}
          title="Export as PNG"
        >
          PNG
        </button>
      </div>

      <div className="toolbar-right">
        <span className="map-info">
          {mapWidth}x{mapHeight} @ {tileSize}px
        </span>
      </div>

      {showSettings && (
        <div className="settings-popup">
          <div className="settings-title">Map Settings</div>
          <label>
            Width:
            <input
              type="number"
              min="1"
              max="200"
              value={widthInput}
              onChange={(e) => setWidthInput(Number(e.target.value))}
            />
          </label>
          <label>
            Height:
            <input
              type="number"
              min="1"
              max="200"
              value={heightInput}
              onChange={(e) => setHeightInput(Number(e.target.value))}
            />
          </label>
          <label>
            Tile Size:
            <input
              type="number"
              min="8"
              max="256"
              value={tileSizeInput}
              onChange={(e) => setTileSizeInput(Number(e.target.value))}
            />
          </label>
          <div className="settings-actions">
            <button onClick={applySettings}>Apply</button>
            <button onClick={() => setShowSettings(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
