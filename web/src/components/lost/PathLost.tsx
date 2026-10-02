'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStatus } from '@/lib/hooks';
import { int, middle } from '@/lib/format';
import { describe } from '@/lib/search';
import { legacyTarget, nearestPage, readSegment } from '@/lib/lost';
import Omnibox from '@/components/search/Omnibox';
import { Lost, Trace, Row } from './Lost';
import s from './Lost.module.css';

/** The 404 page: old explorer links and chain values in the path are sent on; anything else gets a trace and a way out. */
export default function PathLost() {
  const router = useRouter();
  const { data: status } = useStatus();
  const latest = status?.blockheight ?? null;
  const [where, setWhere] = useState<{ path: string; search: string } | null>(null);
  useEffect(() => setWhere({ path: window.location.pathname, search: window.location.search }), []);

  const legacy = where ? legacyTarget(where.search) : null;
  const seg = where && !legacy ? readSegment(where.path, latest) : null;
  const to = legacy ?? seg?.to ?? null;
  const page = where && !to ? nearestPage(where.path) : null;

  useEffect(() => {
    if (to) router.replace(to);
  }, [to, router]);

  if (to) {
    return (
      <Lost
        eyebrow="Redirect"
        title={legacy ? ['Old link,', 'new address.'] : ['Found it', 'on another path.']}
        lead={
          legacy
            ? 'This link is from the previous explorer. The same page lives here now.'
            : `The path reads as ${seg && seg.kind.kind !== 'invalid' && seg.kind.kind !== 'partial' ? describe(seg.kind).toLowerCase() : 'a block height'}. Opening it.`
        }
        actions={
          <Link href={to} className="ix-btn ix-btn--primary">
            Open it now
          </Link>
        }
      />
    );
  }

  return (
    <Lost
      eyebrow="Error 404"
      title={['This path isn’t', 'on the chain.']}
      lead="ixiscope read it as a page, a block, a transaction and an address. Nothing matched. The link may be old, or a character slipped."
      actions={
        <>
          {latest != null ? (
            <Link href={`/block?h=${latest}`} className="ix-btn ix-btn--primary">
              Latest block #{int(latest)}
            </Link>
          ) : (
            <Link href="/blocks" className="ix-btn ix-btn--primary">
              Latest blocks
            </Link>
          )}
          <Link href="/" className="ix-btn">
            Home
          </Link>
        </>
      }
      search={<Omnibox />}
      aside={
        <Trace label="What ixiscope checked">
          <Row k="Path">
            <code className={s.mono}>{where ? middle(decodeSafe(where.path), 28, 14) : '/'}</code>
          </Row>
          <Row k="Read as" state="no" note="Not a block height, block hash, transaction ID or address.">
            No chain value
          </Row>
          <Row k="Page" state="no" note="Error 404. Nothing answers at this path.">
            None here
          </Row>
          {page && (
            <Row k="Nearby" state="ok">
              <Link className={s.guess} href={page.href}>
                Did you mean <b>{page.label}</b>? <span aria-hidden>→</span>
              </Link>
            </Row>
          )}
        </Trace>
      }
    />
  );
}

function decodeSafe(p: string) {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}
