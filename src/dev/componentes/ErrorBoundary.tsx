import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, Button } from 'react-bootstrap';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Límite de errores de render de la demo.
 *
 * Si una pantalla falla, no se deja el área en blanco: se muestra una alerta
 * Bootstrap con opción de recargar o reintentar y se registra el fallo.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error de render en la demo:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <Alert variant="danger">
          <Alert.Heading>Algo salió mal en esta pantalla</Alert.Heading>
          <p className="mb-3">
            La demo encontró un error inesperado. Sus datos siguen guardados en
            este navegador.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <Button
              variant="outline-danger"
              onClick={() => window.location.reload()}
            >
              Recargar la demo
            </Button>
            <Button
              variant="outline-secondary"
              onClick={() => this.setState({ error: null })}
            >
              Intentar de nuevo
            </Button>
          </div>
        </Alert>
      );
    }

    return this.props.children;
  }
}
