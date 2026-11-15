import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import { DemoDatos } from './DemoDatos';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoDatos />
  </StrictMode>,
);
