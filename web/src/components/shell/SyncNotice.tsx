'use client';

import Link from 'next/link';
import { useStatus } from '@/lib/hooks';
import { int } from '@/lib/format';
import { BLOCK_SECONDS } from '@/data/emission';
import s from './SyncNotice.module.css';

/* ------------------------------------------------------------------------
   The explorer is catching up: more than 10 blocks behind the network
   (the same rule as the PHP explorer's "IXIScope is synchronizing"). A quiet strip under the header, in the language of the status
   dots elsewhere: what is happening, how far behind, what may be missing.
   It goes away by itself once the explorer has caught up.
   ------------------------------------------------------------------------ */

const LAG = 10;

function behindText(blocks: number) {
  const sec = blocks * BLOCK_SECONDS;
  if (sec < 5400) return `about ${Math.max(1, Math.round(sec / 60))} min`;
  if (sec < 172800) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return `about ${h} h${m ? ` ${m} min` : ''}`;
  }
  return `about ${Math.round(sec / 86400)} days`;
}

export default function SyncNotice() {
  const { data } = useStatus();
  if (!data || data.indexedHeight == null) return null;
  const behind = data.blockheight - data.indexedHeight;
  if (behind <= LAG) return null;
  return (
    <div className={s.strip} role="status">
      <div className={`ix-container ${s.inner}`}>
        <p className={s.lead}>
          <i className="ix-status" data-s="warning" aria-hidden />
          <b>Catching up with the network.</b>
          <span className={s.muted}>The newest blocks, transactions and balances may be missing for now.</span>
        </p>
        <p className={s.figs}>
          <span>
            indexed to <Link href={`/block?h=${data.indexedHeight}`} className="ix-link ix-num">{int(data.indexedHeight)}</Link>
          </span>
          <span>
            network at <span className="ix-num">{int(data.blockheight)}</span>
          </span>
          <span className={s.muted}>
            {int(behind)} blocks, {behindText(behind)} behind
          </span>
        </p>
      </div>
    </div>
  );
}
