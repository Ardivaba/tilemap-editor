import Toolbar from './components/Toolbar';
import TilesetPanel from './components/TilesetPanel';
import MapCanvas from './components/MapCanvas';
import LayerPanel from './components/LayerPanel';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="main-layout">
        <TilesetPanel />
        <MapCanvas />
        <LayerPanel />
      </div>
    </div>
  );
}
