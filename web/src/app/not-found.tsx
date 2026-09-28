import Link from 'next/link';
import { StateBox } from '@/components/ui/Primitives';
import p from '@/components/page/Page.module.css';

export default function NotFound() {
  return (
    <div className={`ix-container ${p.page}`}>
      <StateBox
        kind="notfound"
        title="This page does not exist"
        action={
          <>
            <Link href="/" className="ix-btn ix-btn--primary">
              Home
            </Link>
            <Link href="/search" className="ix-btn">
              Search
            </Link>
          </>
        }
      >
        The link may be old or mistyped. Blocks, transactions and addresses are found through search.
      </StateBox>
    </div>
  );
}
