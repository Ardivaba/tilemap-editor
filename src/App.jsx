import { useState } from 'react';
import Toolbar from './components/Toolbar';
import TilesetPanel from './components/TilesetPanel';
import TileRuleEditor from './components/TileRuleEditor';
import SpritesheetPanel from './components/SpritesheetPanel';
import MapCanvas from './components/MapCanvas';
import LayerPanel from './components/LayerPanel';
import ObjectPropertiesPanel from './components/ObjectPropertiesPanel';
import './App.css';

export default function App() {
  const [leftTab, setLeftTab] = useState('tiles');

  return (
    <div className="app">
      <Toolbar />
      <div className="main-layout">
        <div className="left-panel">
          <div className="left-panel-tabs">
            <button
              className={`tab-btn ${leftTab === 'tiles' ? 'active' : ''}`}
              onClick={() => setLeftTab('tiles')}
            >
              Tiles
            </button>
            <button
              className={`tab-btn ${leftTab === 'objects' ? 'active' : ''}`}
              onClick={() => setLeftTab('objects')}
            >
              Objects
            </button>
          </div>
          {leftTab === 'tiles' ? (
            <>
              <TilesetPanel />
              <TileRuleEditor />
            </>
          ) : (
            <SpritesheetPanel />
          )}
        </div>
        <MapCanvas />
        <div className="right-panel">
          <LayerPanel />
          <ObjectPropertiesPanel />
        </div>
      </div>
    </div>
  );
}
