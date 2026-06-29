import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import AppShell from '@/components/AppShell'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Signal — GenAI Intelligence OS',
  description: 'Stop drowning in AI noise. Signal curates the GenAI articles that matter to you and turns insights into publish-ready content in minutes.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <style>{`* { font-feature-settings: 'cv02', 'cv03'; }`}</style>
      </head>
      <body className="font-sans bg-zinc-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
