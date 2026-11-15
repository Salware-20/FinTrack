import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { ResumenMensual, ResumenPorCategoria } from '../../models/tipos';
import { formatearMes } from '../../utils/formato';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const OPCIONES_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
};

/** Barras de ingresos y gastos por mes. */
export function GraficoFlujo({ datos }: { datos: ResumenMensual[] }) {
  if (datos.length === 0) {
    return <p className="text-muted mb-0">Sin movimientos para graficar.</p>;
  }

  return (
    <div className="ratio ratio-16x9">
      <Bar
        data={{
          labels: datos.map((mes) => formatearMes(mes.mes)),
          datasets: [
            {
              label: 'Ingresos',
              data: datos.map((mes) => mes.ingresos),
              backgroundColor: '#198754',
            },
            {
              label: 'Gastos',
              data: datos.map((mes) => mes.gastos),
              backgroundColor: '#dc3545',
            },
          ],
        }}
        options={OPCIONES_BASE}
      />
    </div>
  );
}

/** Dona con el peso de cada categoría de gasto. */
export function GraficoCategorias({ datos }: { datos: ResumenPorCategoria[] }) {
  const gastos = datos
    .filter((categoria) => categoria.tipo === 'gasto')
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  if (gastos.length === 0) {
    return <p className="text-muted mb-0">Aún no hay gastos registrados.</p>;
  }

  return (
    <div className="ratio ratio-16x9">
      <Doughnut
        data={{
          labels: gastos.map((categoria) => categoria.nombre),
          datasets: [
            {
              label: 'Gasto',
              data: gastos.map((categoria) => categoria.total),
              backgroundColor: gastos.map((categoria) => categoria.color),
              borderWidth: 1,
            },
          ],
        }}
        options={{
          ...OPCIONES_BASE,
          plugins: { ...OPCIONES_BASE.plugins, legend: { position: 'right' } },
        }}
      />
    </div>
  );
}
