import useStore from '../store/useStore';

export default function ObjectPropertiesPanel() {
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const selectedObjectLayerId = useStore((s) => s.selectedObjectLayerId);
  const layers = useStore((s) => s.layers);
  const spritesheets = useStore((s) => s.spritesheets);
  const updateObject = useStore((s) => s.updateObject);
  const removeObject = useStore((s) => s.removeObject);
  const deselectObject = useStore((s) => s.deselectObject);
  const pushHistory = useStore((s) => s.pushHistory);

  if (!selectedObjectId || !selectedObjectLayerId) return null;

  const layer = layers.find((l) => l.id === selectedObjectLayerId);
  if (!layer) return null;

  const obj = (layer.objects || []).find((o) => o.id === selectedObjectId);
  if (!obj) return null;

  const ss = spritesheets.find((s) => s.id === obj.spritesheetId);
  if (!ss) return null;

  const anim = ss.animations[obj.animationIndex] || ss.animations[0];

  const update = (changes) => {
    updateObject(selectedObjectLayerId, selectedObjectId, changes);
  };

  return (
    <div className="object-properties">
      <div className="panel-header">Object Properties</div>
      <div className="obj-props-body">
        <label>
          Name
          <input
            type="text"
            value={obj.name || ''}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>

        <label>
          Animation
          <select
            value={obj.animationIndex}
            onChange={(e) => update({ animationIndex: Number(e.target.value), frame: 0 })}
          >
            {ss.animations.map((a, i) => (
              <option key={i} value={i}>{a.name}</option>
            ))}
          </select>
        </label>

        <label>
          Frame
          <input
            type="number"
            min="0"
            max={anim.frameCount - 1}
            value={obj.frame || 0}
            onChange={(e) => update({ frame: Number(e.target.value) })}
          />
          <span className="prop-hint">/ {anim.frameCount - 1}</span>
        </label>

        <div className="prop-row">
          <label>
            X
            <input
              type="number"
              value={Math.round(obj.x)}
              onChange={(e) => update({ x: Number(e.target.value) })}
            />
          </label>
          <label>
            Y
            <input
              type="number"
              value={Math.round(obj.y)}
              onChange={(e) => update({ y: Number(e.target.value) })}
            />
          </label>
        </div>

        <div className="prop-row">
          <label>
            Scale X
            <input
              type="number"
              step="0.1"
              value={obj.scaleX ?? 1}
              onChange={(e) => update({ scaleX: Number(e.target.value) })}
            />
          </label>
          <label>
            Scale Y
            <input
              type="number"
              step="0.1"
              value={obj.scaleY ?? 1}
              onChange={(e) => update({ scaleY: Number(e.target.value) })}
            />
          </label>
        </div>

        <div className="prop-row flip-row">
          <button
            className={`flip-btn ${(obj.scaleX ?? 1) < 0 ? 'active' : ''}`}
            onClick={() => update({ scaleX: -(obj.scaleX ?? 1) })}
          >
            Flip H
          </button>
          <button
            className={`flip-btn ${(obj.scaleY ?? 1) < 0 ? 'active' : ''}`}
            onClick={() => update({ scaleY: -(obj.scaleY ?? 1) })}
          >
            Flip V
          </button>
        </div>

        <button
          className="delete-object-btn"
          onClick={() => {
            pushHistory();
            removeObject(selectedObjectLayerId, selectedObjectId);
          }}
        >
          Delete Object
        </button>
      </div>
    </div>
  );
}
