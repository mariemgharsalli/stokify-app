function CssCube({ size = 28, tone = "cyan", className = "" }) {
  return (
    <div className={`sb-cube ${className}`} style={{ "--cube": `${size}px` }} data-tone={tone}>
      <div className="sb-cube-spin">
        <span className="sb-cube-face sb-cube-face--front" />
        <span className="sb-cube-face sb-cube-face--back" />
        <span className="sb-cube-face sb-cube-face--left" />
        <span className="sb-cube-face sb-cube-face--right" />
        <span className="sb-cube-face sb-cube-face--top" />
        <span className="sb-cube-face sb-cube-face--bottom" />
      </div>
    </div>
  );
}

export function Sidebar3DAmbient() {
  return (
    <div className="sb-3d-ambient" aria-hidden>
      <CssCube size={22} tone="orange" className="sb-3d-float sb-3d-float--a" />
      <CssCube size={16} tone="orange" className="sb-3d-float sb-3d-float--b" />
      <CssCube size={18} tone="orange" className="sb-3d-float sb-3d-float--c" />
      <CssCube size={14} tone="orange" className="sb-3d-float sb-3d-float--d" />
    </div>
  );
}

export function Sidebar3DIcon({ children, active = false }) {
  return (
    <span className={`sb-nav-icon-wrap sb-3d-icon${active ? " is-lit" : ""}`}>
      <span className="sb-3d-icon-depth" aria-hidden />
      <span className="sb-3d-icon-shine" aria-hidden />
      {children}
    </span>
  );
}
