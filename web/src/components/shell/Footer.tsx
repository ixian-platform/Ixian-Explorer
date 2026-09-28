import Link from 'next/link';
import Icon from '@/components/Icon';
import { links } from '@/lib/links';
import { Wordmark, NAV } from './nav';
import FooterDemo from './FooterDemo';
import PrivacyButton from './PrivacyButton';
import s from './Footer.module.css';

const COLS = [
  { title: 'Explore', items: NAV.map((n) => ({ label: n.label, href: n.href })) },
  {
    title: 'Ixian',
    items: [
      { label: 'ixian.io', href: links.site },
      { label: 'Documentation', href: links.docs.home },
      { label: 'Run a node', href: links.runNode },
      { label: 'GitHub', href: links.github },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Privacy policy', href: links.privacy },
      { label: 'Terms of use', href: links.terms },
      { label: 'Cookie policy', href: links.cookies },
    ],
  },
];

export default function Footer() {
  return (
    <footer className={s.footer}>
      <div className={`ix-container ${s.top}`}>
        <div className={s.brand}>
          <Link href="/" aria-label="ixiscope home" className={s.home}>
            <Wordmark />
          </Link>
          <p className={s.tag}>The block explorer for the Ixian platform. Search any block, transaction or address, and watch the network work.</p>
          <FooterDemo />
        </div>
        <nav className={s.cols} aria-label="Footer">
          {COLS.map((c) => (
            <div key={c.title}>
              <p className={s.colTitle}>{c.title}</p>
              <ul className={s.list}>
                {c.items.map((i) => (
                  <li key={i.label}>
                    {i.href.startsWith('http') ? (
                      <a href={i.href} target="_blank" rel="noreferrer" className={s.a}>
                        {i.label}
                        <Icon name="external" size={12} className={s.ext} />
                      </a>
                    ) : (
                      <Link href={i.href} className={s.a}>
                        {i.label}
                      </Link>
                    )}
                  </li>
                ))}
                {c.title === 'Legal' && (
                  <li>
                    <PrivacyButton />
                  </li>
                )}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className={`ix-container ${s.bottom}`}>
        <p>© 2017–2026 Ixian</p>
        <p className={s.kbd}>
          Press <kbd>/</kbd> anywhere to search
        </p>
      </div>
    </footer>
  );
}
