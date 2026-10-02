'use client';

import { useEffect, useState } from 'react';
import type { NodeInfo } from '@/data/types';
import { source } from '@/data/source';
import { isNotAvailable } from '@/data/api';
import Omnibox from '@/components/search/Omnibox';
import GlobePanel from '@/components/globe/GlobePanel';
import KeyNumbers from './KeyNumbers';
import s from './Home.module.css';

export default function HomeHero() {
  const [nodes, setNodes] = useState<NodeInfo[] | null>(null);
  const [error, setError] = useState(false);
  const [unpublished, setUnpublished] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(false);
    source
      .getNodes()
      .then((n) => alive && setNodes(n))
      .catch((e) => {
        if (!alive) return;
        if (isNotAvailable(e)) {
          setUnpublished(true);
          setNodes([]);
        } else setError(true);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={`ix-container ${s.heroGrid}`}>
        <div className={s.copy}>
          <h1 id="hero-title" className={s.h1}>
            ixiscope.
            <span className={s.h1b}> The Ixian network, live.</span>
          </h1>
          <p className={s.heroLead}>Find any block, transaction or address, and watch the nodes that keep it running.</p>
          <div className={s.search}>
            <Omnibox size="lg" />
          </div>
        </div>
        <div className={s.nums}>
          <KeyNumbers />
        </div>
        <div className={s.globe}>
          <GlobePanel nodes={nodes} variant="hero" error={error} unpublished={unpublished} onRetry={() => setNonce((n) => n + 1)} />
        </div>
      </div>
    </section>
  );
}
