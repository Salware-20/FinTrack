import './App.css'
import { Container, Button, Alert } from 'react-bootstrap';

function App() {

  const nombrecompañia = "Novus Fortis";
  // esta es una función que devuelve el nombre de la compañía
  function obtenerNombreCompañia() {
    return nombrecompañia;
  }

  return (
    <>
    <Container className="mt-5">
      <Alert variant="success">
        <strong>¡Todo listo!</strong> React y Bootstrap están funcionando correctamente.
      </Alert>
      <Button variant="primary" onClick={() => alert('¡React responde!')}>
        Probar interacción
      </Button>
    </Container>

    <Container className="mt-5">
      <h3>Datos de la Compañía</h3>
      <p><strong>Nombre:</strong> {obtenerNombreCompañia()}</p>
    </Container>

    
    </>
  );
}

export default App

