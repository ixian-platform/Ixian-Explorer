'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { AddressTxSort, Range, SortDir } from '@/data/types';
import { source } from '@/data/source';
import { useQuery } from '@/lib/hooks';
import { checkAddress, baseAddress } from '@/lib/address';
import { compact, int, dec } from '@/lib/format';
import { links } from '@/lib/links';
import { PageHead, Section, Figures, Fig } from '@/components/page/Page';
import { Amount, CopyButton, Segmented, Skel, StateBox, RetryButton, Pager, DocLink } from '@/components/ui/Primitives';
import { DemoTag } from '@/components/ui/Demo';
import QrButton from '@/components/ui/Qr';
import Chart from '@/components/charts/Chart';
import { AddressTxTable } from '@/components/tables/TxTable';
import p from '@/components/page/Page.module.css';

const PAGE = 25;

export default function AddressView() {
  const q = useSearchParams();
  const raw = q.get('a') || '';
  const addr = baseAddress(raw);
  const check = useMemo(() => (addr ? checkAddress(addr) : null), [addr]);
  const valid = !!check?.ok;
  const info = useQuery(valid ? addr : null, () => source.getAddress(addr));
  const [range, setRange] = useState<Range>('30d');
  const hist = useQuery(valid && info.status === 'ok' ? `${addr}|${range}` : null, () => source.getBalanceHistory(addr, range));
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<AddressTxSort>('time');
  const [dir, setDir] = useState<SortDir>('desc');
  useEffect(() => setPage(0), [addr, sort, dir]);
  const txs = useQuery(valid && info.status === 'ok' ? `${addr}|${page}|${sort}|${dir}` : null, () =>
    source.getAddressTransactions(addr, { page, pageSize: PAGE, sort, dir })
  );

  if (!addr) {
    return (
      <div className={`ix-container ${p.page}`}>
        <StateBox kind="notfound" title="Which address?">
          Search for an Ixian address: 49 to 66 Base58 characters.
        </StateBox>
      </div>
    );
  }
  if (check && !check.ok) {
    return (
      <div className={`ix-container ${p.page}`}>
        <StateBox kind="notfound" title="This is not a valid Ixian address" action={<DocLink href={links.docs.addresses}>How addresses are built</DocLink>}>
          <p className="ix-mono" style={{ wordBreak: 'break-all', color: 'var(--ix-text)' }}>
            {addr}
          </p>
          <p style={{ marginTop: 8 }}>{check.reason}</p>
        </StateBox>
      </div>
    );
  }
  if (info.status === 'error' && !info.data) {
    return (
      <div className={`ix-container ${p.page}`}>
        <StateBox kind="error" title="This address could not be loaded" action={<RetryButton onClick={info.reload} />}>
          {info.error.message}
        </StateBox>
      </div>
    );
  }

  const a = info.status === 'ok' ? info.data : null;
  const unseen = info.status === 'notfound';
  const tx = txs.status === 'ok' || txs.status === 'loading' ? txs.data : null;
  const pts = hist.data?.points ?? null;

  return (
    <div className={`ix-container ${p.page}`}>
      <PageHead
        mono
        eyebrow={
          <>
            Address
            {a?.label && <span className={p.chip}>{a.label}</span>}
            {check?.ok && <span className={p.muted}>version {check.version} · checksum valid</span>}
            <DemoTag />
          </>
        }
        title={addr}
        actions={
          <>
            <CopyButton value={addr} label="Copy address" text="Copy" />
            <QrButton value={addr} />
          </>
        }
      />

      {unseen ? (
        <StateBox kind="empty" title="No activity yet">
          The address is valid, but no transaction has touched it. Its balance is 0 IXI. It appears here after its first transaction.
        </StateBox>
      ) : (
        <>
          <div style={{ marginTop: 28 }}>
            <Figures cols={4}>
              <Fig mark="ixi" k="Balance" v={a ? <Amount value={a.amount} decimals={2} /> : <Skel w={180} h={24} />} sub={a ? <Amount value={a.amount} decimals={8} /> : null} />
              <Fig mark="tx" k="Transactions" v={a ? int(a.txcount) : <Skel w={80} h={24} />} sub={a?.firstblock ? `since block ${int(a.firstblock)}` : null} />
              <Fig mark="ixi" k="Received" v={a ? <Amount value={a.received} decimals={2} /> : <Skel w={120} h={24} />} />
              <Fig
                k="Last active"
                v={
                  a ? (
                    <Link href={`/block?h=${a.lastblock}`} className="ix-link">
                      {int(a.lastblock)}
                    </Link>
                  ) : (
                    <Skel w={100} h={24} />
                  )
                }
                sub={a ? `sent ${compact(Number(a.sent), 2)} IXI in total` : null}
              />
            </Figures>
          </div>

          <Section
            title="Balance history"
            aside={
              <Segmented<Range>
                label="Range"
                size="sm"
                value={range}
                onChange={setRange}
                options={[
                  { value: '7d', label: '7d' },
                  { value: '30d', label: '30d' },
                  { value: '90d', label: '90d' },
                ]}
              />
            }
          >
            <Chart
              title={`Balance over ${range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}`}
              subtitle="Balance at the end of each bucket, in IXI"
              points={pts}
              step={hist.data?.step ?? 3600}
              format={(v) => `${dec(v, 2)} IXI`}
              tick={(v) => compact(v, 2)}
              live
              color="var(--ix-m-ixi)"
              height={200}
              valueLabel="Balance (IXI)"
              loadingFrame={hist.status === 'loading'}
              error={hist.status === 'error' ? 'Balance history is not available right now.' : undefined}
            />
          </Section>

          <Section
            id="txs"
            title={a ? `Transactions (${int(a.txcount)})` : 'Transactions'}
            lead="Sort by time or by the size of the change. Amounts are what the transaction did to this balance."
          >
            {txs.status === 'error' ? (
              <StateBox kind="error" title="Transactions could not be loaded" action={<RetryButton onClick={txs.reload} />} />
            ) : tx && tx.total === 0 ? (
              <StateBox kind="empty" title="No transactions in the index yet" />
            ) : (
              <>
                <AddressTxTable
                  items={tx ? tx.items : null}
                  address={addr}
                  sort={sort}
                  dir={dir}
                  onSort={(c, d) => {
                    setSort(c);
                    setDir(d);
                  }}
                />
                {tx && <Pager page={page} total={tx.total} pageSize={PAGE} onPage={setPage} label="Transaction pages" />}
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
