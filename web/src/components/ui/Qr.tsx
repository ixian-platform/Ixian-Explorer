'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import Icon from '@/components/Icon';
import s from './Qr.module.css';

/** QR code of an address, drawn as one SVG path. Behind a button, so it costs nothing until asked for. */
export default function QrButton({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const path = useMemo(() => {
    if (!open) return null;
    const q = qrcode(0, 'M');
    q.addData(value);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [open, value]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);
  return (
    <div className={s.wrap} ref={wrap}>
      <button type="button" className="ix-btn ix-btn--sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="qr" size={14} /> QR code
      </button>
      {open && path && (
        <div id={id} className={s.pop} role="dialog" aria-label="QR code of this address">
          <svg viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} width="200" height="200" className={s.svg} role="img" aria-label={`QR code for ${value}`}>
            <rect x="-2" y="-2" width={path.n + 4} height={path.n + 4} fill="var(--ix-grey-100)" />
            <path d={path.d} fill="var(--ix-grey-1000)" shapeRendering="crispEdges" />
          </svg>
          <p className={s.note}>Scan with an Ixian wallet such as Spixi.</p>
        </div>
      )}
    </div>
  );
}
