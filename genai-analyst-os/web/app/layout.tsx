import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import AppShell from '@/components/AppShell'
import AuthPopupGate from '@/components/AuthPopupGate'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Signal — GenAI Intelligence OS',
  description: 'Stop drowning in AI noise. Signal curates the GenAI articles that matter to you and turns insights into publish-ready content in minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <style>{`* { font-feature-settings: 'cv02', 'cv03'; }`}</style>
        {/* Apply saved theme class before first paint — prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('signal_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.remove('dark','light');document.documentElement.classList.add(d?'dark':'light');}catch(e){}})();` }} />
      </head>
      <body className="font-sans bg-zinc-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 min-h-screen">
        <AppShell>{children}</AppShell>
        <AuthPopupGate />
      </body>
    </html>
  )
}
