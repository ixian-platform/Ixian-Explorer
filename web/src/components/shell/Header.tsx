'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV, Wordmark } from './nav';
import Icon from '@/components/Icon';
import { DemoChip } from '@/components/ui/Demo';
import ThemeToggle from './ThemeToggle';
import { openPalette } from '@/components/search/Palette';
import { useIsMac } from '@/lib/hooks';
import s from './Header.module.css';

export default function Header() {
  const path = usePathname() || '/';
  const mac = useIsMac();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLElement>(null);

  useEffect(() => setMenu(false), [path]);
  // glass on scroll; hide on scroll down, back on scroll up (as on ixian.io)
  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 8);
        if (Math.abs(y - last) > 6) {
          setHidden(y > last && y > 320);
          last = y;
        }
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      cancelAnimationFrame(raf);
    };
  }, []);
  // never hide while the menu is open or the keyboard is in the bar; tell sticky bars below
  const away = hidden && !menu;
  useEffect(() => {
    document.documentElement.toggleAttribute('data-nav-hidden', away);
    return () => document.documentElement.removeAttribute('data-nav-hidden');
  }, [away]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const isActive = (m: string[]) => m.some((x) => path === x || path.startsWith(x + '/'));

  return (
    <header ref={bar} className={s.header} data-scrolled={scrolled || menu || undefined} data-hidden={away || undefined} onFocus={() => setHidden(false)}>
      <div className={`ix-container ${s.bar}`}>
        <Link href="/" className={s.home} aria-label="ixiscope home">
          <Wordmark />
        </Link>

        <nav className={s.nav} aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={s.link} aria-current={isActive(n.match) ? 'page' : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className={s.right}>
          <button type="button" className={s.search} onClick={openPalette} aria-label="Search (Control K)" aria-keyshortcuts="Control+K Meta+K /">
            <Icon name="search" size={16} />
            <span className={s.searchText}>Search blocks, transactions, addresses</span>
            <span className={s.keys} aria-hidden>
              <kbd>{mac ? '⌘' : 'Ctrl'}</kbd>
              <kbd>K</kbd>
            </span>
          </button>
          <DemoChip />
          <ThemeToggle />
          <button
            ref={toggle}
            type="button"
            className={s.menuBtn}
            aria-expanded={menu}
            aria-controls="ixs-menu"
            aria-label={menu ? 'Close menu' : 'Open menu'}
            onClick={() => setMenu((m) => !m)}
          >
            <Icon name={menu ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>
      <div id="ixs-menu" className={s.menu} hidden={!menu}>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={s.menuLink} aria-current={isActive(n.match) ? 'page' : undefined}>
              {n.label}
              <Icon name="chevron" size={18} />
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
