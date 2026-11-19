import { Button, Modal } from 'react-bootstrap'
import type { ReactNode } from 'react'

export interface PeticionConfirmar {
  titulo: string
  mensaje: ReactNode
  accion: string
  peligro?: boolean
  alAceptar: () => void | Promise<void>
}

interface Props {
  peticion: PeticionConfirmar | null
  onCerrar: () => void
}

/** Ventana de confirmación con el estilo de la app, en lugar del confirm() del navegador. */
export function Confirmar({ peticion, onCerrar }: Props) {
  return (
    <Modal show={peticion !== null} onHide={onCerrar} centered className="ft-modal">
      {peticion && (
        <>
          <Modal.Header closeButton>
            <Modal.Title as="h2">{peticion.titulo}</Modal.Title>
          </Modal.Header>
          <Modal.Body>{peticion.mensaje}</Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button
              variant={peticion.peligro ? 'danger' : 'primary'}
              onClick={() => {
                onCerrar()
                void peticion.alAceptar()
              }}
            >
              {peticion.accion}
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  )
}
