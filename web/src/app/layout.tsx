import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@/styles/reset.css';
import '@/styles/tokens.css';
import '@/styles/theme.css';
import '@/styles/globals.css';
import Header from '@/components/shell/Header';
import Footer from '@/components/shell/Footer';
import Palette from '@/components/search/Palette';
import PrivacyNotice from '@/components/shell/PrivacyNotice';
import SyncNotice from '@/components/shell/SyncNotice';

export const metadata: Metadata = {
  metadataBase: new URL('https://explorer.ixian.io'),
  title: { default: 'ixiscope · Ixian block explorer', template: '%s · ixiscope' },
  description:
    'Search Ixian blocks, transactions and addresses, and see the network: nodes on a globe, statistics, supply and emissions.',
  openGraph: { siteName: 'ixiscope', type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image', site: '@ixian_IO' },
  publisher: 'IXI Labs',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0f0c' },
    { media: '(prefers-color-scheme: light)', color: '#fbfcfb' },
  ],
  colorScheme: 'dark light',
};

/* Runs before first paint: apply the saved theme so there is no flash.
   No saved choice leaves data-theme unset and the system setting decides. */
const THEME_SCRIPT = `try{var t=localStorage.getItem('ixs-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="ix-skip">
          Skip to content
        </a>
        <Header />
        <SyncNotice />
        <main id="main">{children}</main>
        <Footer />
        <Palette />
        <PrivacyNotice />
      </body>
    </html>
  );
}
