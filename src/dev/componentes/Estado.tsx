import { Alert, Spinner } from 'react-bootstrap';

/** Spinner centrado para estados de carga. */
export function Cargando({ texto = 'Cargando datos…' }: { texto?: string }) {
  return (
    <div className="text-center py-5">
      <Spinner animation="border" role="status" />
      <p className="mt-3 text-muted mb-0">{texto}</p>
    </div>
  );
}

/** Alerta de error cerrable. */
export function AlertaError({
  mensaje,
  onCerrar,
}: {
  mensaje: string | null;
  onCerrar?: () => void;
}) {
  if (!mensaje) return null;

  return (
    <Alert variant="danger" dismissible={Boolean(onCerrar)} onClose={onCerrar}>
      {mensaje}
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
