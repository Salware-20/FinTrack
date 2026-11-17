import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Categoria, Transaccion } from '../models'
import { TipoTransaccion } from '../models'
import { finanzasService } from '../services'
import { Avisos } from '../componentes/Avisos'
import { Encabezado } from '../componentes/Encabezado'
import { useAvisos } from '../componentes/useAvisos'

function Arbol({ titulo, tipo, categorias, uso }: {
  titulo: string
  tipo: TipoTransaccion
  categorias: Categoria[]
  uso: Map<string, number>
}) {
  const delTipo = categorias.filter((c) => c.tipo === tipo)
  const raices = delTipo.filter((c) => !c.padreId).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const hijas = (id: string) =>
    delTipo.filter((c) => c.padreId === id).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const fila = (c: Categoria, sangria: boolean) => (
    <li key={c.id} className={sangria ? 'ft-hija' : 'ft-raiz'}>
      <span>
        <span className="ft-punto" style={{ background: c.color }} aria-hidden="true" />
        {c.nombre}
      </span>
      <small>{uso.get(c.id) ?? 0} mov.</small>
    </li>
  )

  return (
    <section className="col-12 col-lg-6" aria-label={titulo}>
      <h2 className="ft-seccion-titulo">{titulo}</h2>
      <ul className="ft-arbol">
        {raices.map((raiz) => [fila(raiz, false), ...hijas(raiz.id).map((h) => fila(h, true))])}
      </ul>
    </section>
  )
}

export function Categorias() {
  const { error, aviso, fallo, exito, limpiar } = useAvisos()
  const [version, setVersion] = useState(0)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [transacciones, setTransacciones] = useState<Transaccion[]>([])
  const [cargando, setCargando] = useState(true)

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoTransaccion>(TipoTransaccion.Gasto)
  const [padreId, setPadreId] = useState('')
  const [color, setColor] = useState('#1f6b55')

  useEffect(() => {
    let activo = true
    Promise.all([finanzasService.listarCategorias(), finanzasService.listarTransacciones()])
      .then(([cat, tx]) => {
        if (!activo) return
        setCategorias(cat)
        setTransacciones(tx)
        setCargando(false)
      })
      .catch((causa: unknown) => {
        if (!activo) return
        fallo(causa)
        setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [version, fallo])

  const uso = new Map<string, number>()
  for (const t of transacciones) uso.set(t.categoriaId, (uso.get(t.categoriaId) ?? 0) + 1)

  const posiblesPadres = categorias
    .filter((c) => c.tipo === tipo && !c.padreId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const crear = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    try {
      await finanzasService.crearCategoria({ nombre, tipo, padreId: padreId || null, color })
      exito(`Categoría “${nombre}” creada.`)
      setNombre('')
      setPadreId('')
      setVersion((v) => v + 1)
    } catch (causa) {
      fallo(causa)
    }
  }

  return (
    <>
      <Encabezado titulo="Categorías" subtitulo="Cómo se agrupan sus ingresos y gastos." />
      <Avisos error={error} aviso={aviso} onCerrar={limpiar} />

      <section aria-labelledby="t-nueva-cat" className="mb-5">
        <h2 id="t-nueva-cat" className="ft-seccion-titulo">Nueva categoría</h2>
        <Form className="ft-panel" onSubmit={(e) => void crear(e)}>
          <div className="ft-rejilla">
            <Form.Group controlId="cat-nombre">
              <Form.Label>Nombre</Form.Label>
              <Form.Control value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </Form.Group>
            <Form.Group controlId="cat-tipo">
              <Form.Label>Tipo</Form.Label>
              <Form.Select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoTransaccion)
                  setPadreId('')
                }}
              >
                <option value={TipoTransaccion.Gasto}>Gasto</option>
                <option value={TipoTransaccion.Ingreso}>Ingreso</option>
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="cat-padre">
              <Form.Label>Dentro de</Form.Label>
              <Form.Select value={padreId} onChange={(e) => setPadreId(e.target.value)}>
                <option value="">Ninguna (categoría principal)</option>
                {posiblesPadres.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="cat-color">
              <Form.Label>Color</Form.Label>
              <Form.Control type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Elegir color" />
            </Form.Group>
          </div>
          <Button type="submit" className="mt-3">Crear categoría</Button>
        </Form>
      </section>

      {cargando ? (
        <p className="ft-vacio">Cargando…</p>
      ) : (
        <div className="row g-5">
          <Arbol titulo="Gastos" tipo={TipoTransaccion.Gasto} categorias={categorias} uso={uso} />
          <Arbol titulo="Ingresos" tipo={TipoTransaccion.Ingreso} categorias={categorias} uso={uso} />
        </div>
      )}
    </>
  )
}
