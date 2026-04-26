import { useState } from 'react';
import useStore from '../store/useStore';

export default function LayerPanel() {
  const layers = useStore((s) => s.layers);
  const activeLayerId = useStore((s) => s.activeLayerId);
  const addLayer = useStore((s) => s.addLayer);
  const removeLayer = useStore((s) => s.removeLayer);
  const setActiveLayer = useStore((s) => s.setActiveLayer);
  const toggleLayerVisibility = useStore((s) => s.toggleLayerVisibility);
  const toggleLayerLock = useStore((s) => s.toggleLayerLock);
  const toggleLayerCollision = useStore((s) => s.toggleLayerCollision);
  const renameLayer = useStore((s) => s.renameLayer);
  const moveLayer = useStore((s) => s.moveLayer);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const startRename = (layer) => {
    setEditingId(layer.id);
    setEditName(layer.name);
  };

  const finishRename = () => {
    if (editingId && editName.trim()) {
      renameLayer(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="panel layer-panel">
      <div className="panel-header">
        Layers
        <button className="icon-btn" onClick={addLayer} title="Add Layer">
          +
        </button>
      </div>

      <div className="layer-list">
        {[...layers].reverse().map((layer) => (
          <div
            key={layer.id}
            className={`layer-item ${
              layer.id === activeLayerId ? 'active' : ''
            }`}
            onClick={() => setActiveLayer(layer.id)}
          >
            <div className="layer-controls">
              <button
                className={`icon-btn small ${layer.visible ? 'on' : 'off'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerVisibility(layer.id);
                }}
                title={layer.visible ? 'Hide' : 'Show'}
              >
                {layer.visible ? '👁' : '◌'}
              </button>
              <button
                className={`icon-btn small ${layer.locked ? 'on' : 'off'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerLock(layer.id);
                }}
                title={layer.locked ? 'Unlock' : 'Lock'}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>
            </div>

            <div className="layer-name">
              {editingId === layer.id ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span onDoubleClick={() => startRename(layer)}>
                  {layer.name}
                </span>
              )}
            </div>

            <div className="layer-actions">
              <button
                className={`icon-btn small collision-btn ${
                  layer.collision ? 'on' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerCollision(layer.id);
                }}
                title={
                  layer.collision
                    ? 'Remove collision flag'
                    : 'Mark as collision layer'
                }
              >
                C
              </button>
              <button
                className="icon-btn small"
                onClick={(e) => {
                  e.stopPropagation();
                  moveLayer(layer.id, 1);
                }}
                title="Move Up"
              >
                ↑
              </button>
              <button
                className="icon-btn small"
                onClick={(e) => {
                  e.stopPropagation();
                  moveLayer(layer.id, -1);
                }}
                title="Move Down"
              >
                ↓
              </button>
              <button
                className="icon-btn small delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(layer.id);
                }}
                title="Delete Layer"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
