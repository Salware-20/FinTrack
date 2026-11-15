import { useEffect, useState } from 'react';
import { Alert, Button, Container, Nav, Navbar, Spinner } from 'react-bootstrap';
import type { Usuario } from '../models';
import { finanzasService } from '../services';
import { SECCIONES } from './secciones';
import type { Seccion } from './secciones';
import { mensajeDeError } from './componentes/mensajes';
import { Acceso } from './pantallas/Acceso';
import { Categorias } from './pantallas/Categorias';
import { Cuentas } from './pantallas/Cuentas';
import { Dashboard } from './pantallas/Dashboard';
import { MiCuenta } from './pantallas/MiCuenta';
import { Movimientos } from './pantallas/Movimientos';
import { Reportes } from './pantallas/Reportes';

/**
 * Shell de la demo de FinTrack.
 *
 * Este archivo reemplaza la antigua demo del servicio mock. No forma parte de
 * la aplicación final: sirve como referencia visual y funcional del MVP, y
 * vive aislado en `src/dev` con su propia entrada (`demo.html`).
 *
 * La navegación es por estado (no hay router) y todas las pantallas usan
 * únicamente React Bootstrap, sin CSS propio.
 */
export function DemoDatos() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [seccion, setSeccion] = useState<Seccion>('dashboard');
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    finanzasService
      .usuarioActual()
      .then((encontrado) => {
        if (!activo) return;
        setUsuario(encontrado);
        setCargandoSesion(false);
      })
      .catch((fallo: unknown) => {
        if (!activo) return;
        setError(mensajeDeError(fallo));
        setCargandoSesion(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const entrar = (nuevo: Usuario) => {
    setError(null);
    setUsuario(nuevo);
    setSeccion('dashboard');
  };

  const salir = async () => {
    try {
      await finanzasService.cerrarSesion();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setUsuario(null);
      setSeccion('dashboard');
    }
  };

  if (cargandoSesion) {
    return (
      <Container className="py-5">
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
          <p className="mt-3 text-muted mb-0">Abriendo la base local…</p>
        </div>
      </Container>
    );
  }

  if (!usuario) {
    return (
      <>
        {error && (
          <Container className="pt-3">
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          </Container>
        )}
        <Acceso onEntrar={entrar} />
      </>
    );
  }

  const renderizarSeccion = () => {
    switch (seccion) {
      case 'movimientos':
        return <Movimientos />;
      case 'cuentas':
        return <Cuentas />;
      case 'categorias':
        return <Categorias />;
      case 'reportes':
        return <Reportes usuario={usuario} />;
      case 'cuenta':
        return <MiCuenta usuario={usuario} onSalir={() => setUsuario(null)} />;
      case 'dashboard':
      default:
        return <Dashboard usuario={usuario} irA={setSeccion} />;
    }
  };

  return (
    <>
      <Navbar bg="dark" data-bs-theme="dark" expand="lg" className="mb-4 shadow-sm">
        <Container>
          <Navbar.Brand
            href="#dashboard"
            onClick={(evento) => {
              evento.preventDefault();
              setSeccion('dashboard');
            }}
          >
            💸 FinTrack
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="nav-demo" />
          <Navbar.Collapse id="nav-demo">
            <Nav className="me-auto" activeKey={seccion}>
              {SECCIONES.map((item) => (
                <Nav.Link
                  key={item.id}
                  href={`#${item.id}`}
                  active={seccion === item.id}
                  onClick={(evento) => {
                    evento.preventDefault();
                    setSeccion(item.id);
                  }}
                >
                  <span className="me-1" aria-hidden="true">
                    {item.icono}
                  </span>
                  {item.etiqueta}
                </Nav.Link>
              ))}
            </Nav>

            <div className="d-flex flex-wrap align-items-center gap-2 mt-2 mt-lg-0">
              <Navbar.Text className="text-white-50">
                {usuario.nombre}
              </Navbar.Text>
              <Button
                size="sm"
                variant="outline-light"
                onClick={() => void salir()}
              >
                Salir
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="pb-5">
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {renderizarSeccion()}

        <footer className="mt-5 pt-3 border-top text-muted small text-center">
          Demo de FinTrack · datos locales en este navegador · sin servidores ni internet
        </footer>
      </Container>
    </>
  );
}
