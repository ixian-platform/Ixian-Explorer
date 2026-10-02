import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import HomeHero from '@/components/home/HomeHero';
import { BlockFeed, TxFeed } from '@/components/home/Feeds';
import EmissionsGlance from '@/components/home/EmissionsGlance';
import ActivityFigures from '@/components/home/ActivityFigures';
import LegacyRedirect from '@/components/home/LegacyRedirect';
import s from '@/components/home/Home.module.css';

export const metadata: Metadata = pageMeta({
  description: 'Search Ixian blocks, transactions and addresses, and see the network: nodes on a globe, statistics, supply and emissions.',
  path: '/',
  og: 'home',
});

export default function Home() {
  return (
    <>
      <LegacyRedirect />
      <HomeHero />
      <div className={`ix-container ${s.activity}`}>
        <div className={s.sectionHead}>
          <h2 className={s.h2}>Activity</h2>
          <p className={s.lead}>Blocks arrive about every 30 seconds. Point at a list to pause it.</p>
        </div>
        <ActivityFigures />
        <div className={s.feeds}>
          <BlockFeed />
          <TxFeed />
        </div>
      </div>
      <div className="ix-container">
        <EmissionsGlance />
      </div>
    </>
  );
}
