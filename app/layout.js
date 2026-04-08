import './globals.css'

export const metadata = {
  title: 'FaceForge — Seu rosto, sempre perfeito',
  description: 'Treina um modelo pessoal com suas fotos e corrige qualquer imagem.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
