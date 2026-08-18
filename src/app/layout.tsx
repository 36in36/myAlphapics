import type { Metadata, Viewport } from 'next';
import './globals.css';
import AudioGate from './components/AudioGate';

export const metadata: Metadata = {
  title: 'MyAlphaPics - Learn ABCs!',
  description: 'Learn the alphabet with personalized photos',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MyAlphaPics" />
        <link rel="apple-touch-icon" href="/images/icon-180x180.png" />
      </head>
      <body className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-50 to-purple-100">
        {children}
        <AudioGate />
      </body>
    </html>
  );
}
