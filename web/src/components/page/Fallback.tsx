import s from './Page.module.css';

/** Server-rendered placeholder while a query-string page hydrates. Skeletons, never a spinner. */
export default function Fallback() {
  return (
    <div className={`ix-container ${s.page}`} aria-busy="true">
      <div className={s.head}>
        <div className={s.headMain}>
          <span className="ix-skel" style={{ width: 120, height: 12 }} />
          <span className="ix-skel" style={{ width: 'min(420px, 80%)', height: 44 }} />
          <span className="ix-skel" style={{ width: 260, height: 14 }} />
        </div>
      </div>
      <div style={{ marginTop: 28 }}>
        <span className="ix-skel" style={{ width: '100%', height: 96 }} />
      </div>
      <div style={{ marginTop: 40, display: 'grid', gap: 12 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="ix-skel" style={{ width: '100%', height: 18 }} />
        ))}
      </div>
    </div>
  );
}
