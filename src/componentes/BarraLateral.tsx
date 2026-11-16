import type { Usuario } from '../models'
import { PAGINAS } from './paginas'
import type { Pagina } from './paginas'

interface Props {
  usuario: Usuario
  pagina: Pagina
  onCambiar: (pagina: Pagina) => void
  onSalir: () => void
}

export function BarraLateral({ usuario, pagina, onCambiar, onSalir }: Props) {
  return (
    <aside className="ft-barra">
      <div className="ft-marca">
        <i className="bi bi-wallet2" aria-hidden="true" />
        FinTrack
      </div>

      <nav className="ft-nav" aria-label="Principal">
        {PAGINAS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ft-nav-item${pagina === item.id ? ' activo' : ''}`}
            aria-current={pagina === item.id ? 'page' : undefined}
            onClick={() => onCambiar(item.id)}
          >
            <i className={`bi ${item.icono}`} aria-hidden="true" />
            {item.etiqueta}
          </button>
        ))}
      </nav>

      <div className="ft-usuario">
        <strong>{usuario.nombre}</strong>
        <span>{usuario.correo}</span>
        <button type="button" className="ft-salir" onClick={onSalir}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
