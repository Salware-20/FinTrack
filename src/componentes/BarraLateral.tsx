import type { Usuario } from '../models'
import { Marca } from './Marca'
import { PAGINAS } from './paginas'
import type { Pagina } from './paginas'

interface Props {
  usuario: Usuario
  pagina: Pagina
  onCambiar: (pagina: Pagina) => void
  onSalir: () => void
}

/**
 * Escritorio: barra lateral completa.
 * Tablet: columna angosta solo con iconos.
 * Celular: barra superior con la marca y menú fijo abajo.
 */
export function BarraLateral({ usuario, pagina, onCambiar, onSalir }: Props) {
  return (
    <aside className="ft-barra">
      <Marca />

      <nav className="ft-nav" aria-label="Principal">
        {PAGINAS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ft-nav-item${pagina === item.id ? ' activo' : ''}`}
            aria-current={pagina === item.id ? 'page' : undefined}
            title={item.etiqueta}
            aria-label={item.etiqueta}
            onClick={() => {
              onCambiar(item.id)
              window.scrollTo({ top: 0 })
            }}
          >
            <i className={`bi ${item.icono}`} aria-hidden="true" />
            <span className="ft-nav-texto" aria-hidden="true">{item.etiqueta}</span>
            <span className="ft-nav-corta" aria-hidden="true">{item.corta ?? item.etiqueta}</span>
          </button>
        ))}
      </nav>

      <div className="ft-usuario">
        <span className="ft-iniciales" aria-hidden="true">{usuario.iniciales}</span>
        <div className="ft-usuario-datos">
          <strong>{usuario.nombre}</strong>
          <span>{usuario.correo}</span>
        </div>
        <button type="button" className="ft-salir" onClick={onSalir} title="Cerrar sesión">
          <i className="bi bi-box-arrow-right" aria-hidden="true" />
          <span className="ft-salir-texto">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
