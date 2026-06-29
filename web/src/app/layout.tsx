import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'org.anvaya.one — Governance',
  description: 'Anvaya Organisation governance platform — country-specific guidance, rules and the dedapi channel.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
