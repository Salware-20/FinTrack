import logotipo from '../assets/Logotipo.png'

/** Logotipo en pixel art + nombre. Se escala sin suavizar para que no se vea borroso. */
export function Marca({ className = '' }: { className?: string }) {
  return (
    <div className={`ft-marca ${className}`}>
      <img src={logotipo} alt="" width={16} height={16} className="ft-logo" />
      <span>FinTrack</span>
    </div>
  )
}
