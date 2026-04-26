import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { RULE_TEMPLATES } from '../store/useStore';

export default function TileRuleEditor() {
  const tileRules = useStore((s) => s.tileRules);
  const activeTileRuleId = useStore((s) => s.activeTileRuleId);
  const editingRuleId = useStore((s) => s.editingRuleId);
  const editingSlotIndex = useStore((s) => s.editingSlotIndex);
  const tilesets = useStore((s) => s.tilesets);
  const createTileRule = useStore((s) => s.createTileRule);
  const deleteTileRule = useStore((s) => s.deleteTileRule);
  const setActiveTileRule = useStore((s) => s.setActiveTileRule);
  const clearActiveTileRule = useStore((s) => s.clearActiveTileRule);
  const startEditingRule = useStore((s) => s.startEditingRule);
  const stopEditingRule = useStore((s) => s.stopEditingRule);
  const setEditingSlotIndex = useStore((s) => s.setEditingSlotIndex);
  const clearSlotTile = useStore((s) => s.clearSlotTile);
  const addCustomSlot = useStore((s) => s.addCustomSlot);
  const removeCustomSlot = useStore((s) => s.removeCustomSlot);
  const renameTileRule = useStore((s) => s.renameTileRule);

  const [showCreate, setShowCreate] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTemplate, setNewRuleTemplate] = useState('9-tile');
  const [customSlotLabel, setCustomSlotLabel] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [imageCache, setImageCache] = useState({});

  // Load images
  useEffect(() => {
    tilesets.forEach((ts) => {
      if (!imageCache[ts.id]) {
        const img = new Image();
        img.onload = () => setImageCache((prev) => ({ ...prev, [ts.id]: img }));
        img.src = ts.dataUrl;
      }
    });
  }, [tilesets]);

  const editingRule = tileRules.find((r) => r.id === editingRuleId);

  const handleCreate = () => {
    if (!newRuleName.trim()) return;
    createTileRule(newRuleTemplate, newRuleName.trim());
    setNewRuleName('');
    setShowCreate(false);
  };

  return (
    <div className="tile-rule-editor">
      <div className="panel-header">
        Tile Rules
        <button
          className="icon-btn"
          onClick={() => setShowCreate(!showCreate)}
          title="Create Tile Rule"
        >
          +
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rule-create-form">
          <input
            type="text"
            placeholder="Rule name..."
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <select
            value={newRuleTemplate}
            onChange={(e) => setNewRuleTemplate(e.target.value)}
          >
            {Object.entries(RULE_TEMPLATES).map(([key, tmpl]) => (
              <option key={key} value={key}>
                {tmpl.name}
              </option>
            ))}
          </select>
          <div className="rule-create-actions">
            <button onClick={handleCreate}>Create</button>
            <button onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Rule list */}
      <div className="rule-list">
        {tileRules.map((rule) => (
          <div
            key={rule.id}
            className={`rule-item ${rule.id === activeTileRuleId ? 'active' : ''} ${
              rule.id === editingRuleId ? 'editing' : ''
            }`}
          >
            <div
              className="rule-item-header"
              onClick={() => {
                if (activeTileRuleId === rule.id) {
                  clearActiveTileRule();
                } else {
                  setActiveTileRule(rule.id);
                }
              }}
            >
              <div className="rule-name">
                {renamingId === rule.id ? (
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => {
                      if (renameValue.trim()) renameTileRule(rule.id, renameValue.trim());
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (renameValue.trim()) renameTileRule(rule.id, renameValue.trim());
                        setRenamingId(null);
                      }
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(rule.id);
                      setRenameValue(rule.name);
                    }}
                  >
                    {rule.name}
                  </span>
                )}
              </div>
              <div className="rule-actions">
                <button
                  className={`icon-btn small ${
                    editingRuleId === rule.id ? 'on' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (editingRuleId === rule.id) {
                      stopEditingRule();
                    } else {
                      startEditingRule(rule.id);
                    }
                  }}
                  title={editingRuleId === rule.id ? 'Stop editing' : 'Edit slots'}
                >
                  {editingRuleId === rule.id ? 'Done' : 'Edit'}
                </button>
                <button
                  className="icon-btn small delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTileRule(rule.id);
                  }}
                  title="Delete rule"
                >
                  x
                </button>
              </div>
            </div>

            {/* Slot grid - always show a preview, expanded when editing */}
            <SlotGrid
              rule={rule}
              isEditing={editingRuleId === rule.id}
              editingSlotIndex={editingRuleId === rule.id ? editingSlotIndex : -1}
              onSlotClick={(idx) => {
                if (editingRuleId !== rule.id) {
                  startEditingRule(rule.id);
                }
                setEditingSlotIndex(idx);
              }}
              onSlotClear={(idx) => clearSlotTile(rule.id, idx)}
              onSlotRemove={(idx) => removeCustomSlot(rule.id, idx)}
              imageCache={imageCache}
              tilesets={tilesets}
              isCustom={rule.templateKey === 'custom'}
            />

            {/* Custom slot add */}
            {editingRuleId === rule.id && rule.templateKey === 'custom' && (
              <div className="custom-slot-add">
                <input
                  type="text"
                  placeholder="Slot label..."
                  value={customSlotLabel}
                  onChange={(e) => setCustomSlotLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customSlotLabel.trim()) {
                      addCustomSlot(rule.id, customSlotLabel.trim());
                      setCustomSlotLabel('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (customSlotLabel.trim()) {
                      addCustomSlot(rule.id, customSlotLabel.trim());
                      setCustomSlotLabel('');
                    }
                  }}
                >
                  Add Slot
                </button>
              </div>
            )}
          </div>
        ))}

        {tileRules.length === 0 && (
          <div className="rule-empty">
            No tile rules yet. Click + to create one.
          </div>
        )}
      </div>

      {editingRuleId && (
        <div className="rule-edit-hint">
          Click a tile in the tileset to assign it to the selected slot.
          Hold <kbd>Ctrl</kbd> to auto-advance to next slot.
        </div>
      )}
    </div>
  );
}

function SlotGrid({
  rule,
  isEditing,
  editingSlotIndex,
  onSlotClick,
  onSlotClear,
  onSlotRemove,
  imageCache,
  tilesets,
  isCustom,
}) {
  const cols = rule.cols || 3;

  return (
    <div
      className={`slot-grid ${isEditing ? 'editing' : 'preview'}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {rule.slots.map((slot, idx) => {
        const isActive = editingSlotIndex === idx;
        const hasTile = slot.tile !== null;
        const ts = hasTile ? tilesets.find((t) => t.id === slot.tile.tilesetId) : null;

        return (
          <div
            key={idx}
            className={`slot-cell ${isActive ? 'active' : ''} ${hasTile ? 'filled' : 'empty'}`}
            onClick={() => onSlotClick(idx)}
            title={slot.label}
          >
            {hasTile && ts && (
              <SlotTilePreview
                tile={slot.tile}
                tileset={ts}
                imageCache={imageCache}
              />
            )}
            <span className="slot-label">{slot.label}</span>
            {isEditing && hasTile && (
              <button
                className="slot-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  onSlotClear(idx);
                }}
                title="Clear tile"
              >
                x
              </button>
            )}
            {isEditing && isCustom && (
              <button
                className="slot-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onSlotRemove(idx);
                }}
                title="Remove slot"
              >
                -
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SlotTilePreview({ tile, tileset, imageCache }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = imageCache[tileset.id];
    if (!img) return;

    const size = 28;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(
      img,
      tile.col * tileset.tileWidth,
      tile.row * tileset.tileHeight,
      tileset.tileWidth,
      tileset.tileHeight,
      0,
      0,
      size,
      size
    );
  }, [tile, tileset, imageCache]);

  return <canvas ref={canvasRef} className="slot-tile-preview" />;
}
