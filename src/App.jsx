import Toolbar from './components/Toolbar';
import TilesetPanel from './components/TilesetPanel';
import TileRuleEditor from './components/TileRuleEditor';
import MapCanvas from './components/MapCanvas';
import LayerPanel from './components/LayerPanel';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="main-layout">
        <div className="left-panel">
          <TilesetPanel />
          <TileRuleEditor />
        </div>
        <MapCanvas />
        <LayerPanel />
      </div>
    </div>
  );
}
