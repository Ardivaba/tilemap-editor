import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_MAP_WIDTH = 20;
const DEFAULT_MAP_HEIGHT = 15;
const MAX_HISTORY = 50;

function createEmptyGrid(width, height) {
  return Array.from({ length: height }, () => Array(width).fill(null));
}

const useStore = create(
  persist(
    (set, get) => ({
      // Map settings
      mapWidth: DEFAULT_MAP_WIDTH,
      mapHeight: DEFAULT_MAP_HEIGHT,
      tileSize: 32,

      // Tileset
      tilesets: [],
      activeTilesetId: null,
      selectedTiles: null, // { tilesetId, startCol, startRow, endCol, endRow }

      // Layers
      layers: [
        {
          id: 'layer-1',
          name: 'Layer 1',
          visible: true,
          locked: false,
          collision: false,
          data: createEmptyGrid(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT),
        },
      ],
      activeLayerId: 'layer-1',

      // Tools
      activeTool: 'brush', // brush, eraser, fill, select
      showGrid: true,

      // History (not persisted separately - handled via middleware exclusion)
      history: [],
      historyIndex: -1,

      // -- Actions --

      setMapSize: (width, height) => {
        const state = get();
        const layers = state.layers.map((layer) => {
          const newData = createEmptyGrid(width, height);
          for (let y = 0; y < Math.min(height, layer.data.length); y++) {
            for (let x = 0; x < Math.min(width, layer.data[0].length); x++) {
              newData[y][x] = layer.data[y][x];
            }
          }
          return { ...layer, data: newData };
        });
        set({ mapWidth: width, mapHeight: height, layers });
      },

      setTileSize: (size) => set({ tileSize: size }),

      // Tileset management
      addTileset: (tileset) => {
        set((state) => ({
          tilesets: [...state.tilesets, tileset],
          activeTilesetId: tileset.id,
        }));
      },

      removeTileset: (id) => {
        set((state) => ({
          tilesets: state.tilesets.filter((t) => t.id !== id),
          activeTilesetId:
            state.activeTilesetId === id
              ? state.tilesets.length > 1
                ? state.tilesets.find((t) => t.id !== id)?.id
                : null
              : state.activeTilesetId,
        }));
      },

      setActiveTileset: (id) => set({ activeTilesetId: id }),

      setSelectedTiles: (selection) => set({ selectedTiles: selection }),

      moveSelectedTiles: (dx, dy) => {
        const state = get();
        const sel = state.selectedTiles;
        if (!sel) return;
        const ts = state.tilesets.find((t) => t.id === sel.tilesetId);
        if (!ts) return;
        const selW = sel.endCol - sel.startCol;
        const selH = sel.endRow - sel.startRow;
        const newStartCol = sel.startCol + dx;
        const newStartRow = sel.startRow + dy;
        const newEndCol = newStartCol + selW;
        const newEndRow = newStartRow + selH;
        if (newStartCol < 0 || newStartRow < 0 || newEndCol >= ts.cols || newEndRow >= ts.rows) return;
        set({
          selectedTiles: {
            ...sel,
            startCol: newStartCol,
            startRow: newStartRow,
            endCol: newEndCol,
            endRow: newEndRow,
          },
        });
      },

      // Layer management
      addLayer: () => {
        const state = get();
        const id = `layer-${Date.now()}`;
        const newLayer = {
          id,
          name: `Layer ${state.layers.length + 1}`,
          visible: true,
          locked: false,
          collision: false,
          data: createEmptyGrid(state.mapWidth, state.mapHeight),
        };
        set({ layers: [...state.layers, newLayer], activeLayerId: id });
      },

      removeLayer: (id) => {
        const state = get();
        if (state.layers.length <= 1) return;
        const filtered = state.layers.filter((l) => l.id !== id);
        set({
          layers: filtered,
          activeLayerId:
            state.activeLayerId === id ? filtered[0].id : state.activeLayerId,
        });
      },

      setActiveLayer: (id) => set({ activeLayerId: id }),

      toggleLayerVisibility: (id) => {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id ? { ...l, visible: !l.visible } : l
          ),
        }));
      },

      toggleLayerLock: (id) => {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id ? { ...l, locked: !l.locked } : l
          ),
        }));
      },

      toggleLayerCollision: (id) => {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id ? { ...l, collision: !l.collision } : l
          ),
        }));
      },

      renameLayer: (id, name) => {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id ? { ...l, name } : l
          ),
        }));
      },

      moveLayer: (id, direction) => {
        set((state) => {
          const idx = state.layers.findIndex((l) => l.id === id);
          if (
            idx < 0 ||
            (direction === -1 && idx === 0) ||
            (direction === 1 && idx === state.layers.length - 1)
          )
            return state;
          const layers = [...state.layers];
          [layers[idx], layers[idx + direction]] = [
            layers[idx + direction],
            layers[idx],
          ];
          return { layers };
        });
      },

      // Tool
      setActiveTool: (tool) => set({ activeTool: tool }),
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

      // History
      pushHistory: () => {
        const state = get();
        const snapshot = state.layers.map((l) => ({
          ...l,
          data: l.data.map((row) => [...row]),
        }));
        const history = state.history.slice(0, state.historyIndex + 1);
        history.push(snapshot);
        if (history.length > MAX_HISTORY) history.shift();
        set({ history, historyIndex: history.length - 1 });
      },

      undo: () => {
        const state = get();
        if (state.historyIndex <= 0) return;
        const newIndex = state.historyIndex - 1;
        const snapshot = state.history[newIndex].map((l) => ({
          ...l,
          data: l.data.map((row) => [...row]),
        }));
        set({ layers: snapshot, historyIndex: newIndex });
      },

      redo: () => {
        const state = get();
        if (state.historyIndex >= state.history.length - 1) return;
        const newIndex = state.historyIndex + 1;
        const snapshot = state.history[newIndex].map((l) => ({
          ...l,
          data: l.data.map((row) => [...row]),
        }));
        set({ layers: snapshot, historyIndex: newIndex });
      },

      // Painting
      paintTile: (x, y) => {
        const state = get();
        const layer = state.layers.find((l) => l.id === state.activeLayerId);
        if (!layer || layer.locked || !layer.visible) return;

        if (state.activeTool === 'eraser') {
          if (x < 0 || x >= state.mapWidth || y < 0 || y >= state.mapHeight)
            return;
          if (layer.data[y][x] === null) return;
          const newData = layer.data.map((row) => [...row]);
          newData[y][x] = null;
          set({
            layers: state.layers.map((l) =>
              l.id === state.activeLayerId ? { ...l, data: newData } : l
            ),
          });
          return;
        }

        if (state.activeTool === 'brush' && state.selectedTiles) {
          const sel = state.selectedTiles;
          const selWidth = sel.endCol - sel.startCol + 1;
          const selHeight = sel.endRow - sel.startRow + 1;
          const newData = layer.data.map((row) => [...row]);
          let changed = false;

          for (let dy = 0; dy < selHeight; dy++) {
            for (let dx = 0; dx < selWidth; dx++) {
              const px = x + dx;
              const py = y + dy;
              if (
                px < 0 ||
                px >= state.mapWidth ||
                py < 0 ||
                py >= state.mapHeight
              )
                continue;
              const tileValue = {
                tilesetId: sel.tilesetId,
                col: sel.startCol + dx,
                row: sel.startRow + dy,
              };
              const existing = newData[py][px];
              if (
                existing &&
                existing.tilesetId === tileValue.tilesetId &&
                existing.col === tileValue.col &&
                existing.row === tileValue.row
              )
                continue;
              newData[py][px] = tileValue;
              changed = true;
            }
          }

          if (!changed) return;
          set({
            layers: state.layers.map((l) =>
              l.id === state.activeLayerId ? { ...l, data: newData } : l
            ),
          });
          return;
        }

        if (state.activeTool === 'fill' && state.selectedTiles) {
          const sel = state.selectedTiles;
          const tileValue = {
            tilesetId: sel.tilesetId,
            col: sel.startCol,
            row: sel.startRow,
          };
          if (
            x < 0 ||
            x >= state.mapWidth ||
            y < 0 ||
            y >= state.mapHeight
          )
            return;

          const newData = layer.data.map((row) => [...row]);
          const targetTile = newData[y][x];

          const matches = (a, b) => {
            if (a === null && b === null) return true;
            if (a === null || b === null) return false;
            return (
              a.tilesetId === b.tilesetId &&
              a.col === b.col &&
              a.row === b.row
            );
          };

          if (matches(targetTile, tileValue)) return;

          const stack = [[x, y]];
          const visited = new Set();
          while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if (
              cx < 0 ||
              cx >= state.mapWidth ||
              cy < 0 ||
              cy >= state.mapHeight
            )
              continue;
            if (!matches(newData[cy][cx], targetTile)) continue;
            newData[cy][cx] = { ...tileValue };
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
          }

          set({
            layers: state.layers.map((l) =>
              l.id === state.activeLayerId ? { ...l, data: newData } : l
            ),
          });
        }
      },

      // Project management
      newProject: () => {
        set({
          mapWidth: DEFAULT_MAP_WIDTH,
          mapHeight: DEFAULT_MAP_HEIGHT,
          tileSize: 32,
          tilesets: [],
          activeTilesetId: null,
          selectedTiles: null,
          layers: [
            {
              id: 'layer-1',
              name: 'Layer 1',
              visible: true,
              locked: false,
              collision: false,
              data: createEmptyGrid(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT),
            },
          ],
          activeLayerId: 'layer-1',
          activeTool: 'brush',
          history: [],
          historyIndex: -1,
        });
      },
    }),
    {
      name: 'tilemap-editor-storage',
      partialize: (state) => ({
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        tileSize: state.tileSize,
        tilesets: state.tilesets,
        activeTilesetId: state.activeTilesetId,
        selectedTiles: state.selectedTiles,
        layers: state.layers,
        activeLayerId: state.activeLayerId,
        activeTool: state.activeTool,
        showGrid: state.showGrid,
      }),
    }
  )
);

export default useStore;
