import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tagme Threads Agent',
  description: 'Internal dashboard for the Tagme Threads agent',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
