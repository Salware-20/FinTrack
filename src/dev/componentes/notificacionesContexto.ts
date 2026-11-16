import { createContext, useContext } from 'react';

/** Variantes visuales de una notificación. */
export type VarianteNotificacion = 'exito' | 'error' | 'aviso' | 'info';

export interface OpcionesNotificacion {
  /** Título del toast; si se omite se usa el de la variante. */
  titulo?: string;
  /** Si es true, el toast no se cierra solo. */
  persistente?: boolean;
}

export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  variante: VarianteNotificacion;
  autohide: boolean;
  delay: number;
}

export interface NotificacionesContextoValor {
  notificaciones: Notificacion[];
  exito: (mensaje: string, opciones?: OpcionesNotificacion) => void;
  error: (mensaje: string, opciones?: OpcionesNotificacion) => void;
  aviso: (mensaje: string, opciones?: OpcionesNotificacion) => void;
  info: (mensaje: string, opciones?: OpcionesNotificacion) => void;
  cerrar: (id: string) => void;
}

export const NotificacionesContexto =
  createContext<NotificacionesContextoValor | null>(null);

/** Hook de acceso a las notificaciones de la demo. */
export function useNotificaciones(): NotificacionesContextoValor {
  const contexto = useContext(NotificacionesContexto);
  if (!contexto) {
    throw new Error(
      'useNotificaciones debe usarse dentro de NotificacionesProvider.',
    );
  }
  return contexto;
}
