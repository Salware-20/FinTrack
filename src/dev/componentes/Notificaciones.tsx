import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { NotificacionesContexto } from './notificacionesContexto';
import type {
  Notificacion,
  NotificacionesContextoValor,
  OpcionesNotificacion,
  VarianteNotificacion,
} from './notificacionesContexto';

const MAXIMO_VISIBLES = 4;

const ESTILOS: Record<
  VarianteNotificacion,
  { clase: string; icono: string; titulo: string; delay: number }
> = {
  exito: {
    clase: 'border-success',
    icono: '✅',
    titulo: 'Listo',
    delay: 5000,
  },
  error: {
    clase: 'border-danger',
    icono: '⛔',
    titulo: 'No se pudo completar',
    delay: 8000,
  },
  aviso: {
    clase: 'border-warning',
    icono: '⚠️',
    titulo: 'Atención',
    delay: 7000,
  },
  info: {
    clase: 'border-primary',
    icono: 'ℹ️',
    titulo: 'Información',
    delay: 5000,
  },
};

/**
 * Proveedor de notificaciones de la demo.
 *
 * Usa el `Toast` nativo de React Bootstrap: no hay CSS propio ni dependencias
 * adicionales. Los toasts se apilan abajo a la derecha y se eliminan del
 * estado al cerrarse para que no reaparezcan.
 */
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  const cerrar = useCallback((id: string) => {
    setNotificaciones((actuales) =>
      actuales.filter((notificacion) => notificacion.id !== id),
    );
  }, []);

  const mostrar = useCallback(
    (
      variante: VarianteNotificacion,
      mensaje: string,
      opciones?: OpcionesNotificacion,
    ) => {
      const estilo = ESTILOS[variante];
      const notificacion: Notificacion = {
        id: crypto.randomUUID(),
        titulo: opciones?.titulo ?? estilo.titulo,
        mensaje,
        variante,
        autohide: !opciones?.persistente,
        delay: estilo.delay,
      };

      setNotificaciones((actuales) =>
        [...actuales, notificacion].slice(-MAXIMO_VISIBLES),
      );
    },
    [],
  );

  const exito = useCallback(
    (mensaje: string, opciones?: OpcionesNotificacion) =>
      mostrar('exito', mensaje, opciones),
    [mostrar],
  );
  const error = useCallback(
    (mensaje: string, opciones?: OpcionesNotificacion) =>
      mostrar('error', mensaje, opciones),
    [mostrar],
  );
  const aviso = useCallback(
    (mensaje: string, opciones?: OpcionesNotificacion) =>
      mostrar('aviso', mensaje, opciones),
    [mostrar],
  );
  const info = useCallback(
    (mensaje: string, opciones?: OpcionesNotificacion) =>
      mostrar('info', mensaje, opciones),
    [mostrar],
  );

  const valor = useMemo<NotificacionesContextoValor>(
    () => ({
      notificaciones,
      cerrar,
      exito,
      error,
      aviso,
      info,
    }),
    [notificaciones, cerrar, exito, error, aviso, info],
  );

  return (
    <NotificacionesContexto.Provider value={valor}>
      {children}

      <ToastContainer
        position="bottom-end"
        className="p-3 position-fixed"
        aria-live="polite"
        aria-atomic="true"
      >
        {notificaciones.map((notificacion) => {
          const estilo = ESTILOS[notificacion.variante];
          return (
            <Toast
              key={notificacion.id}
              show
              autohide={notificacion.autohide}
              delay={notificacion.delay}
              onClose={() => cerrar(notificacion.id)}
              className={`shadow-sm border-start border-4 ${estilo.clase}`}
            >
              <Toast.Header closeButton>
                <span className="me-2" aria-hidden="true">
                  {estilo.icono}
                </span>
                <strong className="me-auto">{notificacion.titulo}</strong>
                <small className="text-muted">ahora</small>
              </Toast.Header>
              <Toast.Body>{notificacion.mensaje}</Toast.Body>
            </Toast>
          );
        })}
      </ToastContainer>
    </NotificacionesContexto.Provider>
  );
}
