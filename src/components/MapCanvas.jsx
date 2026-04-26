import { useRef, useEffect, useState, useCallback } from 'react';
import useStore from '../store/useStore';

export default function MapCanvas() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const mapWidth = useStore((s) => s.mapWidth);
  const mapHeight = useStore((s) => s.mapHeight);
  const tileSize = useStore((s) => s.tileSize);
  const layers = useStore((s) => s.layers);
  const tilesets = useStore((s) => s.tilesets);
  const showGrid = useStore((s) => s.showGrid);
  const activeTool = useStore((s) => s.activeTool);
  const selectedTiles = useStore((s) => s.selectedTiles);
  const activeLayerId = useStore((s) => s.activeLayerId);
  const paintTile = useStore((s) => s.paintTile);
  const pushHistory = useStore((s) => s.pushHistory);
  const activeTileRuleId = useStore((s) => s.activeTileRuleId);
  const tileRules = useStore((s) => s.tileRules);

  const [camera, setCamera] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [lastPaintPos, setLastPaintPos] = useState(null);
  const [panStart, setPanStart] = useState(null);
  const [hoverTile, setHoverTile] = useState(null);
  const [imageCache, setImageCache] = useState({});
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // Load tileset images
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const store = useStore.getState();

      if (e.key === 'b' || e.key === 'B') store.setActiveTool('brush');
      if (e.key === 'e' || e.key === 'E') store.setActiveTool('eraser');
      if (e.key === 'f' || e.key === 'F') store.setActiveTool('fill');
      if (e.key === 'g' || e.key === 'G') store.toggleGrid();

      // WASD to move tileset selection
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); store.moveSelectedTiles(-1, 0); }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); store.moveSelectedTiles(1, 0); }
      if (e.key === 'w' || e.key === 'W') { e.preventDefault(); store.moveSelectedTiles(0, -1); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); store.moveSelectedTiles(0, 1); }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        store.redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        store.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get tile coordinates from screen position
  const screenToTile = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - camera.x) / camera.zoom;
      const y = (clientY - rect.top - camera.y) / camera.zoom;
      return {
        col: Math.floor(x / tileSize),
        row: Math.floor(y / tileSize),
      };
    },
    [camera, tileSize]
  );

  const handleMouseDown = useCallback(
    (e) => {
      // Middle mouse or space+left for panning
      if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
        if (!camera) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - camera.x, y: e.clientY - camera.y });
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        const tile = screenToTile(e.clientX, e.clientY);
        if (!tile) return;

        pushHistory();
        setIsPainting(true);
        setLastPaintPos(tile);
        paintTile(tile.col, tile.row);
      }
    },
    [camera, screenToTile, paintTile, pushHistory]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (isPanning) {
        setCamera((prev) => ({
          ...prev,
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        }));
        return;
      }

      const tile = screenToTile(e.clientX, e.clientY);
      if (tile) {
        setHoverTile(tile);
      }

      if (isPainting && tile && activeTool !== 'fill') {
        if (!lastPaintPos || tile.col !== lastPaintPos.col || tile.row !== lastPaintPos.row) {
          // Bresenham line between last and current position for smooth painting
          if (lastPaintPos) {
            const dx = Math.abs(tile.col - lastPaintPos.col);
            const dy = Math.abs(tile.row - lastPaintPos.row);
            const sx = lastPaintPos.col < tile.col ? 1 : -1;
            const sy = lastPaintPos.row < tile.row ? 1 : -1;
            let err = dx - dy;
            let cx = lastPaintPos.col;
            let cy = lastPaintPos.row;

            while (cx !== tile.col || cy !== tile.row) {
              const e2 = 2 * err;
              if (e2 > -dy) {
                err -= dy;
                cx += sx;
              }
              if (e2 < dx) {
                err += dx;
                cy += sy;
              }
              paintTile(cx, cy);
            }
          }
          paintTile(tile.col, tile.row);
          setLastPaintPos(tile);
        }
      }
    },
    [isPanning, isPainting, panStart, screenToTile, activeTool, lastPaintPos, paintTile]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsPainting(false);
    setLastPaintPos(null);
    setPanStart(null);
  }, []);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas || !camera) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

      setCamera((prev) => {
        if (!prev) return prev;
        const newZoom = Math.max(0.1, Math.min(10, prev.zoom * zoomFactor));
        return {
          x: mouseX - (mouseX - prev.x) * (newZoom / prev.zoom),
          y: mouseY - (mouseY - prev.y) * (newZoom / prev.zoom),
          zoom: newZoom,
        };
      });
    },
    [camera]
  );

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !camera) return;

    canvas.width = canvasSize.w || container.clientWidth;
    canvas.height = canvasSize.h || container.clientHeight;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw checkerboard background for map area
    const checkSize = tileSize / 2;
    for (let y = 0; y < mapHeight * tileSize; y += checkSize) {
      for (let x = 0; x < mapWidth * tileSize; x += checkSize) {
        const isLight =
          (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0;
        ctx.fillStyle = isLight ? '#2a2a3e' : '#252538';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Draw layers
    layers
      .filter((l) => l.visible)
      .forEach((layer) => {
        for (let y = 0; y < mapHeight; y++) {
          for (let x = 0; x < mapWidth; x++) {
            const tile = layer.data[y]?.[x];
            if (!tile) continue;
            const img = imageCache[tile.tilesetId];
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

        // Draw collision overlay
        if (layer.collision) {
          for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
              const tile = layer.data[y]?.[x];
              if (!tile) continue;
              ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
              ctx.fillRect(
                x * tileSize,
                y * tileSize,
                tileSize,
                tileSize
              );
            }
          }
        }
      });

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1 / camera.zoom;
      for (let x = 0; x <= mapWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * tileSize, 0);
        ctx.lineTo(x * tileSize, mapHeight * tileSize);
        ctx.stroke();
      }
      for (let y = 0; y <= mapHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * tileSize);
        ctx.lineTo(mapWidth * tileSize, y * tileSize);
        ctx.stroke();
      }
    }

    // Draw map border
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.5)';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, mapWidth * tileSize, mapHeight * tileSize);

    // Draw hover preview
    if (
      hoverTile &&
      hoverTile.col >= 0 &&
      hoverTile.col < mapWidth &&
      hoverTile.row >= 0 &&
      hoverTile.row < mapHeight
    ) {
      if (activeTool === 'brush' && activeTileRuleId) {
        // Show the center/first tile of the rule as preview
        const rule = tileRules.find((r) => r.id === activeTileRuleId);
        if (rule) {
          const centerSlot = rule.slots.find((s) => s.key === 'c') || rule.slots.find((s) => s.tile);
          if (centerSlot && centerSlot.tile) {
            const ts = tilesets.find((t) => t.id === centerSlot.tile.tilesetId);
            const img = imageCache[centerSlot.tile.tilesetId];
            if (ts && img) {
              ctx.globalAlpha = 0.5;
              ctx.drawImage(
                img,
                centerSlot.tile.col * ts.tileWidth,
                centerSlot.tile.row * ts.tileHeight,
                ts.tileWidth,
                ts.tileHeight,
                hoverTile.col * tileSize,
                hoverTile.row * tileSize,
                tileSize,
                tileSize
              );
              ctx.globalAlpha = 1;
            }
          }
        }
        ctx.strokeStyle = 'rgba(255, 167, 38, 0.8)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(
          hoverTile.col * tileSize,
          hoverTile.row * tileSize,
          tileSize,
          tileSize
        );
      } else if (activeTool === 'brush' && selectedTiles) {
        const sel = selectedTiles;
        const selW = sel.endCol - sel.startCol + 1;
        const selH = sel.endRow - sel.startRow + 1;
        const ts = tilesets.find((t) => t.id === sel.tilesetId);
        const img = imageCache[sel.tilesetId];

        if (ts && img) {
          ctx.globalAlpha = 0.5;
          for (let dy = 0; dy < selH; dy++) {
            for (let dx = 0; dx < selW; dx++) {
              const px = hoverTile.col + dx;
              const py = hoverTile.row + dy;
              if (px >= 0 && px < mapWidth && py >= 0 && py < mapHeight) {
                ctx.drawImage(
                  img,
                  (sel.startCol + dx) * ts.tileWidth,
                  (sel.startRow + dy) * ts.tileHeight,
                  ts.tileWidth,
                  ts.tileHeight,
                  px * tileSize,
                  py * tileSize,
                  tileSize,
                  tileSize
                );
              }
            }
          }
          ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = 'rgba(79, 195, 247, 0.8)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(
          hoverTile.col * tileSize,
          hoverTile.row * tileSize,
          selW * tileSize,
          selH * tileSize
        );
      } else if (activeTool === 'eraser') {
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(
          hoverTile.col * tileSize,
          hoverTile.row * tileSize,
          tileSize,
          tileSize
        );
        // Draw X
        ctx.beginPath();
        ctx.moveTo(hoverTile.col * tileSize + 4, hoverTile.row * tileSize + 4);
        ctx.lineTo(
          (hoverTile.col + 1) * tileSize - 4,
          (hoverTile.row + 1) * tileSize - 4
        );
        ctx.moveTo(
          (hoverTile.col + 1) * tileSize - 4,
          hoverTile.row * tileSize + 4
        );
        ctx.lineTo(
          hoverTile.col * tileSize + 4,
          (hoverTile.row + 1) * tileSize - 4
        );
        ctx.stroke();
      } else if (activeTool === 'fill') {
        ctx.fillStyle = 'rgba(79, 195, 247, 0.2)';
        ctx.fillRect(
          hoverTile.col * tileSize,
          hoverTile.row * tileSize,
          tileSize,
          tileSize
        );
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.8)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(
          hoverTile.col * tileSize,
          hoverTile.row * tileSize,
          tileSize,
          tileSize
        );
      }
    }

    ctx.restore();

    // Coordinate display
    if (hoverTile) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(canvas.width - 100, canvas.height - 28, 100, 28);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.fillText(
        `${hoverTile.col}, ${hoverTile.row}`,
        canvas.width - 90,
        canvas.height - 10
      );
    }
  }, [
    layers,
    tilesets,
    imageCache,
    mapWidth,
    mapHeight,
    tileSize,
    showGrid,
    camera,
    hoverTile,
    activeTool,
    selectedTiles,
    activeTileRuleId,
    tileRules,
    canvasSize,
  ]);

  // Resize observer + center view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setCanvasSize({ w: width, h: height });
        // Auto-center on first valid size
        setCamera((prev) => {
          if (prev !== null) return prev;
          const totalW = mapWidth * tileSize;
          const totalH = mapHeight * tileSize;
          const zoom = Math.min(
            (width - 40) / totalW,
            (height - 40) / totalH,
            2
          );
          return {
            x: (width - totalW * zoom) / 2,
            y: (height - totalH * zoom) / 2,
            zoom,
          };
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [mapWidth, mapHeight, tileSize]);

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (activeTool === 'brush') return 'crosshair';
    if (activeTool === 'eraser') return 'crosshair';
    if (activeTool === 'fill') return 'crosshair';
    return 'default';
  };

  return (
    <div ref={containerRef} className="map-canvas-container">
      <canvas
        ref={canvasRef}
        className="map-canvas"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
