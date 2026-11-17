import type { ReactNode } from 'react'

interface Props {
  titulo: string
  subtitulo?: string
  children?: ReactNode
}

export function Encabezado({ titulo, subtitulo, children }: Props) {
  return (
    <header className="ft-encabezado">
      <div>
        <h1 className="ft-titulo">{titulo}</h1>
        {subtitulo && <p className="ft-subtitulo">{subtitulo}</p>}
      </div>
      {children && <div className="ft-acciones">{children}</div>}
    </header>
  )
}
