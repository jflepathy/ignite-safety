import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import { prisma } from '@/lib/prisma';
import './globals.css';
import Providers from './providers';

// Clean, modern sans-serif to match the razorbled.com/ignite-safety.html
// marketing site's typography — swapped in for the previous bare system-ui
// stack as part of the theme refresh.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Ignite Safety',
  description: 'Fire safety & life-saving equipment servicing, invoicing and dispatch platform',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Favicon is admin-configurable (Settings > Company Profile > Logos), so
  // it's read here rather than hardcoded as a static /favicon.ico file.
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 }, select: { faviconUrl: true } }).catch(() => null);

  return (
    <html lang="en" className={inter.variable}>
      <head>{settings?.faviconUrl && <link rel="icon" href={settings.faviconUrl} />}</head>
      <body className="min-h-screen bg-slate-50 font-sans antialiased">
        {/* Thin top progress bar on every navigation — every route change
            in this app is a real server round trip (RSC fetch), which was
            previously invisible to the user (stale page just sat there
            until the new one popped in). This gives instant feedback that
            a click registered, instead of the page feeling frozen/slow. */}
        <NextTopLoader color="#ec2f2f" height={3} showSpinner={false} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
