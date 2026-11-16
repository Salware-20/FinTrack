import { useEffect, useState } from 'react'
import type { Usuario } from './models'
import { finanzasService } from './services'
import { BarraLateral } from './componentes/BarraLateral'
import { PAGINAS } from './componentes/paginas'
import type { Pagina } from './componentes/paginas'
import { Acceso } from './paginas/Acceso'
import { Resumen } from './paginas/Resumen'

function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [pagina, setPagina] = useState<Pagina>('resumen')
  const [revisandoSesion, setRevisandoSesion] = useState(true)

  // Si ya había una sesión abierta en esta pestaña, se retoma
  useEffect(() => {
    let activo = true
    finanzasService
      .usuarioActual()
      .then((u) => {
        if (activo) setUsuario(u)
      })
      .catch(() => {})
      .finally(() => {
        if (activo) setRevisandoSesion(false)
      })
    return () => {
      activo = false
    }
  }, [])

  const salir = async () => {
    try {
      await finanzasService.cerrarSesion()
    } finally {
      setUsuario(null)
      setPagina('resumen')
    }
  }

  if (revisandoSesion) return null

  if (!usuario) {
    return (
      <Acceso
        onEntrar={(nuevo) => {
          setUsuario(nuevo)
          setPagina('resumen')
        }}
      />
    )
  }

  const etiqueta = PAGINAS.find((p) => p.id === pagina)?.etiqueta ?? ''

  return (
    <div className="ft-app">
      <BarraLateral
        usuario={usuario}
        pagina={pagina}
        onCambiar={setPagina}
        onSalir={() => void salir()}
      />
      <main className="ft-contenido">
        {pagina === 'resumen' ? (
          <Resumen usuario={usuario} onIrAMovimientos={() => setPagina('movimientos')} />
        ) : (
          <>
            <h1 className="ft-titulo">{etiqueta}</h1>
            <p className="ft-subtitulo">Esta pantalla se construye en el siguiente paso.</p>
          </>
        )}
      </main>
    </div>
  )
}

export default App
