/** Estado vacío con ilustración sencilla (SVG) y una acción opcional. */
const ART = {
  search: (<><circle cx="52" cy="50" r="22" /><path d="M69 67l22 22" /><path d="M42 50h20M52 40v20" opacity=".55" /></>),
  calendar: (<><rect x="22" y="30" width="76" height="66" rx="12" /><path d="M22 52h76M44 20v18M76 20v18" /><circle cx="60" cy="74" r="6" opacity=".55" /></>),
  box: (<><path d="M60 24l38 18v36L60 96 22 78V42z" /><path d="M22 42l38 18 38-18M60 60v36" opacity=".6" /></>),
  lost: (<><circle cx="60" cy="60" r="38" /><path d="M46 78c4-8 24-8 28 0M46 48v4M74 48v4" /></>),
};

export default function EmptyState({ icon = "search", title, children, action }) {
  return (
    <div className="empty">
      <svg className="empty__art" viewBox="0 0 120 120" width="112" height="112" aria-hidden="true" focusable="false">
        <circle cx="60" cy="60" r="56" className="empty__bg" />
        <g className="empty__lines">{ART[icon] || ART.search}</g>
        <circle cx="96" cy="26" r="6" className="empty__spark" />
      </svg>
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
