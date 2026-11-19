import { useEffect, useState } from 'react'
import type { Usuario } from './models'
import { finanzasService } from './services'
import { BarraLateral } from './componentes/BarraLateral'
import type { Pagina } from './componentes/paginas'
import { Acceso } from './paginas/Acceso'
import { Categorias } from './paginas/Categorias'
import { Cuentas } from './paginas/Cuentas'
import { MiCuenta } from './paginas/MiCuenta'
import { Movimientos } from './paginas/Movimientos'
import { Reportes } from './paginas/Reportes'
import { Resumen } from './paginas/Resumen'

function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [pagina, setPagina] = useState<Pagina>('resumen')
  const [revisandoSesion, setRevisandoSesion] = useState(true)
  // Cada vez que hay usuario se generan los movimientos recurrentes que ya vencieron
  const [listo, setListo] = useState<string | null>(null)

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

  useEffect(() => {
    if (!usuario) return
    let activo = true
    finanzasService
      .procesarRecurrencias()
      .catch(() => 0)
      .finally(() => {
        if (activo) setListo(usuario.id)
      })
    return () => {
      activo = false
    }
  }, [usuario])

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

  // Mientras se procesan las recurrencias no se muestra el resumen, para que los saldos ya las incluyan
  if (listo !== usuario.id) return null

  return (
    <div className="ft-app">
      <BarraLateral
        usuario={usuario}
        pagina={pagina}
        onCambiar={setPagina}
        onSalir={() => void salir()}
      />
      <main className="ft-contenido">
        {pagina === 'resumen' && (
          <Resumen usuario={usuario} onIr={setPagina} />
        )}
        {pagina === 'movimientos' && <Movimientos />}
        {pagina === 'cuentas' && <Cuentas />}
        {pagina === 'categorias' && <Categorias />}
        {pagina === 'reportes' && <Reportes usuario={usuario} />}
        {pagina === 'cuenta' && (
          <MiCuenta
            usuario={usuario}
            onCuentaEliminada={() => {
              setUsuario(null)
              setPagina('resumen')
            }}
          />
        )}
      </main>
    </div>
  )
}

export default App
