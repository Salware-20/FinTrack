import { useCallback, useState } from 'react';
import { normalizarError } from '../../utils/errores';
import { useNotificaciones } from './notificacionesContexto';

/**
 * Errores por campo de los formularios de la demo.
 *
 * Centraliza la regla del Nivel B: si el fallo identifica un campo visible se
 * muestra inline; en cualquier otro caso se informa con un toast. Así las
 * pantallas no repiten la misma clasificación en cada `catch`.
 */
export function useErroresFormulario() {
  const notificaciones = useNotificaciones();
  const [errores, setErrores] = useState<Record<string, string>>({});

  const limpiar = useCallback((campo: string) => {
    setErrores((actuales) => {
      if (!(campo in actuales)) return actuales;
      const siguiente = { ...actuales };
      delete siguiente[campo];
      return siguiente;
    });
  }, []);

  const limpiarTodo = useCallback(() => setErrores({}), []);

  const marcar = useCallback((campo: string, mensaje: string) => {
    setErrores((actuales) => ({ ...actuales, [campo]: mensaje }));
  }, []);

  /**
   * Coloca el error en su campo cuando la pantalla lo declara como inline.
   * Si no hay campo o no está visible, lo muestra como toast de error.
   */
  const manejar = useCallback(
    (fallo: unknown, campos: readonly string[]) => {
      const error = normalizarError(fallo);

      if (
        error.tipo === 'validacion' &&
        error.campo &&
        campos.includes(error.campo)
      ) {
        marcar(error.campo, error.mensaje);
        return;
      }

      notificaciones.error(error.mensaje);
    },
    [marcar, notificaciones],
  );

  return { errores, limpiar, limpiarTodo, marcar, manejar };
}
