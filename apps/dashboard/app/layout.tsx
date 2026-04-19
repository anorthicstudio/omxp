import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'OMXP Dashboard',
  description: 'Manage your AI memory vault — view memories, control app permissions, and export your data.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark min-h-screen" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground min-h-screen flex flex-col relative overflow-x-hidden`}>
        {/* Abstract background glows */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute top-[60%] -right-[10%] w-[35%] h-[35%] rounded-full bg-indigo-500/20 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
          <div className="absolute top-[20%] left-[60%] w-[25%] h-[25%] rounded-full bg-blue-400/10 blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '8s', animationDelay: '4s' }} />
        </div>
        
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 relative z-10 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
