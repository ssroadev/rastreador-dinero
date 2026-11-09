/**
 * Standard page header with icon, title, subtitle.
 * Props: icon (lucide component), title, subtitle, actions (slot)
 */
export default function PageHeader({ Icon, title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-title">
        <div className="page-icon">
          {Icon && <Icon size={15} strokeWidth={1.8} />}
        </div>
        <div>
          <div className="page-title">{title}</div>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
