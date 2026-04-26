import { useState } from 'react';
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

  const [showSettings, setShowSettings] = useState(false);
  const [widthInput, setWidthInput] = useState(mapWidth);
  const [heightInput, setHeightInput] = useState(mapHeight);
  const [tileSizeInput, setTileSizeInput] = useState(tileSize);

  const tools = [
    { id: 'brush', label: 'B', title: 'Brush (B)' },
    { id: 'eraser', label: 'E', title: 'Eraser (E)' },
    { id: 'fill', label: 'F', title: 'Fill (F)' },
  ];

  const applySettings = () => {
    const w = Math.max(1, Math.min(200, widthInput));
    const h = Math.max(1, Math.min(200, heightInput));
    const ts = Math.max(8, Math.min(256, tileSizeInput));
    setMapSize(w, h);
    setTileSize(ts);
    setShowSettings(false);
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
      })),
      tilesets: tilesets.map((ts) => ({
        name: ts.name,
        tileWidth: ts.tileWidth,
        tileHeight: ts.tileHeight,
        cols: ts.cols,
        rows: ts.rows,
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
