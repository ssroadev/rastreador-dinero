import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar     from './components/Navbar';
import Indicadores  from './pages/Indicadores';
import Evolucion    from './pages/Evolucion';
import ComisionesHora from './pages/ComisionesHora';
import Ballenas     from './pages/Ballenas';
import Fragmentacion from './pages/Fragmentacion';
import Distribucion from './pages/Distribucion';
import Mensual      from './pages/Mensual';
import TopBloques   from './pages/TopBloques';
import Concentracion from './pages/Concentracion';
import ConsultaNL   from './pages/ConsultaNL';
import TiempoReal   from './pages/TiempoReal';
import './App.layout.css';

function Header() {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="header-logo">₿</div>
        <div>
          <div className="header-name">Rastro del Dinero</div>
          <div className="header-sub">Bitcoin Analytics</div>
        </div>
      </div>

      <div className="header-spacer" />

      <div className="header-meta">
        <div className="header-meta-item">
          Network <span>mainnet</span>
        </div>
        <div className="header-meta-item">
          DB <span style={{ color: 'var(--green)' }}>connected</span>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Header />
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/"             element={<Indicadores />} />
            <Route path="/evolucion"    element={<Evolucion />} />
            <Route path="/comisiones"   element={<ComisionesHora />} />
            <Route path="/ballenas"      element={<Ballenas />} />
            <Route path="/fragmentacion" element={<Fragmentacion />} />
            <Route path="/distribucion"  element={<Distribucion />} />
            <Route path="/mensual"       element={<Mensual />} />
            <Route path="/bloques"       element={<TopBloques />} />
            <Route path="/concentracion" element={<Concentracion />} />
            <Route path="/nl"           element={<ConsultaNL />} />
            <Route path="/tiempo-real"  element={<TiempoReal />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
