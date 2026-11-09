import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Flame,
  Blocks,
  BarChart3,
  AlertTriangle,
  CalendarRange,
  BrainCircuit,
  Radio,
} from 'lucide-react';
import './Navbar.css';

const SECTIONS = [
  {
    label: 'Análisis',
    items: [
      { to: '/',             label: 'Indicadores',    Icon: LayoutDashboard },
      { to: '/evolucion',    label: 'Evolución',       Icon: TrendingUp },
      { to: '/comisiones',   label: 'Mapa de Calor',   Icon: Flame },
      { to: '/bloques',      label: 'Top Bloques',     Icon: Blocks },
      { to: '/distribucion', label: 'Distribución',    Icon: BarChart3 },
      { to: '/mensual',      label: 'Comparación',     Icon: CalendarRange },
    ],
  },
  {
    label: 'Inteligencia',
    items: [
      { to: '/atipicas',     label: 'Atípicas',        Icon: AlertTriangle },
      { to: '/nl',           label: 'Lenguaje Natural', Icon: BrainCircuit },
    ],
  },
  {
    label: 'Tiempo Real',
    items: [
      { to: '/tiempo-real',  label: 'Monitor Live',    Icon: Radio },
    ],
  },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      {SECTIONS.map(({ label, items }) => (
        <div className="sidebar-section" key={label}>
          <div className="sidebar-section-label">{label}</div>
          {items.map(({ to, label: lbl, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="nav-item-icon" size={14} strokeWidth={1.8} />
              {lbl}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
