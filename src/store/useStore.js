import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_MAP_WIDTH = 20;
const DEFAULT_MAP_HEIGHT = 15;
const MAX_HISTORY = 50;

// Built-in tile rule templates
const RULE_TEMPLATES = {
  '9-tile': {
    name: '9-Tile (3x3)',
    slots: [
      { label: 'NW', key: 'nw' },
      { label: 'N',  key: 'n'  },
      { label: 'NE', key: 'ne' },
      { label: 'W',  key: 'w'  },
      { label: 'C',  key: 'c'  },
      { label: 'E',  key: 'e'  },
      { label: 'SW', key: 'sw' },
      { label: 'S',  key: 's'  },
      { label: 'SE', key: 'se' },
    ],
    cols: 3,
  },
  '4-edge': {
    name: '4-Edge',
    slots: [
      { label: 'Top',    key: 'n'  },
      { label: 'Left',   key: 'w'  },
      { label: 'Right',  key: 'e'  },
      { label: 'Bottom', key: 's'  },
    ],
    cols: 2,
  },
  '4-corner': {
    name: '4-Corner',
    slots: [
      { label: 'NW', key: 'nw' },
      { label: 'NE', key: 'ne' },
      { label: 'SW', key: 'sw' },
      { label: 'SE', key: 'se' },
    ],
    cols: 2,
  },
  '13-tile': {
    name: '13-Tile (Full)',
    slots: [
      { label: 'NW',       key: 'nw' },
      { label: 'N',        key: 'n'  },
      { label: 'NE',       key: 'ne' },
      { label: 'W',        key: 'w'  },
      { label: 'C',        key: 'c'  },
      { label: 'E',        key: 'e'  },
      { label: 'SW',       key: 'sw' },
      { label: 'S',        key: 's'  },
      { label: 'SE',       key: 'se' },
      { label: 'Inner NW', key: 'inw' },
      { label: 'Inner NE', key: 'ine' },
      { label: 'Inner SW', key: 'isw' },
      { label: 'Inner SE', key: 'ise' },
    ],
    cols: 3,
  },
  'custom': {
    name: 'Custom',
    slots: [],
    cols: 3,
  },
};

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
          objects: [],
        },
      ],
      activeLayerId: 'layer-1',

      // Tile rules
      tileRules: [],
      activeTileRuleId: null,
      editingRuleId: null,
      editingSlotIndex: 0,

      // Spritesheets & Objects
      spritesheets: [],
      activeSpritesheetId: null,
      activeAnimationIndex: 0,
      selectedObjectId: null,
      selectedObjectLayerId: null,
      snapToGrid: false,

      // Tools
      activeTool: 'brush', // brush, eraser, fill, object, select
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
          return { ...layer, data: newData, objects: layer.objects || [] };
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
          objects: [],
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
          objects: (l.objects || []).map((o) => ({ ...o })),
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
          objects: (l.objects || []).map((o) => ({ ...o })),
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
          objects: (l.objects || []).map((o) => ({ ...o })),
        }));
        set({ layers: snapshot, historyIndex: newIndex });
      },

      // Tile rule management
      createTileRule: (templateKey, name) => {
        const template = RULE_TEMPLATES[templateKey];
        if (!template) return;
        const id = `rule-${Date.now()}`;
        const rule = {
          id,
          name: name || template.name,
          templateKey,
          cols: template.cols,
          slots: template.slots.map((s) => ({ ...s, tile: null })),
        };
        set((state) => ({
          tileRules: [...state.tileRules, rule],
          editingRuleId: id,
          editingSlotIndex: 0,
        }));
      },

      deleteTileRule: (id) => {
        set((state) => ({
          tileRules: state.tileRules.filter((r) => r.id !== id),
          activeTileRuleId: state.activeTileRuleId === id ? null : state.activeTileRuleId,
          editingRuleId: state.editingRuleId === id ? null : state.editingRuleId,
        }));
      },

      setActiveTileRule: (id) => {
        set({ activeTileRuleId: id, selectedTiles: null });
      },

      clearActiveTileRule: () => {
        set({ activeTileRuleId: null });
      },

      startEditingRule: (id) => {
        set({ editingRuleId: id, editingSlotIndex: 0 });
      },

      stopEditingRule: () => {
        set({ editingRuleId: null, editingSlotIndex: 0 });
      },

      setEditingSlotIndex: (index) => {
        set({ editingSlotIndex: index });
      },

      assignTileToSlot: (tilesetId, col, row, autoAdvance) => {
        const state = get();
        if (!state.editingRuleId) return;
        const ruleIdx = state.tileRules.findIndex((r) => r.id === state.editingRuleId);
        if (ruleIdx < 0) return;
        const rule = state.tileRules[ruleIdx];
        if (state.editingSlotIndex < 0 || state.editingSlotIndex >= rule.slots.length) return;

        const newRules = [...state.tileRules];
        const newSlots = [...rule.slots];
        newSlots[state.editingSlotIndex] = {
          ...newSlots[state.editingSlotIndex],
          tile: { tilesetId, col, row },
        };
        newRules[ruleIdx] = { ...rule, slots: newSlots };

        const updates = { tileRules: newRules };
        if (autoAdvance) {
          const nextIndex = state.editingSlotIndex + 1;
          if (nextIndex < rule.slots.length) {
            updates.editingSlotIndex = nextIndex;
          }
        }
        set(updates);
      },

      clearSlotTile: (ruleId, slotIndex) => {
        set((state) => ({
          tileRules: state.tileRules.map((r) => {
            if (r.id !== ruleId) return r;
            const newSlots = [...r.slots];
            newSlots[slotIndex] = { ...newSlots[slotIndex], tile: null };
            return { ...r, slots: newSlots };
          }),
        }));
      },

      addCustomSlot: (ruleId, label) => {
        set((state) => ({
          tileRules: state.tileRules.map((r) => {
            if (r.id !== ruleId) return r;
            const key = `slot-${r.slots.length}`;
            return { ...r, slots: [...r.slots, { label, key, tile: null }] };
          }),
        }));
      },

      removeCustomSlot: (ruleId, slotIndex) => {
        set((state) => ({
          tileRules: state.tileRules.map((r) => {
            if (r.id !== ruleId) return r;
            const newSlots = r.slots.filter((_, i) => i !== slotIndex);
            return { ...r, slots: newSlots };
          }),
          editingSlotIndex: Math.min(
            state.editingSlotIndex,
            state.tileRules.find((r) => r.id === ruleId)?.slots.length - 2 || 0
          ),
        }));
      },

      renameTileRule: (id, name) => {
        set((state) => ({
          tileRules: state.tileRules.map((r) =>
            r.id === id ? { ...r, name } : r
          ),
        }));
      },

      // Spritesheet management
      addSpritesheet: (spritesheet) => {
        set((state) => ({
          spritesheets: [...state.spritesheets, spritesheet],
          activeSpritesheetId: spritesheet.id,
          activeAnimationIndex: 0,
        }));
      },

      removeSpritesheet: (id) => {
        set((state) => ({
          spritesheets: state.spritesheets.filter((s) => s.id !== id),
          activeSpritesheetId:
            state.activeSpritesheetId === id
              ? state.spritesheets.find((s) => s.id !== id)?.id || null
              : state.activeSpritesheetId,
        }));
      },

      setActiveSpritesheet: (id) => set({ activeSpritesheetId: id, activeAnimationIndex: 0 }),
      setActiveAnimationIndex: (index) => set({ activeAnimationIndex: index }),
      toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

      // Object management
      placeObject: (obj) => {
        const state = get();
        const layer = state.layers.find((l) => l.id === state.activeLayerId);
        if (!layer || layer.locked) return;
        set({
          layers: state.layers.map((l) =>
            l.id === state.activeLayerId
              ? { ...l, objects: [...(l.objects || []), obj] }
              : l
          ),
          selectedObjectId: obj.id,
          selectedObjectLayerId: state.activeLayerId,
        });
      },

      removeObject: (layerId, objId) => {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === layerId
              ? { ...l, objects: (l.objects || []).filter((o) => o.id !== objId) }
              : l
          ),
          selectedObjectId: state.selectedObjectId === objId ? null : state.selectedObjectId,
          selectedObjectLayerId: state.selectedObjectId === objId ? null : state.selectedObjectLayerId,
        }));
      },

      updateObject: (layerId, objId, changes) => {
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === layerId
              ? {
                  ...l,
                  objects: (l.objects || []).map((o) =>
                    o.id === objId ? { ...o, ...changes } : o
                  ),
                }
              : l
          ),
        }));
      },

      selectObject: (objId, layerId) => {
        set({ selectedObjectId: objId, selectedObjectLayerId: layerId });
      },

      deselectObject: () => {
        set({ selectedObjectId: null, selectedObjectLayerId: null });
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

        // Auto-tile painting with tile rule
        if (state.activeTool === 'brush' && state.activeTileRuleId) {
          const rule = state.tileRules.find((r) => r.id === state.activeTileRuleId);
          if (!rule || rule.slots.length === 0) return;

          if (x < 0 || x >= state.mapWidth || y < 0 || y >= state.mapHeight) return;

          const newData = layer.data.map((row) => [...row]);

          // Helper: is a cell part of this rule?
          const isSameRule = (cx, cy) => {
            if (cx < 0 || cx >= state.mapWidth || cy < 0 || cy >= state.mapHeight) return false;
            const t = newData[cy][cx];
            if (!t || !t.ruleId) return false;
            return t.ruleId === rule.id;
          };

          // Resolve which slot to use based on neighbor mask
          const resolveSlot = (cx, cy) => {
            const n  = isSameRule(cx, cy - 1);
            const s  = isSameRule(cx, cy + 1);
            const w  = isSameRule(cx - 1, cy);
            const e  = isSameRule(cx + 1, cy);
            const nw = isSameRule(cx - 1, cy - 1);
            const ne = isSameRule(cx + 1, cy - 1);
            const sw = isSameRule(cx - 1, cy + 1);
            const se = isSameRule(cx + 1, cy + 1);

            const slotByKey = {};
            for (const slot of rule.slots) {
              slotByKey[slot.key] = slot;
            }

            // 9-tile / 13-tile logic
            if (slotByKey.c) {
              // Inner corners (for 13-tile): all cardinal neighbors present but diagonal missing
              if (slotByKey.ise && n && w && s && e && !nw) return slotByKey.ise;
              if (slotByKey.isw && n && w && s && e && !ne) return slotByKey.isw;
              if (slotByKey.ine && n && w && s && e && !sw) return slotByKey.ine;
              if (slotByKey.inw && n && w && s && e && !se) return slotByKey.inw;

              // Outer corners: two adjacent edges missing
              if (!n && !w) return slotByKey.nw || slotByKey.c;
              if (!n && !e) return slotByKey.ne || slotByKey.c;
              if (!s && !w) return slotByKey.sw || slotByKey.c;
              if (!s && !e) return slotByKey.se || slotByKey.c;

              // Edges: one side missing
              if (!n) return slotByKey.n || slotByKey.c;
              if (!s) return slotByKey.s || slotByKey.c;
              if (!w) return slotByKey.w || slotByKey.c;
              if (!e) return slotByKey.e || slotByKey.c;

              return slotByKey.c;
            }

            // 4-edge only
            if (slotByKey.n && !slotByKey.c) {
              if (!n && slotByKey.n) return slotByKey.n;
              if (!s && slotByKey.s) return slotByKey.s;
              if (!w && slotByKey.w) return slotByKey.w;
              if (!e && slotByKey.e) return slotByKey.e;
              return rule.slots[0];
            }

            // 4-corner only
            if (slotByKey.nw && !slotByKey.c && !slotByKey.n) {
              if (!n && !w) return slotByKey.nw;
              if (!n && !e) return slotByKey.ne || slotByKey.nw;
              if (!s && !w) return slotByKey.sw || slotByKey.nw;
              if (!s && !e) return slotByKey.se || slotByKey.nw;
              return rule.slots[0];
            }

            // Fallback: first slot with a tile
            return rule.slots.find((s) => s.tile) || rule.slots[0];
          };

          // Place the tile at (x, y)
          const slot = resolveSlot(x, y);
          if (slot && slot.tile) {
            newData[y][x] = { ...slot.tile, ruleId: rule.id };
          } else {
            // Place a marker even without a tile assigned so neighbors detect it
            const fallback = rule.slots.find((s) => s.tile);
            if (fallback) {
              newData[y][x] = { ...fallback.tile, ruleId: rule.id };
            } else {
              return; // No tiles assigned at all
            }
          }

          // Update all neighbors that are part of this rule
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= state.mapWidth || ny < 0 || ny >= state.mapHeight) continue;
              const neighbor = newData[ny][nx];
              if (!neighbor || neighbor.ruleId !== rule.id) continue;
              const nSlot = resolveSlot(nx, ny);
              if (nSlot && nSlot.tile) {
                newData[ny][nx] = { ...nSlot.tile, ruleId: rule.id };
              }
            }
          }

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
          tileRules: [],
          activeTileRuleId: null,
          editingRuleId: null,
          editingSlotIndex: 0,
          spritesheets: [],
          activeSpritesheetId: null,
          activeAnimationIndex: 0,
          selectedObjectId: null,
          selectedObjectLayerId: null,
          snapToGrid: false,
          layers: [
            {
              id: 'layer-1',
              name: 'Layer 1',
              visible: true,
              locked: false,
              collision: false,
              data: createEmptyGrid(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT),
              objects: [],
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
        tileRules: state.tileRules,
        activeTileRuleId: state.activeTileRuleId,
        spritesheets: state.spritesheets,
        activeSpritesheetId: state.activeSpritesheetId,
        snapToGrid: state.snapToGrid,
      }),
    }
  )
);

export default useStore;
export { RULE_TEMPLATES };
