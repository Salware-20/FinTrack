import 'fake-indexeddb/auto';
import { createServer } from 'vite';

// La sesión del servicio vive en sessionStorage.
globalThis.sessionStorage = (() => {
  const mapa = new Map();
  return {
    getItem: (clave) => (mapa.has(clave) ? mapa.get(clave) : null),
    setItem: (clave, valor) => mapa.set(clave, String(valor)),
    removeItem: (clave) => mapa.delete(clave),
    clear: () => mapa.clear(),
  };
})();

const servidor = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const { LocalFinanzasService } = await servidor.ssrLoadModule(
  '/src/services/LocalFinanzasService.ts',
);
const { BaseDatosFinanzas } = await servidor.ssrLoadModule('/src/db/baseDatos.ts');

let pruebas = 0;
function afirmar(condicion, mensaje) {
  pruebas += 1;
  if (!condicion) throw new Error(`FALLÓ: ${mensaje}`);
  console.log(`  ok ${pruebas} · ${mensaje}`);
}

async function esperarError(accion, mensaje) {
  try {
    await accion();
  } catch {
    afirmar(true, mensaje);
    return;
  }
  afirmar(false, mensaje);
}

const db = new BaseDatosFinanzas('fintrack-smoke');
const servicio = new LocalFinanzasService(db);

try {
  console.log('\nRegistro y datos iniciales');
  const registroA = await servicio.registrar({
    nombre: 'Ana Rodríguez',
    correo: ' Ana@Example.com ',
    contrasena: 'claveSegura123',
  });
  afirmar(registroA.usuario.correo === 'ana@example.com', 'normaliza el correo');
  afirmar(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(registroA.codigoRecuperacion), 'código con formato XXXX-XXXX-XXXX');
  afirmar((await servicio.usuarioActual())?.id === registroA.usuario.id, 'sesión iniciada tras registro');
  afirmar((await servicio.listarCategorias()).length === 34, 'crea 34 categorías base');
  afirmar((await servicio.listarCuentas()).length === 1, 'crea la cuenta de efectivo');
  afirmar((await servicio.obtenerSaldos())[0].saldo === 0, 'el saldo inicial es 0');
  await esperarError(
    () => servicio.registrar({ nombre: 'Otra', correo: 'ana@example.com', contrasena: 'claveSegura123' }),
    'rechaza correo duplicado',
  );

  console.log('\nCuentas y transacciones');
  const cuentasA = await servicio.listarCuentas();
  const efectivo = cuentasA[0];
  const banco = await servicio.crearCuenta({
    nombre: 'BAC Credomatic',
    tipo: 'banco',
    saldoInicial: 100_000,
    institucion: 'BAC',
  });
  const categoriasA = await servicio.listarCategorias();
  const catGasto = categoriasA.find((categoria) => categoria.tipo === 'gasto');
  const catIngreso = categoriasA.find((categoria) => categoria.tipo === 'ingreso');

  await servicio.crearTransaccion({
    monto: 25_000,
    tipo: 'gasto',
    fecha: '2026-11-10',
    descripcion: 'Supermercado',
    categoriaId: catGasto.id,
    cuentaId: efectivo.id,
  });
  await servicio.crearTransaccion({
    monto: 500_000,
    tipo: 'ingreso',
    fecha: '2026-11-05',
    descripcion: 'Salario',
    categoriaId: catIngreso.id,
    cuentaId: banco.id,
  });
  await esperarError(
    () =>
      servicio.crearTransaccion({
        monto: 1000,
        tipo: 'gasto',
        fecha: '2026-11-10',
        descripcion: 'Categoría cruzada',
        categoriaId: catIngreso.id,
        cuentaId: efectivo.id,
      }),
    'rechaza categoría de tipo distinto',
  );
  await esperarError(
    () =>
      servicio.crearTransaccion({
        monto: -5,
        tipo: 'gasto',
        fecha: '2026-11-10',
        descripcion: 'Monto inválido',
        categoriaId: catGasto.id,
        cuentaId: efectivo.id,
      }),
    'rechaza monto negativo',
  );

  const saldos = await servicio.obtenerSaldos();
  const saldo = (id) => saldos.find((item) => item.cuentaId === id).saldo;
  afirmar(saldo(efectivo.id) === -25_000, 'descuenta el gasto del efectivo');
  afirmar(saldo(banco.id) === 600_000, 'suma el ingreso al banco');

  await servicio.transferir({
    cuentaOrigenId: banco.id,
    cuentaDestinoId: efectivo.id,
    monto: 100_000,
    fecha: '2026-11-12',
  });
  const saldosTras = await servicio.obtenerSaldos();
  const saldoTras = (id) => saldosTras.find((item) => item.cuentaId === id).saldo;
  afirmar(saldoTras(efectivo.id) === 75_000, 'la transferencia acredita el destino');
  afirmar(saldoTras(banco.id) === 500_000, 'la transferencia debita el origen');

  console.log('\nReportes');
  const resumen = await servicio.obtenerResumen();
  afirmar(resumen.totalIngresos === 500_000, 'total de ingresos correcto');
  afirmar(resumen.totalGastos === 25_000, 'total de gastos correcto');
  afirmar(resumen.balance === 475_000, 'balance = ingresos − gastos');
  afirmar(resumen.cantidadTransacciones === 2, 'la transferencia no cuenta como transacción');

  const estado = await servicio.obtenerEstadoResultados('2026-11-01', '2026-11-30');
  afirmar(estado.utilidad === 475_000, 'utilidad del periodo');
  afirmar((await servicio.obtenerFlujoCaja('2026-01-01', '2026-12-31'))[0].mes === '2026-11', 'flujo mensual');

  const csv = await servicio.exportarTransaccionesCsv({ desde: '2026-11-01', hasta: '2026-11-30' });
  afirmar(csv.startsWith('Fecha,Tipo,Descripción'), 'CSV con cabecera');
  afirmar(csv.includes('Supermercado') && csv.includes('Salario'), 'CSV con los movimientos');

  const respaldo = await servicio.exportarRespaldo();
  afirmar(respaldo.version === 1 && respaldo.transacciones.length === 2, 'respaldo exportado');

  console.log('\nAislamiento entre usuarios');
  await servicio.cerrarSesion();
  afirmar((await servicio.usuarioActual()) === null, 'cierra la sesión');

  const registroB = await servicio.registrar({
    nombre: 'Beto Mora',
    correo: 'beto@example.com',
    contrasena: 'otraClave456',
  });
  afirmar((await servicio.listarTransacciones()).length === 0, 'el usuario B no ve movimientos de A');
  afirmar((await servicio.listarCuentas()).length === 1, 'el usuario B solo ve su cuenta');
  await esperarError(
    () => servicio.actualizarCuenta(banco.id, { nombre: 'Robada' }),
    'un usuario no puede editar cuentas de otro',
  );
  await esperarError(
    () => servicio.actualizarTransaccion(respaldo.transacciones[0].id, { monto: 1 }),
    'un usuario no puede editar movimientos de otro',
  );

  await servicio.importarRespaldo(respaldo);
  const cuentasB = await servicio.listarCuentas();
  const transaccionesB = await servicio.listarTransacciones();
  afirmar(cuentasB.length === 2 && transaccionesB.length === 2, 'importa el respaldo en la cuenta actual');
  afirmar(
    transaccionesB.every((transaccion) => transaccion.usuarioId === registroB.usuario.id),
    'el respaldo importado se marca con el usuario de la sesión',
  );
  afirmar(
    transaccionesB.every(
      (transaccion) => !respaldo.transacciones.some((original) => original.id === transaccion.id),
    ),
    'el respaldo importado regenera los identificadores',
  );

  await servicio.resetearDatos();
  afirmar((await servicio.listarCategorias()).length === 34, 'el reset restaura 34 categorías');
  afirmar((await servicio.listarCuentas()).length === 1, 'el reset restaura una cuenta');
  afirmar((await servicio.listarTransacciones()).length === 0, 'el reset borra movimientos');

  console.log('\nContraseñas y recuperación');
  await servicio.cerrarSesion();
  await esperarError(() => servicio.iniciarSesion('ana@example.com', 'incorrecta'), 'rechaza contraseña incorrecta');
  const sesionA = await servicio.iniciarSesion('ANA@example.com', 'claveSegura123');
  afirmar(sesionA.id === registroA.usuario.id, 'el login normaliza el correo');

  await servicio.cambiarContrasena('claveSegura123', 'nuevaClave789');
  await servicio.cerrarSesion();
  await esperarError(() => servicio.iniciarSesion('ana@example.com', 'claveSegura123'), 'la contraseña anterior deja de servir');
  await servicio.iniciarSesion('ana@example.com', 'nuevaClave789');
  afirmar(true, 'la contraseña nueva funciona');
  await servicio.cerrarSesion();

  const recuperacion = await servicio.recuperarContrasena(
    'ana@example.com',
    registroA.codigoRecuperacion,
    'recuperada123',
  );
  afirmar(recuperacion.codigoRecuperacion !== registroA.codigoRecuperacion, 'rota el código de recuperación');
  await esperarError(
    () => servicio.recuperarContrasena('ana@example.com', registroA.codigoRecuperacion, 'otraClave000'),
    'el código usado ya no funciona',
  );
  await servicio.iniciarSesion('ana@example.com', 'recuperada123');
  afirmar(true, 'la contraseña recuperada funciona');

  console.log('\nEliminación de cuenta');
  await esperarError(() => servicio.eliminarCuenta('incorrecta'), 'exige la contraseña para eliminar');
  await servicio.eliminarCuenta('recuperada123');
  afirmar((await servicio.usuarioActual()) === null, 'elimina la sesión');
  await esperarError(() => servicio.iniciarSesion('ana@example.com', 'recuperada123'), 'la cuenta eliminada ya no existe');
  afirmar(
    (await db.transacciones.where('usuarioId').equals(registroA.usuario.id).count()) === 0,
    'elimina los datos financieros del usuario',
  );

  console.log(`\n${pruebas} verificaciones correctas.`);
} finally {
  await db.delete();
  await servidor.close();
}
