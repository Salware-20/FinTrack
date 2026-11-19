/** Emoji de categoría o cuenta, tal como lo guarda la capa de datos. */
export function Emoji({ valor }: { valor?: string }) {
  if (!valor) return null
  return (
    <span className="ft-emoji" aria-hidden="true">
      {valor}
    </span>
  )
}
