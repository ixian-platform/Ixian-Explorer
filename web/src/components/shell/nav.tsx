import { MARK_D } from '@/components/Logo';
import s from './Header.module.css';

export const NAV = [
  { href: '/blocks', label: 'Blocks', match: ['/blocks', '/block', '/tx'] },
  { href: '/network', label: 'Network', match: ['/network'] },
  { href: '/stats', label: 'Statistics', match: ['/stats'] },
  { href: '/ixi', label: 'IXI', match: ['/ixi', '/address'] },
];

export function Wordmark() {
  return (
    <span className={s.brand}>
      <svg className={s.mark} viewBox="3 1 26 30" aria-hidden>
        <path d={MARK_D} fill="var(--ix-action)" />
      </svg>
      <span className={s.word}>ixiscope</span>
    </span>
  );
}

