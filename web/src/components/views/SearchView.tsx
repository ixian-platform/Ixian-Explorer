'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { source } from '@/data/source';
import { classify } from '@/lib/address';
import { remember, routeFor } from '@/lib/search';
import { useStatus } from '@/lib/hooks';
import { links } from '@/lib/links';
import { middle } from '@/lib/format';
import Omnibox from '@/components/search/Omnibox';
import { StateBox, Skel, DocLink, RetryButton } from '@/components/ui/Primitives';
import p from '@/components/page/Page.module.css';
import s from './Search.module.css';

type Phase = { state: 'resolving' } | { state: 'bad'; reason: string } | { state: 'error' } | { state: 'idle' };

/**
 * Search results. A complete query resolves straight to its page; anything
 * else explains what was understood and what is missing.
 */
export default function SearchView() {
  const q = (useSearchParams().get('q') || '').trim();
  const router = useRouter();
  const { data: status } = useStatus();
  const [phase, setPhase] = useState<Phase>({ state: 'resolving' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const k = classify(q, status?.blockheight ?? null);
    if (k.kind === 'empty') return setPhase({ state: 'idle' });
    if (k.kind === 'partial') return setPhase({ state: 'bad', reason: k.hint });
    if (k.kind === 'invalid') {
      // pages that explain it better: a height still to come, an address or ID with a typo
      const to = /^#?\d[\d,]*$/.test(q)
        ? Number(q.replace(/[#,]/g, '')) >= 1 && `/block?h=${q.replace(/[#,]/g, '')}`
        : /^(?:[a-z]{1,4}-)?\d+-\S{20,}$/.test(q)
          ? `/tx?id=${encodeURIComponent(q)}`
          : /^[0-9A-Za-z_]{40,}$/.test(q) && `/address?a=${encodeURIComponent(q)}`;
      if (to) return router.replace(to);
      return setPhase({ state: 'bad', reason: k.reason });
    }
    let alive = true;
    setPhase({ state: 'resolving' });
    const go = () => {
      remember(q);
      router.replace(routeFor(k)!);
    };
    const check =
      k.kind === 'height'
        ? source.getBlock(k.height)
        : k.kind === 'blockHash'
          ? source.getBlockByHash(k.hash)
          : k.kind === 'txid'
            ? source.getTransaction(k.id)
            : Promise.resolve(true);
    check
      .then((r) => {
        if (!alive) return;
        if (r) go();
        else router.replace(routeFor(k)!);
      })
      .catch(() => alive && setPhase({ state: 'error' }));
    return () => {
      alive = false;
    };
  }, [q, nonce, router, status?.blockheight]);

  return (
    <div className={`ix-container ${p.page}`}>
      <div className={s.wrap}>
        <p className={s.eyebrow}>Search</p>
        <div className={s.box}>
          <Omnibox size="lg" initial={q} key={q} />
        </div>

        {phase.state === 'resolving' && (
          <div className={s.resolving} aria-busy="true" aria-live="polite">
            <span className="ix-sr">Looking up {q}</span>
            <Skel w="60%" h={18} />
            <Skel w="40%" h={14} />
          </div>
        )}
        {phase.state === 'bad' && (
          <StateBox kind="notfound" title="Nothing to open yet">
            <p className="ix-mono" style={{ wordBreak: 'break-all', color: 'var(--ix-text)' }}>
              {middle(q, 40, 20)}
            </p>
            <p style={{ marginTop: 8 }}>{phase.reason}</p>
          </StateBox>
        )}
        {phase.state === 'error' && <StateBox kind="error" title="Search could not reach the data." action={<RetryButton onClick={() => setNonce((n) => n + 1)} />} />}

        <div className={s.help}>
          <h2 className={s.helpTitle}>What you can search</h2>
          <dl className={s.kinds}>
            <div>
              <dt>Block height</dt>
              <dd>
                A number, like <span className="ix-mono">{status ? status.blockheight - 100 : '6276000'}</span>. Commas and a leading # are fine.
              </dd>
            </div>
            <div>
              <dt>Block hash</dt>
              <dd>128 hex characters, the block&apos;s SHA3-512 checksum.</dd>
            </div>
            <div>
              <dt>Transaction ID</dt>
              <dd>
                A block number, a dash and Base58 characters, like <span className="ix-mono">6276918-9mfPR…</span>
              </dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>
                49 to 66 Base58 characters. The checksum is verified as you type. <DocLink href={links.docs.addresses}>Address format</DocLink>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
