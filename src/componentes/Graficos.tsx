import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { ResumenMensual, ResumenPorCategoria } from '../models/tipos'
import { formatearMes, formatearMoneda } from '../utils/formato'

ChartJS.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip)
ChartJS.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif"
ChartJS.defaults.color = '#5a6a6f'

const miles = (valor: string | number) => Number(valor).toLocaleString('es-CR')

/** Barras de ingresos y gastos por mes. */
export function GraficoFlujo({ datos }: { datos: ResumenMensual[] }) {
  return (
    <div className="ft-grafico">
      <Bar
        data={{
          labels: datos.map((mes) => formatearMes(mes.mes)),
          datasets: [
            { label: 'Ingresos', data: datos.map((mes) => mes.ingresos), backgroundColor: '#1f7a55', borderRadius: 2 },
            { label: 'Gastos', data: datos.map((mes) => mes.gastos), backgroundColor: '#b3443a', borderRadius: 2 },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (c) => `${c.dataset.label}: ${formatearMoneda(c.parsed.y ?? 0)}`,
              },
            },
          },
          scales: {
            y: { ticks: { callback: (v) => miles(v) }, grid: { color: '#e3e8e5' } },
            x: { grid: { display: false } },
          },
        }}
      />
    </div>
  )
}

/** Barras horizontales con las categorías de gasto más pesadas. */
export function GraficoGastos({ datos }: { datos: ResumenPorCategoria[] }) {
  const gastos = datos
    .filter((categoria) => categoria.tipo === 'gasto')
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  if (gastos.length === 0) return <p className="ft-vacio">No hay gastos en este periodo.</p>

  return (
    <div className="ft-grafico" style={{ height: `${gastos.length * 2.6 + 3}rem` }}>
      <Bar
        data={{
          labels: gastos.map((categoria) => categoria.nombre),
          datasets: [{ label: 'Gasto', data: gastos.map((categoria) => categoria.total), backgroundColor: '#b3443a', borderRadius: 2 }],
        }}
        options={{
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => formatearMoneda(c.parsed.x ?? 0) } },
          },
          scales: {
            x: { ticks: { callback: (v) => miles(v) }, grid: { color: '#e3e8e5' } },
            y: { grid: { display: false } },
          },
        }}
      />
    </div>
  )
}
