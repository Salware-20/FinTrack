import { Alert } from 'react-bootstrap'

interface Props {
  error: string | null
  aviso: string | null
  onCerrar: () => void
}

export function Avisos({ error, aviso, onCerrar }: Props) {
  return (
    <>
      {error && (
        <Alert variant="danger" className="py-2" dismissible onClose={onCerrar} role="alert">
          {error}
        </Alert>
      )}
      {aviso && (
        <Alert variant="success" className="py-2" dismissible onClose={onCerrar} role="status">
          {aviso}
        </Alert>
      )}
    </>
  )
}
