import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar     from './components/Navbar';
import Indicadores  from './pages/Indicadores';
import Evolucion    from './pages/Evolucion';
import ComisionesHora from './pages/ComisionesHora';
import TopBloques   from './pages/TopBloques';
import Distribucion from './pages/Distribucion';
import Atipicas     from './pages/Atipicas';
import Mensual      from './pages/Mensual';
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
    <BrowserRouter>
      <Header />
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/"             element={<Indicadores />} />
            <Route path="/evolucion"    element={<Evolucion />} />
            <Route path="/comisiones"   element={<ComisionesHora />} />
            <Route path="/bloques"      element={<TopBloques />} />
            <Route path="/distribucion" element={<Distribucion />} />
            <Route path="/atipicas"     element={<Atipicas />} />
            <Route path="/mensual"      element={<Mensual />} />
            <Route path="/nl"           element={<ConsultaNL />} />
            <Route path="/tiempo-real"  element={<TiempoReal />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
