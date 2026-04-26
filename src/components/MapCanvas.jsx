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
  const spritesheets = useStore((s) => s.spritesheets);
  const activeSpritesheetId = useStore((s) => s.activeSpritesheetId);
  const activeAnimationIndex = useStore((s) => s.activeAnimationIndex);
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const selectedObjectLayerId = useStore((s) => s.selectedObjectLayerId);
  const snapToGrid = useStore((s) => s.snapToGrid);
  const placeObject = useStore((s) => s.placeObject);
  const updateObject = useStore((s) => s.updateObject);
  const selectObject = useStore((s) => s.selectObject);
  const deselectObject = useStore((s) => s.deselectObject);
  const removeObject = useStore((s) => s.removeObject);

  const [camera, setCamera] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [lastPaintPos, setLastPaintPos] = useState(null);
  const [panStart, setPanStart] = useState(null);
  const [hoverTile, setHoverTile] = useState(null);
  const [hoverWorld, setHoverWorld] = useState(null);
  const [imageCache, setImageCache] = useState({});
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [dragOffset, setDragOffset] = useState(null);
  const [animTime, setAnimTime] = useState(0);
  const spaceHeld = useRef(false);

  // Load tileset + spritesheet images
  useEffect(() => {
    const allImages = [
      ...tilesets.map((ts) => ({ id: ts.id, dataUrl: ts.dataUrl })),
      ...spritesheets.map((ss) => ({ id: ss.id, dataUrl: ss.dataUrl })),
    ];
    allImages.forEach((item) => {
      if (!imageCache[item.id]) {
        const img = new Image();
        img.onload = () => setImageCache((prev) => ({ ...prev, [item.id]: img }));
        img.src = item.dataUrl;
      }
    });
  }, [tilesets, spritesheets]);

  // Animation timer - tick ~8 FPS for sprite animation
  useEffect(() => {
    let raf;
    let last = 0;
    const FPS = 8;
    const interval = 1000 / FPS;
    const tick = (time) => {
      if (time - last >= interval) {
        last = time;
        setAnimTime((t) => t + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keyboard shortcuts + space panning
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === ' ') {
        e.preventDefault();
        spaceHeld.current = true;
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      const store = useStore.getState();

      if (e.key === 'b' || e.key === 'B') store.setActiveTool('brush');
      if (e.key === 'e' || e.key === 'E') store.setActiveTool('eraser');
      if (e.key === 'f' || e.key === 'F') store.setActiveTool('fill');
      if (e.key === 'g' || e.key === 'G') store.toggleGrid();
      if (e.key === 'o' || e.key === 'O') store.setActiveTool('object');
      if (e.key === 'v' || e.key === 'V') store.setActiveTool('select');

      // WASD to move tileset selection (only in tile modes)
      if (['brush', 'eraser', 'fill'].includes(store.activeTool)) {
        if (e.key === 'a' || e.key === 'A') { e.preventDefault(); store.moveSelectedTiles(-1, 0); }
        if (e.key === 'd' || e.key === 'D') { e.preventDefault(); store.moveSelectedTiles(1, 0); }
        if (e.key === 'w' || e.key === 'W') { e.preventDefault(); store.moveSelectedTiles(0, -1); }
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); store.moveSelectedTiles(0, 1); }
      }

      // Delete selected object
      if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedObjectId) {
        e.preventDefault();
        store.pushHistory();
        store.removeObject(store.selectedObjectLayerId, store.selectedObjectId);
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        store.deselectObject();
      }

      // Arrow keys to nudge selected object
      if (store.selectedObjectId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const nudge = store.snapToGrid ? store.tileSize : 1;
        const layer = store.layers.find((l) => l.id === store.selectedObjectLayerId);
        const obj = layer?.objects?.find((o) => o.id === store.selectedObjectId);
        if (obj) {
          const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0;
          const dy = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0;
          store.updateObject(store.selectedObjectLayerId, store.selectedObjectId, {
            x: obj.x + dx,
            y: obj.y + dy,
          });
        }
      }

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

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        spaceHeld.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const screenToWorld = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - camera.x) / camera.zoom,
        y: (clientY - rect.top - camera.y) / camera.zoom,
      };
    },
    [camera]
  );

  const screenToTile = useCallback(
    (clientX, clientY) => {
      const w = screenToWorld(clientX, clientY);
      if (!w) return null;
      return {
        col: Math.floor(w.x / tileSize),
        row: Math.floor(w.y / tileSize),
      };
    },
    [screenToWorld, tileSize]
  );

  // Find object at world position (top layer first, last object in array = on top)
  const objectAtPoint = useCallback(
    (wx, wy) => {
      const visibleLayers = [...layers].reverse().filter((l) => l.visible && !l.locked);
      for (const layer of visibleLayers) {
        const objects = layer.objects || [];
        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          const ss = spritesheets.find((s) => s.id === obj.spritesheetId);
          if (!ss) continue;
          const fw = ss.frameWidth * Math.abs(obj.scaleX ?? 1);
          const fh = ss.frameHeight * Math.abs(obj.scaleY ?? 1);
          if (wx >= obj.x && wx <= obj.x + fw && wy >= obj.y && wy <= obj.y + fh) {
            return { obj, layerId: layer.id };
          }
        }
      }
      return null;
    },
    [layers, spritesheets]
  );

  const handleMouseDown = useCallback(
    (e) => {
      if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
        if (!camera) return;
        setIsPanning(true);
        setPanStart({ x: e.clientX - camera.x, y: e.clientY - camera.y });
        e.preventDefault();
        return;
      }

      if (e.button !== 0) return;

      const world = screenToWorld(e.clientX, e.clientY);
      if (!world) return;

      // Object placement
      if (activeTool === 'object') {
        const ss = spritesheets.find((s) => s.id === activeSpritesheetId);
        if (!ss || !ss.animations[activeAnimationIndex]) return;
        pushHistory();
        // Center on cursor
        let px = world.x - ss.frameWidth / 2;
        let py = world.y - ss.frameHeight / 2;
        if (snapToGrid) {
          px = Math.round(px / tileSize) * tileSize;
          py = Math.round(py / tileSize) * tileSize;
        }
        // Always pixel-snap
        px = Math.round(px);
        py = Math.round(py);
        placeObject({
          id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          spritesheetId: ss.id,
          x: px,
          y: py,
          animationIndex: activeAnimationIndex,
          frame: 0,
          scaleX: 1,
          scaleY: 1,
          name: ss.animations[activeAnimationIndex].name,
        });
        return;
      }

      // Object selection / dragging
      if (activeTool === 'select') {
        const hit = objectAtPoint(world.x, world.y);
        if (hit) {
          selectObject(hit.obj.id, hit.layerId);
          setIsDraggingObject(true);
          setDragOffset({ x: world.x - hit.obj.x, y: world.y - hit.obj.y });
          pushHistory();
        } else {
          deselectObject();
        }
        return;
      }

      // Tile painting
      const tile = screenToTile(e.clientX, e.clientY);
      if (!tile) return;
      pushHistory();
      setIsPainting(true);
      setLastPaintPos(tile);
      paintTile(tile.col, tile.row);
    },
    [camera, screenToWorld, screenToTile, activeTool, activeSpritesheetId, activeAnimationIndex, snapToGrid, tileSize, spritesheets, objectAtPoint, pushHistory, placeObject, selectObject, deselectObject, paintTile]
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

      const world = screenToWorld(e.clientX, e.clientY);
      if (world) setHoverWorld(world);

      const tile = screenToTile(e.clientX, e.clientY);
      if (tile) setHoverTile(tile);

      // Drag object
      if (isDraggingObject && selectedObjectId && world && dragOffset) {
        let nx = world.x - dragOffset.x;
        let ny = world.y - dragOffset.y;
        if (snapToGrid) {
          nx = Math.round(nx / tileSize) * tileSize;
          ny = Math.round(ny / tileSize) * tileSize;
        }
        // Always pixel-snap
        nx = Math.round(nx);
        ny = Math.round(ny);
        updateObject(selectedObjectLayerId, selectedObjectId, { x: nx, y: ny });
        return;
      }

      // Tile painting
      if (isPainting && tile && activeTool !== 'fill') {
        if (!lastPaintPos || tile.col !== lastPaintPos.col || tile.row !== lastPaintPos.row) {
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
              if (e2 > -dy) { err -= dy; cx += sx; }
              if (e2 < dx) { err += dx; cy += sy; }
              paintTile(cx, cy);
            }
          }
          paintTile(tile.col, tile.row);
          setLastPaintPos(tile);
        }
      }
    },
    [isPanning, isPainting, isDraggingObject, panStart, screenToWorld, screenToTile, activeTool, lastPaintPos, paintTile, selectedObjectId, selectedObjectLayerId, dragOffset, snapToGrid, tileSize, updateObject]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsPainting(false);
    setIsDraggingObject(false);
    setDragOffset(null);
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

  // ===== RENDER =====
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !camera) return;

    canvas.width = canvasSize.w || container.clientWidth;
    canvas.height = canvasSize.h || container.clientHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Checkerboard
    const checkSize = tileSize / 2;
    for (let y = 0; y < mapHeight * tileSize; y += checkSize) {
      for (let x = 0; x < mapWidth * tileSize; x += checkSize) {
        const isLight = (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0;
        ctx.fillStyle = isLight ? '#2a2a3e' : '#252538';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Draw layers (tiles + objects per layer)
    layers
      .filter((l) => l.visible)
      .forEach((layer) => {
        // Tiles
        for (let y = 0; y < mapHeight; y++) {
          for (let x = 0; x < mapWidth; x++) {
            const tile = layer.data[y]?.[x];
            if (!tile) continue;
            const img = imageCache[tile.tilesetId];
            const ts = tilesets.find((t) => t.id === tile.tilesetId);
            if (!img || !ts) continue;
            ctx.drawImage(
              img,
              tile.col * ts.tileWidth, tile.row * ts.tileHeight, ts.tileWidth, ts.tileHeight,
              x * tileSize, y * tileSize, tileSize, tileSize
            );
          }
        }

        // Collision overlay
        if (layer.collision) {
          for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
              if (!layer.data[y]?.[x]) continue;
              ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
              ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
          }
        }

        // Objects on this layer
        const objects = layer.objects || [];
        for (const obj of objects) {
          const ss = spritesheets.find((s) => s.id === obj.spritesheetId);
          if (!ss) continue;
          const img = imageCache[ss.id];
          if (!img) continue;
          const anim = ss.animations[obj.animationIndex] || ss.animations[0];
          if (!anim) continue;

          const frame = anim.frameCount > 1 ? animTime % anim.frameCount : 0;
          const sx = frame * ss.frameWidth;
          const sy = anim.row * ss.frameHeight;
          const scaleX = obj.scaleX ?? 1;
          const scaleY = obj.scaleY ?? 1;
          const dw = ss.frameWidth * Math.abs(scaleX);
          const dh = ss.frameHeight * Math.abs(scaleY);

          ctx.save();
          ctx.translate(obj.x + dw / 2, obj.y + dh / 2);
          ctx.scale(scaleX < 0 ? -1 : 1, scaleY < 0 ? -1 : 1);
          ctx.drawImage(img, sx, sy, ss.frameWidth, ss.frameHeight, -dw / 2, -dh / 2, dw, dh);
          ctx.restore();

          // Selection highlight
          if (obj.id === selectedObjectId) {
            ctx.strokeStyle = '#4fc3f7';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
            ctx.strokeRect(obj.x, obj.y, dw, dh);
            ctx.setLineDash([]);
            // Corner handles
            const hs = 4 / camera.zoom;
            ctx.fillStyle = '#4fc3f7';
            ctx.fillRect(obj.x - hs / 2, obj.y - hs / 2, hs, hs);
            ctx.fillRect(obj.x + dw - hs / 2, obj.y - hs / 2, hs, hs);
            ctx.fillRect(obj.x - hs / 2, obj.y + dh - hs / 2, hs, hs);
            ctx.fillRect(obj.x + dw - hs / 2, obj.y + dh - hs / 2, hs, hs);
          }
        }
      });

    // Grid
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

    // Map border
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.5)';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, mapWidth * tileSize, mapHeight * tileSize);

    // Hover previews
    if (hoverTile && hoverTile.col >= 0 && hoverTile.col < mapWidth && hoverTile.row >= 0 && hoverTile.row < mapHeight) {
      if (activeTool === 'brush' && activeTileRuleId) {
        const rule = tileRules.find((r) => r.id === activeTileRuleId);
        if (rule) {
          const centerSlot = rule.slots.find((s) => s.key === 'c') || rule.slots.find((s) => s.tile);
          if (centerSlot?.tile) {
            const ts = tilesets.find((t) => t.id === centerSlot.tile.tilesetId);
            const img = imageCache[centerSlot.tile.tilesetId];
            if (ts && img) {
              ctx.globalAlpha = 0.5;
              ctx.drawImage(img, centerSlot.tile.col * ts.tileWidth, centerSlot.tile.row * ts.tileHeight, ts.tileWidth, ts.tileHeight, hoverTile.col * tileSize, hoverTile.row * tileSize, tileSize, tileSize);
              ctx.globalAlpha = 1;
            }
          }
        }
        ctx.strokeStyle = 'rgba(255, 167, 38, 0.8)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(hoverTile.col * tileSize, hoverTile.row * tileSize, tileSize, tileSize);
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
                ctx.drawImage(img, (sel.startCol + dx) * ts.tileWidth, (sel.startRow + dy) * ts.tileHeight, ts.tileWidth, ts.tileHeight, px * tileSize, py * tileSize, tileSize, tileSize);
              }
            }
          }
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.8)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(hoverTile.col * tileSize, hoverTile.row * tileSize, selW * tileSize, selH * tileSize);
      } else if (activeTool === 'eraser') {
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(hoverTile.col * tileSize, hoverTile.row * tileSize, tileSize, tileSize);
        ctx.beginPath();
        ctx.moveTo(hoverTile.col * tileSize + 4, hoverTile.row * tileSize + 4);
        ctx.lineTo((hoverTile.col + 1) * tileSize - 4, (hoverTile.row + 1) * tileSize - 4);
        ctx.moveTo((hoverTile.col + 1) * tileSize - 4, hoverTile.row * tileSize + 4);
        ctx.lineTo(hoverTile.col * tileSize + 4, (hoverTile.row + 1) * tileSize - 4);
        ctx.stroke();
      } else if (activeTool === 'fill') {
        ctx.fillStyle = 'rgba(79, 195, 247, 0.2)';
        ctx.fillRect(hoverTile.col * tileSize, hoverTile.row * tileSize, tileSize, tileSize);
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.8)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(hoverTile.col * tileSize, hoverTile.row * tileSize, tileSize, tileSize);
      }
    }

    // Object ghost preview
    if (activeTool === 'object' && hoverWorld) {
      const ss = spritesheets.find((s) => s.id === activeSpritesheetId);
      if (ss) {
        const img = imageCache[ss.id];
        const anim = ss.animations[activeAnimationIndex];
        if (img && anim) {
          // Center on cursor
          let px = hoverWorld.x - ss.frameWidth / 2;
          let py = hoverWorld.y - ss.frameHeight / 2;
          if (snapToGrid) {
            px = Math.round(px / tileSize) * tileSize;
            py = Math.round(py / tileSize) * tileSize;
          }
          px = Math.round(px);
          py = Math.round(py);
          const ghostFrame = anim.frameCount > 1 ? animTime % anim.frameCount : 0;
          ctx.globalAlpha = 0.5;
          ctx.drawImage(img, ghostFrame * ss.frameWidth, anim.row * ss.frameHeight, ss.frameWidth, ss.frameHeight, px, py, ss.frameWidth, ss.frameHeight);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(102, 187, 106, 0.8)';
          ctx.lineWidth = 1 / camera.zoom;
          ctx.strokeRect(px, py, ss.frameWidth, ss.frameHeight);
        }
      }
    }

    ctx.restore();

    // Coordinate display
    if (hoverTile) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(canvas.width - 100, canvas.height - 28, 100, 28);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.fillText(`${hoverTile.col}, ${hoverTile.row}`, canvas.width - 90, canvas.height - 10);
    }
  }, [
    layers, tilesets, spritesheets, imageCache, mapWidth, mapHeight, tileSize, showGrid, camera,
    hoverTile, hoverWorld, activeTool, selectedTiles, activeTileRuleId, tileRules,
    activeSpritesheetId, activeAnimationIndex, selectedObjectId, snapToGrid, canvasSize, animTime,
  ]);

  // Resize observer + center view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setCanvasSize({ w: width, h: height });
        setCamera((prev) => {
          if (prev !== null) return prev;
          const totalW = mapWidth * tileSize;
          const totalH = mapHeight * tileSize;
          const zoom = Math.min((width - 40) / totalW, (height - 40) / totalH, 2);
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

  // Track space for cursor updates
  const [cursorOverride, setCursorOverride] = useState(false);
  useEffect(() => {
    const onDown = (e) => { if (e.key === ' ') setCursorOverride(true); };
    const onUp = (e) => { if (e.key === ' ') setCursorOverride(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (cursorOverride) return 'grab';
    if (activeTool === 'select') return isDraggingObject ? 'grabbing' : 'default';
    if (activeTool === 'object') return 'crosshair';
    if (['brush', 'eraser', 'fill'].includes(activeTool)) return 'crosshair';
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
