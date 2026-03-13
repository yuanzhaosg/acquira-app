import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Acquira — Childcare Deal Intelligence',
  description: 'AI-powered due diligence for childcare centre acquisitions.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
