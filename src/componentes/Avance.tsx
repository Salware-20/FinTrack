interface Props {
  /** Porcentaje consumido o logrado; puede pasar de 100. */
  porcentaje: number
  estado?: 'normal' | 'advertencia' | 'excedido' | 'meta'
  etiqueta: string
}

/** Barra fina de avance. El color sale del estado, no del porcentaje. */
export function Avance({ porcentaje, estado = 'normal', etiqueta }: Props) {
  const ancho = Math.max(0, Math.min(porcentaje, 100))
  return (
    <div
      className={`ft-avance ${estado}`}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ancho)}
    >
      <span style={{ width: `${ancho}%` }} />
    </div>
  )
}
