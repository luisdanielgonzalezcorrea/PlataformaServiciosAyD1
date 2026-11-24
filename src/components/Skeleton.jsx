/** Bloques grises animados con la forma del contenido que se está cargando. */
export function SkeletonLine({ w = "100%", h = 14 }) {
  return <span className="sk sk--line" style={{ width: w, height: h }} />;
}

export function SkeletonCards({ n = 6 }) {
  return (
    <div className="svc-grid" role="status" aria-label="Cargando">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-card" aria-hidden="true">
          <div className="sk-row"><span className="sk sk--pill" /><span className="sk sk--line" style={{ width: 56, height: 12 }} /></div>
          <SkeletonLine w="72%" h={20} />
          <SkeletonLine w="48%" />
          <SkeletonLine />
          <SkeletonLine w="86%" />
          <div className="sk-row sk-row--foot"><SkeletonLine w={90} h={26} /><span className="sk sk--btn" /></div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ n = 4, label = "Cargando" }) {
  return (
    <div className="sk-list" role="status" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="sk-item" aria-hidden="true">
          <div className="sk-item__main"><SkeletonLine w="46%" h={16} /><SkeletonLine w="30%" /></div>
          <span className="sk sk--pill" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ n = 5 }) {
  return (
    <div className="stat-grid" role="status" aria-label="Cargando panel">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="stat-card" aria-hidden="true"><SkeletonLine w={54} h={30} /><SkeletonLine w="70%" /></div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ h = 220 }) {
  return <div className="sk sk--block" style={{ height: h }} role="status" aria-label="Cargando" />;
}
