import { useCallback, useState } from 'react'
import { mensajeDeError } from './ayudas'

/** Mensajes de error y de éxito que comparten las pantallas. */
export function useAvisos() {
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const fallo = useCallback((causa: unknown) => {
    setAviso(null)
    setError(mensajeDeError(causa))
  }, [])
  const mostrarError = useCallback((texto: string) => {
    setAviso(null)
    setError(texto)
  }, [])
  const exito = useCallback((texto: string) => {
    setError(null)
    setAviso(texto)
  }, [])
  const limpiar = useCallback(() => {
    setError(null)
    setAviso(null)
  }, [])

  return { error, aviso, fallo, mostrarError, exito, limpiar }
}
