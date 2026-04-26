import { useState, useRef, useEffect } from 'react';

export default function AssetPicker({ items, activeId, onSelect, onRemove, label }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const activeItem = items.find((i) => i.id === activeId);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  // Group by category (text before " - " in the name, or full name)
  const grouped = {};
  for (const item of filtered) {
    const dashIdx = item.name.indexOf(' - ');
    const category = dashIdx > 0 ? item.name.slice(0, dashIdx) : 'Other';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  }
  const categories = Object.keys(grouped).sort();

  return (
    <div className="asset-picker" ref={containerRef}>
      <button
        className="asset-picker-btn"
        onClick={() => { setOpen(!open); setSearch(''); }}
        title={activeItem?.name || `Select ${label}`}
      >
        <span className="asset-picker-label">
          {activeItem ? activeItem.name : `Select ${label}...`}
        </span>
        <span className="asset-picker-arrow">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className="asset-picker-dropdown">
          <input
            ref={searchRef}
            className="asset-picker-search"
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="asset-picker-list">
            {filtered.length === 0 && (
              <div className="asset-picker-empty">No matches</div>
            )}
            {categories.map((cat) => (
              <div key={cat} className="asset-picker-group">
                {categories.length > 1 && (
                  <div className="asset-picker-category">{cat}</div>
                )}
                {grouped[cat].map((item) => {
                  const displayName = item.name.includes(' - ')
                    ? item.name.slice(item.name.indexOf(' - ') + 3)
                    : item.name;
                  return (
                    <div
                      key={item.id}
                      className={`asset-picker-item ${item.id === activeId ? 'active' : ''}`}
                      onClick={() => {
                        onSelect(item.id);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <span className="asset-picker-item-name">{displayName}</span>
                      {onRemove && (
                        <button
                          className="asset-picker-item-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(item.id);
                          }}
                          title="Remove"
                        >
                          x
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
