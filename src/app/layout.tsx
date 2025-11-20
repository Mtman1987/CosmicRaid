import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Playfair_Display, PT_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import '@/lib/auto-startup';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-playfair-display',
});

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans',
});

export const metadata: Metadata = {
  title: 'Cosmic Raid',
  description: 'Space-themed gaming and entertainment platform.',
  manifest: '/manifest.json',
  icons: {
    icon: '/cosmicraid.png',
    apple: '/cosmicraid.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#667eea',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Auto-startup services are initialized via the import above
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/cosmicraid.png" />
      </head>
      <body
        className={cn(
          playfair.variable,
          ptSans.variable
        )}
        style={{
          minHeight: '100vh',
          backgroundColor: '#0f0f23',
          color: '#ffffff',
          fontFamily: 'var(--font-pt-sans), system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: 0
        }}
      >
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
