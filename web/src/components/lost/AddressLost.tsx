'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { inspectAddress, repairAddress } from '@/lib/address';
import { links } from '@/lib/links';
import { DocLink } from '@/components/ui/Primitives';
import Omnibox from '@/components/search/Omnibox';
import { Lost, Trace, Row } from './Lost';
import s from './Lost.module.css';

/** The address with the characters outside Base58 marked. */
function Marked({ text, bad }: { text: string; bad: number[] }) {
  return (
    <code className={s.addr}>
      {[...text].map((c, i) => (bad.includes(i) ? <mark key={i}>{c}</mark> : c))}
    </code>
  );
}

/** A suggested address with the edit marked against the one typed. */
function Fix({ typed, fixed }: { typed: string; fixed: string }) {
  let a = 0;
  while (a < typed.length && a < fixed.length && typed[a] === fixed[a]) a++;
  let b = 0;
  while (b < typed.length - a && b < fixed.length - a && typed[typed.length - 1 - b] === fixed[fixed.length - 1 - b]) b++;
  const mid = fixed.slice(a, fixed.length - b);
  return (
    <code className={s.addr}>
      {fixed.slice(0, a)}
      {mid ? <ins>{mid}</ins> : <ins aria-label="a character removed">·</ins>}
      {fixed.slice(fixed.length - b)}
    </code>
  );
}

const diffHex = (given: string, expected: string) =>
  [...given].map((c, i) => (c === expected[i] ? c : <s key={i}>{c}</s>));

export function AddressLost({ input, reason }: { input: string; reason: string }) {
  const r = inspectAddress(input);
  const [fix, setFix] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    setFix(null);
    repairAddress(input).then((f) => alive && setFix(f));
    return () => {
      alive = false;
    };
  }, [input]);

  const charsOk = r.badChars.length === 0;
  const lenOk = r.want != null && r.bytes === r.want;
  const one = fix && fix.length === 1 ? fix[0] : null;

  return (
    <Lost
      eyebrow="Address"
      title={['This isn’t', 'an Ixian address.']}
      lead={
        <>
          <p>{reason}</p>
          <p>Every Ixian address ends in a checksum, so a typo almost never lands on another valid address.</p>
        </>
      }
      actions={
        <>
          {one && (
            <Link href={`/address?a=${encodeURIComponent(one)}`} className="ix-btn ix-btn--primary">
              Open the fixed address
            </Link>
          )}
          <DocLink href={links.docs.addresses}>How addresses are built</DocLink>
        </>
      }
      search={<Omnibox />}
      aside={
        <Trace label="What ixiscope checked">
          <Row k="Address">
            <Marked text={r.address} bad={r.badChars} />
          </Row>
          <Row
            k="Characters"
            state={charsOk ? 'ok' : 'no'}
            note={charsOk ? undefined : 'Base58 leaves out 0, O, I and l because they look alike.'}
          >
            {charsOk
              ? 'All Base58'
              : r.badChars.length === 1
                ? `"${r.address[r.badChars[0]]}" at position ${r.badChars[0] + 1}`
                : `${r.badChars.length} characters outside Base58`}
          </Row>
          {charsOk && (
            <Row
              k="Length"
              state={lenOk ? 'ok' : 'no'}
              note={lenOk ? undefined : 'Version 0 addresses are 36 bytes, versions 1 and 2 are 48. A character may be missing or extra.'}
            >
              {r.bytes == null ? 'Not valid Base58' : lenOk ? `${r.bytes} bytes, version ${r.version}` : `${r.bytes} bytes`}
            </Row>
          )}
          {lenOk && r.given && r.expected && (
            <Row k="Checksum" state="no" note="The last three bytes should match the start of a hash of the rest. They don’t.">
              <span className={s.hexes}>
                <span>given {diffHex(r.given, r.expected)}</span>
                <span>expected {r.expected}</span>
              </span>
            </Row>
          )}
          <Row
            k="Fix"
            state={fix == null ? 'wait' : one ? 'ok' : 'no'}
            note={
              fix == null
                ? 'Trying every one-character change, gap, extra character and swap.'
                : one
                  ? 'One edit away, and its checksum holds.'
                  : fix.length > 1
                    ? 'More than one valid address is one edit away, so ixiscope won’t guess.'
                    : 'Copy the address again from where you found it.'
            }
          >
            {fix == null ? 'Looking for a one-character fix' : one ? <Fix typed={r.address} fixed={one} /> : 'No single fix'}
          </Row>
        </Trace>
      }
    />
  );
}
