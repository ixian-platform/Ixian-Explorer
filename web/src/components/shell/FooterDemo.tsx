'use client';

import { isDemo } from '@/data/source';
import { DemoGlyph, DEMO_LINE } from '@/components/ui/Demo';
import s from './Footer.module.css';

/** The one-line explanation of the demo marker, repeated in every footer. */
export default function FooterDemo() {
  if (!isDemo()) return null;
  return (
    <p className={s.demo}>
      <DemoGlyph />
      <span>{DEMO_LINE} Blocks, transactions, addresses and nodes are generated from a fixed seed.</span>
    </p>
  );
}
