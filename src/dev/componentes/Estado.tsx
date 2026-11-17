import { Alert, Button, Spinner } from 'react-bootstrap';

/** Spinner centrado para estados de carga. */
export function Cargando({ texto = 'Cargando datos…' }: { texto?: string }) {
  return (
    <div className="text-center py-5">
      <Spinner animation="border" role="status" />
      <p className="mt-3 text-muted mb-0">{texto}</p>
    </div>
  );
}

/**
 * Alerta para errores que impiden cargar una pantalla.
 *
 * Es la única alerta inline de error del Nivel B: lleva reintento porque sin
 * los datos no hay nada que el usuario pueda hacer en esa sección.
 */
export function AlertaErrorCarga({
  mensaje,
  onReintentar,
}: {
  mensaje: string | null;
  onReintentar: () => void;
}) {
  if (!mensaje) return null;

  return (
    <Alert
      variant="danger"
      className="d-flex flex-wrap justify-content-between align-items-center gap-3"
    >
      <div>
        <Alert.Heading className="h6 mb-1">
          No se pudieron cargar los datos
        </Alert.Heading>
        <div>{mensaje}</div>
      </div>
      <Button variant="outline-danger" size="sm" onClick={onReintentar}>
        Reintentar
      </Button>
    </Alert>
  );
}

/** Tarjeta de indicador usada en el dashboard. */
export function TarjetaKpi({
  titulo,
  valor,
  detalle,
  color,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  color: 'success' | 'danger' | 'primary' | 'secondary';
}) {
  return (
    <div className={`card bg-${color} text-white h-100`}>
      <div className="card-body">
        <div className="text-uppercase small opacity-75">{titulo}</div>
        <div className="fs-4 fw-semibold">{valor}</div>
        {detalle && <div className="small opacity-75">{detalle}</div>}
      </div>
    </div>
  );
}
