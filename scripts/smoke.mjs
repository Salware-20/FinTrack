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
const { normalizarError } = await servidor.ssrLoadModule('/src/utils/errores.ts');
const { ErrorValidacion } = await servidor.ssrLoadModule('/src/models/errores.ts');
const { siguienteOcurrencia } = await servidor.ssrLoadModule(
  '/src/utils/recurrencia.ts',
);
const {
  ORDEN_INICIAL,
  siguienteOrden,
  ordenarFilas,
  compararTexto,
  compararNumero,
  compararFecha,
} = await servidor.ssrLoadModule('/src/dev/componentes/ordenTabla.ts');
const {
  detectarSeparador,
  parsearCsv,
  normalizarFechaCruda,
  normalizarMontoCrudo,
} = await servidor.ssrLoadModule('/src/utils/importadorCsv.ts');
const {
  detectarGastosHormiga,
  normalizarDescripcionComercio,
  claveComercio,
  calcularSimulacion,
  mensualizarMontoRecurrente,
  sumarMeses,
} = await servidor.ssrLoadModule('/src/utils/analisisFinanciero.ts');
const { UMBRAL_GASTOS_HORMIGA } = await servidor.ssrLoadModule(
  '/src/models/tipos.ts',
);

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
  console.log('\nNormalizacion de errores');
  const errorCampo = normalizarError(
    new ErrorValidacion('El monto debe ser un numero mayor que cero.', 'monto'),
  );
  afirmar(
    errorCampo.tipo === 'validacion' &&
      errorCampo.campo === 'monto' &&
      errorCampo.mensaje.includes('monto'),
    'clasifica la validacion con su campo',
  );

  const errorSesion = normalizarError(
    new ErrorValidacion('Debe iniciar sesion para continuar.', 'sesion'),
  );
  afirmar(errorSesion.tipo === 'sesion', 'detecta los errores de sesion');

  const errorCuota = normalizarError(
    new DOMException('The quota has been exceeded.', 'QuotaExceededError'),
  );
  afirmar(
    errorCuota.tipo === 'almacenamiento' && errorCuota.mensaje.includes('espacio'),
    'traduce la falta de cuota a un mensaje util',
  );

  const errorTecnico = normalizarError(new Error('Dexie: UnknownError'));
  afirmar(
    errorTecnico.tipo === 'desconocido' && !errorTecnico.mensaje.includes('Dexie'),
    'oculta los detalles tecnicos',
  );

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
  afirmar(
    respaldo.version === 3 &&
      respaldo.transacciones.length === 2 &&
      respaldo.recurrencias.length === 0,
    'respaldo exportado con la versión actual',
  );

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

  console.log('\nMovimientos recurrentes');
  const fechaLocal = (fecha) => {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  };
  const sumarDias = (dias) => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);
    return fechaLocal(fecha);
  };
  const hoy = fechaLocal(new Date());
  const cuentaB = (await servicio.listarCuentas())[0];
  const categoriaGastoB = (await servicio.listarCategorias()).find(
    (categoria) => categoria.tipo === 'gasto',
  );

  const diaria = await servicio.crearRecurrencia({
    monto: 3_500,
    tipo: 'gasto',
    fechaInicio: sumarDias(-4),
    descripcion: 'Café diario',
    categoriaId: categoriaGastoB.id,
    cuentaId: cuentaB.id,
    frecuencia: 'diaria',
  });
  afirmar(diaria.generadas === 5, 'genera las ocurrencias vencidas de la regla diaria');
  afirmar((await servicio.listarRecurrencias()).length === 1, 'lista la regla recurrente');
  const generadasDiarias = (await servicio.listarTransacciones()).filter(
    (transaccion) => transaccion.recurrenciaId === diaria.recurrencia.id,
  );
  afirmar(generadasDiarias.length === 5, 'vincula cada movimiento con su regla');
  afirmar(
    generadasDiarias.every((transaccion) => transaccion.estado === 'confirmado'),
    'las ocurrencias se registran confirmadas',
  );
  afirmar((await servicio.procesarRecurrencias()) === 0, 'procesar dos veces no duplica');
  afirmar(
    (await servicio.listarTransacciones()).length === 5,
    'no se crean movimientos adicionales',
  );

  const futura = await servicio.crearRecurrencia({
    monto: 42_000,
    tipo: 'gasto',
    fechaInicio: sumarDias(1),
    descripcion: 'Luz del próximo mes',
    categoriaId: categoriaGastoB.id,
    cuentaId: cuentaB.id,
    frecuencia: 'mensual',
  });
  afirmar(futura.generadas === 0, 'no genera movimientos futuros');
  afirmar(
    futura.recurrencia.proximaFecha === sumarDias(1),
    'la regla futura queda programada para su fecha',
  );
  afirmar(
    (await servicio.listarTransacciones()).every(
      (transaccion) => transaccion.fecha <= hoy,
    ),
    'ningún movimiento generado tiene fecha futura',
  );

  const pausada = await servicio.actualizarRecurrencia(diaria.recurrencia.id, {
    activa: false,
  });
  afirmar(pausada.activa === false, 'pausa una regla recurrente');
  const reanudada = await servicio.actualizarRecurrencia(diaria.recurrencia.id, {
    activa: true,
  });
  afirmar(reanudada.activa === true, 'reanuda una regla recurrente');

  afirmar(
    siguienteOcurrencia('mensual', '2026-01-31', 31) === '2026-02-28',
    'mensual recorta al último día de febrero',
  );
  afirmar(
    siguienteOcurrencia('mensual', '2026-02-28', 31) === '2026-03-31',
    'mensual recupera el día original tras un mes corto',
  );
  afirmar(
    siguienteOcurrencia('diaria', '2026-12-31') === '2027-01-01',
    'la frecuencia diaria cruza el año',
  );
  afirmar(
    siguienteOcurrencia('semanal', '2026-12-29') === '2027-01-05',
    'la frecuencia semanal avanza 7 días',
  );

  const respaldoRecurrente = await servicio.exportarRespaldo();
  afirmar(
    respaldoRecurrente.version === 3 &&
      respaldoRecurrente.recurrencias.length === 2,
    'el respaldo incluye las reglas recurrentes',
  );

  await servicio.resetearDatos();
  afirmar(
    (await servicio.listarRecurrencias()).length === 0,
    'el reset borra las reglas recurrentes',
  );

  await servicio.importarRespaldo(respaldoRecurrente);
  const reglasImportadas = await servicio.listarRecurrencias();
  afirmar(reglasImportadas.length === 2, 'importa las reglas del respaldo');
  afirmar(
    reglasImportadas.every(
      (regla) =>
        !respaldoRecurrente.recurrencias.some(
          (original) => original.id === regla.id,
        ),
    ),
    'la importación regenera los ids de las reglas',
  );
  const transaccionesImportadas = await servicio.listarTransacciones();
  afirmar(
    transaccionesImportadas.length === 5 &&
      transaccionesImportadas.every((transaccion) => transaccion.recurrenciaId),
    'importa los movimientos y su vínculo con la regla',
  );
  afirmar(
    transaccionesImportadas.every((transaccion) =>
      reglasImportadas.some((regla) => regla.id === transaccion.recurrenciaId),
    ),
    'los vínculos apuntan a las reglas importadas',
  );

  await servicio.eliminarRecurrencia(reglasImportadas[0].id);
  afirmar(
    (await servicio.listarRecurrencias()).length === 1,
    'elimina una regla recurrente',
  );
  afirmar(
    (await servicio.listarTransacciones()).length === 5,
    'conserva los movimientos ya generados al eliminar la regla',
  );

  const conFin = await servicio.crearRecurrencia({
    monto: 10_000,
    tipo: 'gasto',
    fechaInicio: hoy,
    fechaFin: hoy,
    descripcion: 'Pago con fecha final',
    categoriaId: (await servicio.listarCategorias()).find(
      (categoria) => categoria.tipo === 'gasto',
    ).id,
    cuentaId: (await servicio.listarCuentas())[0].id,
    frecuencia: 'mensual',
  });
  afirmar(conFin.generadas === 1, 'genera la ocurrencia dentro de la fecha final');
  afirmar(
    conFin.recurrencia.finalizada && !conFin.recurrencia.activa,
    'finaliza la regla al alcanzar su fecha final',
  );

  console.log('\nContraseñas y recuperación');
  await servicio.cerrarSesion();
  await esperarError(() => servicio.iniciarSesion('ana@example.com', 'incorrecta'), 'rechaza contraseña incorrecta');
  const sesionA = await servicio.iniciarSesion('ANA@example.com', 'claveSegura123');
  afirmar(sesionA.id === registroA.usuario.id, 'el login normaliza el correo');
  afirmar(
    (await servicio.listarRecurrencias()).length === 0,
    'un usuario no ve las reglas recurrentes de otro',
  );
  afirmar(
    (await servicio.procesarRecurrencias()) === 0,
    'procesar recurrentes no genera movimientos para otros usuarios',
  );

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

  console.log('\nPresupuestos y control de gastos');
  await servicio.iniciarSesion('beto@example.com', 'otraClave456');
  const catAlimentacion = (await servicio.listarCategorias()).find((c) => c.nombre.startsWith('Alimentaci'));
  const catSupermercado = (await servicio.listarCategorias()).find((c) => c.nombre === 'Supermercado');
  const catCafeteria = (await servicio.listarCategorias()).find((c) => c.nombre.startsWith('Cafeter'));
  const catTransporte = (await servicio.listarCategorias()).find((c) => c.nombre === 'Transporte');
  const catSalario = (await servicio.listarCategorias()).find((c) => c.tipo === 'ingreso');

  await esperarError(
    () => servicio.crearPresupuesto({ categoriaId: catSalario.id, montoLimite: 100_000 }),
    'rechaza presupuesto para categoría de ingreso',
  );

  const presupuestoAlim = await servicio.crearPresupuesto({
    categoriaId: catAlimentacion.id,
    montoLimite: 100_000,
    alertaPorcentaje: 80,
  });
  afirmar(presupuestoAlim.montoLimite === 100_000, 'crea presupuesto con límite');

  await esperarError(
    () => servicio.crearPresupuesto({ categoriaId: catAlimentacion.id, montoLimite: 50_000 }),
    'rechaza presupuesto duplicado para la misma categoría',
  );

  // Registrar gastos en subcategorías (Supermercado: 50_000, Cafetería: 35_000 -> Total Alimentación = 85_000)
  const cuentaTest = (await servicio.listarCuentas())[0];
  await servicio.crearTransaccion({
    monto: 50_000,
    tipo: 'gasto',
    fecha: hoy,
    descripcion: 'Compras súper',
    categoriaId: catSupermercado.id,
    cuentaId: cuentaTest.id,
  });
  await servicio.crearTransaccion({
    monto: 35_000,
    tipo: 'gasto',
    fecha: hoy,
    descripcion: 'Cafetería trabajo',
    categoriaId: catCafeteria.id,
    cuentaId: cuentaTest.id,
  });

  const estadosPresupuesto = await servicio.obtenerEstadoPresupuestos();
  const estadoAlim = estadosPresupuesto.find((ep) => ep.categoriaId === catAlimentacion.id);
  afirmar(estadoAlim.montoGastado === 85_000, 'acumula subcategorías (Supermercado + Cafetería) en el presupuesto raíz');
  afirmar(estadoAlim.porcentajeConsumido === 85, 'calcula porcentaje consumido correcto (85%)');
  afirmar(estadoAlim.estadoAlerta === 'advertencia', 'clasifica en advertencia al superar el 80%');

  // Gasto adicional para exceder el presupuesto (100_000)
  await servicio.crearTransaccion({
    monto: 20_000,
    tipo: 'gasto',
    fecha: hoy,
    descripcion: 'Más cafetería',
    categoriaId: catCafeteria.id,
    cuentaId: cuentaTest.id,
  });
  const estadosExcedido = await servicio.obtenerEstadoPresupuestos();
  const estadoAlimExcedido = estadosExcedido.find((ep) => ep.categoriaId === catAlimentacion.id);
  afirmar(estadoAlimExcedido.montoGastado === 105_000, 'monto gastado excede límite (105_000)');
  afirmar(estadoAlimExcedido.estadoAlerta === 'excedido', 'clasifica en excedido al superar 100%');

  // Detección automática por concentración de gasto >= 30%
  const alertasIniciales = await servicio.obtenerAlertasConcentracion();
  afirmar(alertasIniciales.length >= 1, 'detecta categoría con concentración >= 30%');
  afirmar(alertasIniciales[0].categoriaId === catAlimentacion.id, 'identifica Alimentación como concentración principal');
  afirmar(alertasIniciales[0].porcentajeDelTotal >= 30, 'porcentaje del total supera el umbral del 30%');

  // Registro de otro gasto grande en Transporte de 300_000
  await servicio.crearTransaccion({
    monto: 300_000,
    tipo: 'gasto',
    fecha: hoy,
    descripcion: 'Reparación vehículo',
    categoriaId: catTransporte.id,
    cuentaId: cuentaTest.id,
  });
  const alertasActualizadas = await servicio.obtenerAlertasConcentracion();
  afirmar(alertasActualizadas.length === 1, 'solo queda Transporte por encima del 30%');
  afirmar(alertasActualizadas[0].categoriaId === catTransporte.id, 'Transporte lidera la alerta de concentración');
  afirmar(alertasActualizadas[0].porcentajeDelTotal >= 30, 'calcula concentración de Transporte > 70%');

  // Configuración de meta de ahorro mensual
  await servicio.actualizarConfiguracion({ metaAhorroMensual: 50_000 });
  const confActualizada = await servicio.obtenerConfiguracion();
  afirmar(confActualizada.metaAhorroMensual === 50_000, 'actualiza la meta de ahorro mensual');

  await servicio.eliminarPresupuesto(presupuestoAlim.id);
  afirmar((await servicio.listarPresupuestos()).length === 0, 'elimina presupuesto correctamente');

  console.log('\nImportador CSV');
  afirmar(detectarSeparador(['a,b,c', '1,2,3']) === ',', 'detecta el separador coma');
  afirmar(detectarSeparador(['a;b;c', '1;2;3']) === ';', 'detecta el separador punto y coma');
  afirmar(
    detectarSeparador(['"Perez, Ana";monto', 'x;y']) === ';',
    'ignora las comas dentro de comillas al detectar el separador',
  );

  const filasComillas = parsearCsv(
    'Descripción,Monto\n"PAGO, SUPER ""EL REY""",25000',
    ',',
  );
  afirmar(filasComillas.length === 2, 'el tokenizador produce dos filas');
  afirmar(
    filasComillas[1][0] === 'PAGO, SUPER "EL REY"',
    'respeta comillas, comas internas y comillas escapadas',
  );

  const filasBom = parsearCsv(
    '\uFEFFFecha;Monto\r\n2026-03-15;1000\r\n',
    ';',
  );
  afirmar(
    filasBom[0][0] === 'Fecha' && filasBom[1][0] === '2026-03-15',
    'quita el BOM y normaliza los saltos CRLF',
  );

  afirmar(normalizarFechaCruda('15/03/2026') === '2026-03-15', 'fecha DD/MM/YYYY');
  afirmar(normalizarFechaCruda('2026-03-15') === '2026-03-15', 'fecha AAAA-MM-DD');
  afirmar(normalizarFechaCruda('5/3/26') === '2026-03-05', 'fecha con año de dos dígitos');
  afirmar(
    normalizarFechaCruda('15/03/2026 00:00:00') === '2026-03-15',
    'fecha con sufijo de hora',
  );
  afirmar(normalizarFechaCruda('31/02/2026') === null, 'rechaza fechas inexistentes');
  afirmar(normalizarFechaCruda('hoy') === null, 'rechaza texto que no es fecha');

  afirmar(normalizarMontoCrudo('₡1.234,56') === 1234.56, 'monto con colones y miles');
  afirmar(normalizarMontoCrudo('1,234.56') === 1234.56, 'monto con formato estadounidense');
  afirmar(normalizarMontoCrudo('(12.500,00)') === -12500, 'monto negativo entre paréntesis');
  afirmar(normalizarMontoCrudo('1.234') === 1234, 'monto con separador de miles');
  afirmar(normalizarMontoCrudo('-45.000') === -45000, 'monto negativo con guion');
  afirmar(normalizarMontoCrudo('1234,5') === 1234.5, 'monto con decimales');
  afirmar(normalizarMontoCrudo('abc') === null, 'rechaza montos no numéricos');

  const cuentaCsv = await servicio.crearCuenta({
    nombre: 'Banco CSV',
    tipo: 'banco',
    saldoInicial: 0,
  });
  const categoriasCsv = await servicio.listarCategorias();
  const catId = (nombre) => categoriasCsv.find((c) => c.nombre === nombre).id;

  const csvDebCred = [
    'Fecha;Descripción;Débito;Crédito',
    '15/03/2024;AUTOMERCADO ESCAZU;25000,50;',
    '16/03/2024;SALARIO PLANILLA;;850000,00',
    '17/03/2024;GASOLINERA UNO;30000;',
  ].join('\n');

  const detectadas = await servicio.previsualizarCsv(csvDebCred, cuentaCsv.id);
  afirmar(detectadas.length === 3, 'detecta los tres movimientos del archivo');
  afirmar(
    detectadas[0].tipo === 'gasto' && detectadas[0].monto === 25000.5,
    'lee la columna Débito como gasto',
  );
  afirmar(
    detectadas[0].categoriaIdSugerida === catId('Supermercado'),
    'categoriza el supermercado con la categoría real',
  );
  afirmar(
    detectadas[1].tipo === 'ingreso' && detectadas[1].monto === 850000,
    'lee la columna Crédito como ingreso',
  );
  afirmar(
    detectadas[1].categoriaIdSugerida === catId('Salario'),
    'categoriza el salario como ingreso',
  );
  afirmar(
    detectadas[2].categoriaIdSugerida === catId('Gasolina'),
    'categoriza la gasolinera',
  );
  afirmar(
    (await servicio.listarTransacciones({ cuentaId: cuentaCsv.id })).length === 0,
    'la previsualización no guarda nada',
  );

  const csvMetadatos = [
    'Banco de Costa Rica',
    'Cuenta: CR05015201001024879666',
    'Saldo disponible: 1.000.000,00',
    'Fecha;Descripción;Monto',
    '01/04/2024;UBER TRIP;-12500,00',
    '02/04/2024;AYA ACUEDUCTO;-8900',
    ';;TOTAL;',
  ].join('\n');
  const conMetadatos = await servicio.previsualizarCsv(
    csvMetadatos,
    cuentaCsv.id,
  );
  afirmar(conMetadatos.length === 2, 'ignora metadatos previos y filas de totales');
  afirmar(
    conMetadatos[0].categoriaIdSugerida === catId('Didi / Uber'),
    'categoriza Uber/Didi',
  );
  afirmar(
    conMetadatos[1].categoriaIdSugerida === catId('Agua'),
    'categoriza el recibo de AyA',
  );

  await servicio.crearTransaccion({
    monto: 25_000,
    tipo: 'gasto',
    fecha: '2024-05-02',
    descripcion: 'Supermercado del barrio',
    categoriaId: catId('Supermercado'),
    cuentaId: cuentaCsv.id,
  });
  const csvDuplicados = [
    'Fecha;Descripción;Débito;Crédito',
    '02/05/2024;SUPERMERCADO DEL BARRIO;25000;',
    '02/05/2024;SUPERMERCADO DEL BARRIO;25000;',
    '03/05/2024;TIENDA LA ESQUINA;25000;',
  ].join('\n');
  const conDuplicados = await servicio.previsualizarCsv(
    csvDuplicados,
    cuentaCsv.id,
  );
  afirmar(
    conDuplicados[0].posibleDuplicado === true,
    'marca un movimiento que ya existe en la cuenta',
  );
  afirmar(
    conDuplicados[1].posibleDuplicado === true,
    'marca la fila repetida dentro del mismo archivo',
  );
  afirmar(
    conDuplicados[2].posibleDuplicado === false,
    'no marca un movimiento distinto del mismo día',
  );

  const otraCuenta = await servicio.crearCuenta({
    nombre: 'Ahorro CSV',
    tipo: 'ahorro',
    saldoInicial: 0,
  });
  const enOtraCuenta = await servicio.previsualizarCsv(
    csvDuplicados,
    otraCuenta.id,
  );
  afirmar(
    enOtraCuenta[0].posibleDuplicado === false,
    'no marca duplicados de movimientos de otra cuenta',
  );

  const csvCortas = [
    'Fecha;Descripción;Monto',
    '01/06/2024;MAXIMILIANO SERVICIOS;-1000',
    '02/06/2024;GASOLINERA UNO;-20000',
    '03/06/2024;BAR LA ESQUINA;-5000',
    '04/06/2024;AYA ACUEDUCTO;-3000',
    '05/06/2024;ICE ELECTRICIDAD;-15000',
  ].join('\n');
  const cortas = await servicio.previsualizarCsv(csvCortas, cuentaCsv.id);
  afirmar(
    cortas[0].categoriaIdSugerida === catId('Otros gastos'),
    'no confunde "maximiliano" con la clave corta "max"',
  );
  afirmar(
    cortas[1].categoriaIdSugerida === catId('Gasolina'),
    'la clave corta "uno" coincide como token completo',
  );
  afirmar(
    cortas[2].categoriaIdSugerida === catId('Restaurante'),
    'la clave corta "bar" coincide como token completo',
  );
  afirmar(
    cortas[3].categoriaIdSugerida === catId('Agua'),
    'la clave corta "aya" coincide como token completo',
  );
  afirmar(
    cortas[4].categoriaIdSugerida === catId('Luz'),
    'la clave corta "ice" coincide como token completo',
  );

  const antesAtomicidad = (
    await servicio.listarTransacciones({ cuentaId: cuentaCsv.id })
  ).length;
  const catIngresoCsv = categoriasCsv.find((c) => c.tipo === 'ingreso');
  const filasAtomicas = [
    {
      id: 'csv-1',
      fecha: '2024-07-01',
      descripcion: 'Fila válida',
      monto: 1000,
      tipo: 'gasto',
      categoriaIdSugerida: catId('Supermercado'),
      metodoPagoSugerido: 'efectivo',
      posibleDuplicado: false,
      numeroFila: 1,
    },
    {
      id: 'csv-2',
      fecha: '2024-07-02',
      descripcion: 'Fila con categoría cruzada',
      monto: 2000,
      tipo: 'gasto',
      categoriaIdSugerida: catIngresoCsv.id,
      metodoPagoSugerido: 'efectivo',
      posibleDuplicado: false,
      numeroFila: 2,
    },
  ];
  await esperarError(
    () => servicio.confirmarImportacionCsv(cuentaCsv.id, filasAtomicas),
    'rechaza una fila con categoría de tipo distinto',
  );
  afirmar(
    (await servicio.listarTransacciones({ cuentaId: cuentaCsv.id })).length ===
      antesAtomicidad,
    'la importación fallida no guarda ninguna fila (atómica)',
  );
  await esperarError(
    () => servicio.confirmarImportacionCsv(cuentaCsv.id, []),
    'rechaza una importación vacía',
  );

  await servicio.actualizarCuenta(cuentaCsv.id, { activa: false });
  afirmar(
    (await servicio.previsualizarCsv(csvDebCred, cuentaCsv.id)).length === 3,
    'permite previsualizar en una cuenta archivada',
  );
  await esperarError(
    () => servicio.confirmarImportacionCsv(cuentaCsv.id, detectadas),
    'rechaza importar en una cuenta archivada',
  );
  await servicio.actualizarCuenta(cuentaCsv.id, { activa: true });

  await servicio.registrar({
    nombre: 'Carla Vega',
    correo: 'carla@example.com',
    contrasena: 'claveCarla123',
  });
  const cuentaCarla = (await servicio.listarCuentas())[0];
  await servicio.cerrarSesion();
  await servicio.iniciarSesion('beto@example.com', 'otraClave456');
  await esperarError(
    () => servicio.previsualizarCsv(csvDebCred, cuentaCarla.id),
    'no permite previsualizar la cuenta de otro usuario',
  );
  await esperarError(
    () => servicio.confirmarImportacionCsv(cuentaCarla.id, detectadas),
    'no permite importar en la cuenta de otro usuario',
  );

  const importados = await servicio.confirmarImportacionCsv(
    cuentaCsv.id,
    detectadas,
  );
  afirmar(importados === 3, 'importa los movimientos confirmados');
  const trxCuentaCsv = await servicio.listarTransacciones({
    cuentaId: cuentaCsv.id,
  });
  afirmar(
    trxCuentaCsv.length === antesAtomicidad + 3,
    'guarda exactamente las filas confirmadas',
  );
  afirmar(
    trxCuentaCsv.some(
      (transaccion) =>
        transaccion.fecha === '2024-03-16' &&
        transaccion.tipo === 'ingreso' &&
        transaccion.monto === 850_000,
    ),
    'guarda el ingreso con su fecha y monto normalizados',
  );
  afirmar(
    trxCuentaCsv.every((transaccion) => transaccion.cuentaId === cuentaCsv.id),
    'todos los movimientos quedan en la cuenta indicada',
  );
  afirmar(
    trxCuentaCsv.filter((transaccion) =>
      transaccion.etiquetas.includes('importado'),
    ).length === 3,
    'marca los movimientos importados con su etiqueta',
  );
  const saldoCsv = (await servicio.obtenerSaldos()).find(
    (item) => item.cuentaId === cuentaCsv.id,
  );
  afirmar(
    saldoCsv.saldo === 769_999.5,
    'el saldo de la cuenta refleja el neto importado',
  );

  const csvExportado = await servicio.exportarTransaccionesCsv();
  const totalTransacciones = (await servicio.listarTransacciones()).length;
  const reimportadas = await servicio.previsualizarCsv(
    csvExportado,
    cuentaCsv.id,
  );
  afirmar(
    reimportadas.length === totalTransacciones,
    'reconoce el CSV exportado por la propia aplicación',
  );

  // Ordenamiento de tablas de la demo
  const filasNumero = [10, 2, 33].map((valor) => ({ valor }));
  const porNumero = { valor: compararNumero((fila) => fila.valor) };
  const numerosDesc = ordenarFilas(
    filasNumero,
    { clave: 'valor', direccion: 'desc' },
    porNumero,
  );
  afirmar(
    numerosDesc.map((fila) => fila.valor).join(',') === '33,10,2',
    'ordena números de mayor a menor',
  );
  const numerosAsc = ordenarFilas(
    filasNumero,
    { clave: 'valor', direccion: 'asc' },
    porNumero,
  );
  afirmar(
    numerosAsc.map((fila) => fila.valor).join(',') === '2,10,33',
    'ordena números de menor a mayor',
  );
  afirmar(
    ordenarFilas(filasNumero, ORDEN_INICIAL, porNumero)
      .map((fila) => fila.valor)
      .join(',') === '10,2,33',
    'el estado default conserva el orden original',
  );

  afirmar(
    siguienteOrden(ORDEN_INICIAL, 'monto').direccion === 'desc',
    'primer clic en una columna: mayor a menor',
  );
  afirmar(
    siguienteOrden({ clave: 'monto', direccion: 'desc' }, 'monto').direccion ===
      'asc',
    'segundo clic: menor a mayor',
  );
  const tercerClic = siguienteOrden({ clave: 'monto', direccion: 'asc' }, 'monto');
  afirmar(
    tercerClic.clave === null && tercerClic.direccion === 'desc',
    'tercer clic: vuelve al orden original',
  );
  afirmar(
    siguienteOrden({ clave: 'monto', direccion: 'asc' }, 'fecha').clave ===
      'fecha',
    'cambiar de columna reinicia el ciclo',
  );

  const filasTexto = ['Categoría 10', 'categoría 2', 'Ávila', 'Banco'].map(
    (nombre) => ({ nombre }),
  );
  const porTexto = { nombre: compararTexto((fila) => fila.nombre) };
  afirmar(
    ordenarFilas(
      filasTexto,
      { clave: 'nombre', direccion: 'asc' },
      porTexto,
    )
      .map((fila) => fila.nombre)
      .join('|') === 'Ávila|Banco|categoría 2|Categoría 10',
    'ordena texto con acentos y números',
  );

  const filasFecha = ['2026-03-01', '2025-12-31', '2026-01-15'].map((fecha) => ({
    fecha,
  }));
  const porFecha = { fecha: compararFecha((fila) => fila.fecha) };
  afirmar(
    ordenarFilas(
      filasFecha,
      { clave: 'fecha', direccion: 'asc' },
      porFecha,
    )
      .map((fila) => fila.fecha)
      .join('|') === '2025-12-31|2026-01-15|2026-03-01',
    'ordena fechas cronológicamente',
  );

  const filasVacias = [{ valor: 5 }, { valor: null }, { valor: 1 }];
  const porValor = { valor: compararNumero((fila) => fila.valor) };
  for (const direccion of ['asc', 'desc']) {
    const ordenadas = ordenarFilas(
      filasVacias,
      { clave: 'valor', direccion },
      porValor,
    );
    afirmar(
      ordenadas[ordenadas.length - 1].valor === null,
      `deja los valores vacíos al final (${direccion})`,
    );
  }

  const filasEmpate = [
    { grupo: 'b', posicion: 1 },
    { grupo: 'a', posicion: 2 },
    { grupo: 'b', posicion: 3 },
  ];
  const porGrupo = { grupo: compararTexto((fila) => fila.grupo) };
  afirmar(
    ordenarFilas(
      filasEmpate,
      { clave: 'grupo', direccion: 'asc' },
      porGrupo,
    )
      .map((fila) => fila.posicion)
      .join(',') === '2,1,3',
    'mantiene el orden original en los empates',
  );

  // Análisis financiero local
  console.log('\nAnálisis financiero: detector de gastos hormiga');
  afirmar(
    UMBRAL_GASTOS_HORMIGA === 10_000,
    'el umbral por defecto es ₡10 000',
  );
  afirmar(
    normalizarDescripcionComercio('  CAFETERÍA  Ñandú!! ') ===
      'cafeteria nandu',
    'normaliza mayúsculas, tildes, eñes y puntuación',
  );
  afirmar(
    claveComercio('COMPRA POS CAFETERÍA ÑANDÚ 123') === 'cafeteria nandu',
    'descarta ruido bancario y tokens numéricos para agrupar comercios',
  );

  const gastosHormigaUnitarios = [
    {
      monto: 4_000,
      fecha: '2026-11-02',
      descripcion: 'CAFETERÍA ÑANDÚ',
      categoriaId: 'cafe',
      categoriaNombre: 'Alimentación › Cafetería',
    },
    {
      monto: 4_000,
      fecha: '2026-11-05',
      descripcion: 'Cafeteria Nandu',
      categoriaId: 'cafe',
      categoriaNombre: 'Alimentación › Cafetería',
    },
    {
      monto: 4_000,
      fecha: '2026-11-09',
      descripcion: 'COMPRA POS CAFETERIA NANDU 123',
      categoriaId: 'cafe',
      categoriaNombre: 'Alimentación › Cafetería',
    },
    {
      monto: 9_000,
      fecha: '2026-11-10',
      descripcion: 'Farmacia',
      categoriaId: 'farmacia',
      categoriaNombre: 'Salud › Farmacia',
    },
    {
      monto: 25_000,
      fecha: '2026-11-11',
      descripcion: 'Supermercado',
      categoriaId: 'super',
      categoriaNombre: 'Alimentación › Supermercado',
    },
    {
      monto: 3_500,
      fecha: '2026-10-01',
      descripcion: 'Cafetería Ñandú',
      categoriaId: 'cafe',
      categoriaNombre: 'Alimentación › Cafetería',
    },
  ];

  const analisisUnitario = detectarGastosHormiga(gastosHormigaUnitarios, {
    periodo: '2026-11',
    umbralMonto: 10_000,
  });
  afirmar(
    analisisUnitario.totalMensual === 21_000 &&
      analisisUnitario.proyeccionAnual === 252_000,
    'suma los gastos bajo el umbral y proyecta el año (×12)',
  );
  afirmar(
    analisisUnitario.totalGastosPeriodo === 46_000 &&
      analisisUnitario.porcentajeDelGastoTotal === 45.65,
    'compara la fuga con el gasto total del periodo',
  );
  afirmar(
    analisisUnitario.fugas.length === 2 &&
      analisisUnitario.fugas[0].clave === 'cafeteria nandu' &&
      analisisUnitario.fugas[0].cantidad === 3 &&
      analisisUnitario.fugas[0].totalPeriodo === 12_000 &&
      analisisUnitario.fugas[0].proyeccionAnual === 144_000,
    'agrupa las descripciones similares y las ordena por frecuencia',
  );
  afirmar(
    analisisUnitario.cantidadFugasFrecuentes === 1 &&
      analisisUnitario.fugas[0].esFrecuente === true,
    'identifica las fugas con dos o más movimientos',
  );
  afirmar(
    analisisUnitario.fugas[0].porcentajeSobreFugas === 57.14,
    'calcula el porcentaje de cada fuga sobre el total de fugas',
  );

  const analisisCincoMil = detectarGastosHormiga(gastosHormigaUnitarios, {
    periodo: '2026-11',
    umbralMonto: 5_000,
  });
  afirmar(
    analisisCincoMil.totalMensual === 12_000 &&
      analisisCincoMil.fugas.length === 1,
    'con umbral de ₡5 000 solo conserva la cafetería',
  );
  const analisisQuinceMil = detectarGastosHormiga(gastosHormigaUnitarios, {
    periodo: '2026-11',
    umbralMonto: 15_000,
  });
  afirmar(
    analisisQuinceMil.totalMensual === 21_000 &&
      analisisQuinceMil.fugas.length === 2,
    'con umbral de ₡15 000 mantiene los dos comercios',
  );
  const analisisVeinticincoMil = detectarGastosHormiga(gastosHormigaUnitarios, {
    periodo: '2026-11',
    umbralMonto: 25_000,
  });
  afirmar(
    analisisVeinticincoMil.totalMensual === 46_000 &&
      analisisVeinticincoMil.fugas.length === 3,
    'el umbral incluye los montos exactamente iguales',
  );

  const analisisVacio = detectarGastosHormiga([], { periodo: '2026-11' });
  afirmar(
    analisisVacio.totalMensual === 0 &&
      analisisVacio.fugas.length === 0 &&
      analisisVacio.proyeccionAnual === 0 &&
      analisisVacio.porcentajeDelGastoTotal === 0,
    'sin gastos devuelve ceros sin NaN',
  );
  afirmar(
    !Number.isNaN(analisisVacio.porcentajeDelGastoTotal),
    'el porcentaje del gasto total nunca es NaN',
  );

  console.log('\nAnálisis financiero: simulador (funciones puras)');
  const contextoBase = {
    periodoReferencia: '2026-11',
    mesesAnalizados: ['2026-09', '2026-10', '2026-11'],
    ingresosPromedio: 600_000,
    gastosPromedio: 450_000,
    flujoLibrePromedio: 150_000,
    ingresosBase: 600_000,
    gastosBase: 450_000,
    flujoLibreActual: 150_000,
    gastoCategoriaPromedio: 40_000,
    categoriaRecorteNombre: 'Cafetería',
    metaAhorroMensual: 50_000,
    ingresoRecurrenteMensual: 0,
    compromisoRecurrenteMensual: 0,
    recurrenciasActivas: [],
  };

  const escenarioViable = calcularSimulacion(contextoBase, {
    montoObjetivo: 600_000,
    meses: 6,
  });
  afirmar(
    escenarioViable.cuotaMensual === 100_000 &&
      escenarioViable.disponibleParaCuota === 100_000 &&
      escenarioViable.diferenciaMensual === 0,
    'reparte el objetivo en cuotas y descuenta la meta de ahorro',
  );
  afirmar(
    escenarioViable.viable === true &&
      escenarioViable.diagnostico === 'success',
    'marca como viable el escenario que conserva la meta',
  );
  afirmar(
    escenarioViable.mesesParaObjetivo === 4 &&
      escenarioViable.fechaEstimada === '2027-03',
    'estima los meses reales para juntar el monto y su fecha',
  );

  const escenarioAjustado = calcularSimulacion(contextoBase, {
    montoObjetivo: 120_000,
    meses: 1,
  });
  afirmar(
    escenarioAjustado.alcanzaCuota === true &&
      escenarioAjustado.viable === false &&
      escenarioAjustado.diagnostico === 'warning' &&
      escenarioAjustado.diferenciaMensual === -20_000,
    'avisa cuando la cuota cabe pero sacrifica la meta',
  );

  const escenarioInviable = calcularSimulacion(contextoBase, {
    montoObjetivo: 200_000,
    meses: 1,
  });
  afirmar(
    escenarioInviable.alcanzaCuota === false &&
      escenarioInviable.diagnostico === 'danger',
    'marca como inviable la cuota que supera el flujo',
  );

  const escenarioConRecorte = calcularSimulacion(contextoBase, {
    montoObjetivo: 160_000,
    meses: 1,
    categoriaRecorteId: 'cat-cafe',
    porcentajeRecorte: 50,
  });
  afirmar(
    escenarioConRecorte.ahorroMensualRecorte === 20_000 &&
      escenarioConRecorte.ahorroAnualRecorte === 240_000 &&
      escenarioConRecorte.flujoLibreProyectado === 170_000,
    'el recorte libera flujo mensual y se anualiza para comparar',
  );
  afirmar(
    escenarioConRecorte.diagnostico === 'warning',
    'el recorte mejora el diagnóstico de inviable a ajustado',
  );
  afirmar(
    calcularSimulacion(contextoBase, {
      montoObjetivo: 160_000,
      meses: 1,
    }).diagnostico === 'danger',
    'sin el recorte el mismo escenario es inviable',
  );

  const escenarioSinFlujo = calcularSimulacion(
    {
      ...contextoBase,
      ingresosBase: 100_000,
      gastosBase: 200_000,
      flujoLibreActual: -100_000,
      metaAhorroMensual: 0,
    },
    { montoObjetivo: 50_000, meses: 1 },
  );
  afirmar(
    escenarioSinFlujo.mesesParaObjetivo === null &&
      escenarioSinFlujo.fechaEstimada === null,
    'sin flujo positivo no promete una fecha de ahorro',
  );

  afirmar(
    mensualizarMontoRecurrente('mensual', 10_000) === 10_000,
    'mensualiza una regla mensual sin cambios',
  );
  afirmar(
    mensualizarMontoRecurrente('semanal', 10_000) === 43_333.33,
    'mensualiza una regla semanal (×52/12)',
  );
  afirmar(
    mensualizarMontoRecurrente('diaria', 10_000) === 304_166.67,
    'mensualiza una regla diaria (×365/12)',
  );
  afirmar(
    sumarMeses('2026-11', 4) === '2027-03' &&
      sumarMeses('2026-12', 1) === '2027-01' &&
      sumarMeses('2026-01', 12) === '2027-01',
    'suma meses cruzando el año correctamente',
  );

  console.log('\nAnálisis financiero: servicio');
  const fechaLocalAnalisis = (fecha) => {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  };
  const mesRelativo = (desplazamiento) => {
    const ahora = new Date();
    return fechaLocalAnalisis(
      new Date(ahora.getFullYear(), ahora.getMonth() + desplazamiento, 1),
    ).slice(0, 7);
  };
  const fechaDeMes = (desplazamiento, dia = 1) =>
    `${mesRelativo(desplazamiento)}-${String(dia).padStart(2, '0')}`;

  await servicio.registrar({
    nombre: 'Dora Análisis',
    correo: 'dora@example.com',
    contrasena: 'analisis123',
  });
  await servicio.actualizarConfiguracion({ metaAhorroMensual: 50_000 });

  const cuentaD = (await servicio.listarCuentas())[0];
  const categoriasD = await servicio.listarCategorias();
  const catD = (nombre) =>
    categoriasD.find((categoria) => categoria.nombre === nombre);
  const catSuperD = catD('Supermercado');
  const catCafeD = catD('Cafetería');
  const catFarmaciaD = catD('Farmacia');
  const catAlimentacionD = catD('Alimentación');
  const catSalarioD = catD('Salario');
  const catTransporteD = catD('Transporte');
  const catStreamingD = catD('Streaming');

  const movimientosD = [
    { mes: -3, tipo: 'ingreso', monto: 600_000, descripcion: 'Salario', categoriaId: catSalarioD.id },
    { mes: -3, tipo: 'gasto', monto: 40_000, descripcion: 'Supermercado', categoriaId: catSuperD.id },
    { mes: -2, tipo: 'ingreso', monto: 600_000, descripcion: 'Salario', categoriaId: catSalarioD.id },
    { mes: -2, tipo: 'gasto', monto: 50_000, descripcion: 'Supermercado', categoriaId: catSuperD.id },
    { mes: -1, tipo: 'ingreso', monto: 600_000, descripcion: 'Salario', categoriaId: catSalarioD.id },
    { mes: -1, tipo: 'gasto', monto: 25_000, descripcion: 'Supermercado', categoriaId: catSuperD.id },
    { mes: -1, tipo: 'gasto', monto: 4_000, descripcion: 'CAFETERÍA ÑANDÚ', categoriaId: catCafeD.id },
    { mes: -1, tipo: 'gasto', monto: 4_000, descripcion: 'Cafeteria Nandu', categoriaId: catCafeD.id },
    { mes: -1, tipo: 'gasto', monto: 4_000, descripcion: 'COMPRA POS CAFETERIA NANDU 123', categoriaId: catCafeD.id },
    { mes: -1, tipo: 'gasto', monto: 9_000, descripcion: 'Farmacia', categoriaId: catFarmaciaD.id },
    { mes: 0, tipo: 'ingreso', monto: 100_000, descripcion: 'Salario', categoriaId: catSalarioD.id },
    { mes: 0, tipo: 'gasto', monto: 25_000, descripcion: 'Supermercado', categoriaId: catSuperD.id },
    { mes: 0, tipo: 'gasto', monto: 4_000, descripcion: 'CAFETERÍA ÑANDÚ', categoriaId: catCafeD.id },
    { mes: 0, tipo: 'gasto', monto: 4_000, descripcion: 'Cafeteria Nandu', categoriaId: catCafeD.id },
    { mes: 0, tipo: 'gasto', monto: 4_000, descripcion: 'COMPRA POS CAFETERIA NANDU 123', categoriaId: catCafeD.id },
    { mes: 0, tipo: 'gasto', monto: 9_000, descripcion: 'Farmacia', categoriaId: catFarmaciaD.id },
    { mes: 0, tipo: 'gasto', monto: 3_000, descripcion: 'Cafetería pendiente', categoriaId: catCafeD.id, estado: 'pendiente' },
  ];

  for (const movimiento of movimientosD) {
    await servicio.crearTransaccion({
      monto: movimiento.monto,
      tipo: movimiento.tipo,
      fecha: fechaDeMes(movimiento.mes),
      descripcion: movimiento.descripcion,
      categoriaId: movimiento.categoriaId,
      cuentaId: cuentaD.id,
      estado: movimiento.estado,
    });
  }

  const analisisServicio = await servicio.analizarGastosHormiga(
    mesRelativo(0),
    10_000,
  );
  afirmar(
    analisisServicio.totalMensual === 21_000 &&
      analisisServicio.proyeccionAnual === 252_000 &&
      analisisServicio.totalGastosPeriodo === 46_000,
    'el servicio analiza solo los gastos confirmados del mes',
  );
  afirmar(
    analisisServicio.fugas[0].clave === 'cafeteria nandu' &&
      analisisServicio.fugas[0].cantidad === 3 &&
      analisisServicio.fugas[0].proyeccionAnual === 144_000 &&
      analisisServicio.cantidadFugasFrecuentes === 1,
    'devuelve el ranking de fugas frecuentes del servicio',
  );
  afirmar(
    (await servicio.analizarGastosHormiga(mesRelativo(0), 5_000))
      .totalMensual === 12_000,
    'el servicio respeta un umbral personalizado',
  );
  afirmar(
    (await servicio.analizarGastosHormiga(mesRelativo(0))).umbralMonto ===
      10_000,
    'el servicio aplica el umbral por defecto',
  );
  await esperarError(
    () => servicio.analizarGastosHormiga('2026-13'),
    'rechaza un periodo con mes inexistente',
  );
  await esperarError(
    () => servicio.analizarGastosHormiga(mesRelativo(0), -1),
    'rechaza un umbral negativo',
  );

  const simulacionBase = await servicio.simularEscenario({
    montoObjetivo: 300_000,
    meses: 6,
  });
  afirmar(
    simulacionBase.mesesAnalizados.length === 3 &&
      simulacionBase.mesesAnalizados[0] === mesRelativo(-3) &&
      simulacionBase.mesesAnalizados[2] === mesRelativo(-1),
    'prioriza los meses cerrados y excluye el mes actual incompleto',
  );
  afirmar(
    simulacionBase.ingresosPromedio === 600_000 &&
      Math.abs(simulacionBase.gastosPromedio - 45_333.33) < 0.01 &&
      Math.abs(simulacionBase.flujoLibrePromedio - 554_666.67) < 0.01,
    'calcula promedios reales sobre los meses analizados',
  );
  afirmar(
    Math.abs(simulacionBase.gastosBase - 45_333.33) < 0.01 &&
      simulacionBase.viable === true &&
      simulacionBase.diagnostico === 'success' &&
      simulacionBase.mesesParaObjetivo === 1,
    'el escenario base es viable y estima un mes para el objetivo',
  );

  const recorteCafeteria = await servicio.simularEscenario({
    montoObjetivo: 300_000,
    meses: 6,
    categoriaRecorteId: catCafeD.id,
    porcentajeRecorte: 50,
  });
  afirmar(
    recorteCafeteria.gastoCategoriaPromedio === 4_000 &&
      recorteCafeteria.ahorroMensualRecorte === 2_000 &&
      recorteCafeteria.ahorroAnualRecorte === 24_000,
    'el recorte de una subcategoría usa solo su gasto real',
  );
  afirmar(
    Math.abs(recorteCafeteria.flujoLibreProyectado - 556_666.67) < 0.01,
    'el recorte incrementa el flujo libre proyectado',
  );

  const recorteAlimentacion = await servicio.simularEscenario({
    montoObjetivo: 300_000,
    meses: 6,
    categoriaRecorteId: catAlimentacionD.id,
    porcentajeRecorte: 50,
  });
  afirmar(
    Math.abs(recorteAlimentacion.gastoCategoriaPromedio - 42_333.33) < 0.01,
    'el recorte de una categoría padre incluye sus subcategorías',
  );
  afirmar(
    Math.abs(recorteAlimentacion.ahorroMensualRecorte - 21_166.67) < 0.02 &&
      Math.abs(recorteAlimentacion.ahorroAnualRecorte - 254_000) < 0.2,
    'anualiza el ahorro del recorte jerárquico',
  );

  const simulacionAjustada = await servicio.simularEscenario({
    montoObjetivo: 520_000,
    meses: 1,
  });
  afirmar(
    simulacionAjustada.alcanzaCuota === true &&
      simulacionAjustada.viable === false &&
      simulacionAjustada.diagnostico === 'warning',
    'clasifica como ajustada la cuota que rompe la meta',
  );
  const simulacionInviable = await servicio.simularEscenario({
    montoObjetivo: 600_000,
    meses: 1,
  });
  afirmar(
    simulacionInviable.alcanzaCuota === false &&
      simulacionInviable.diagnostico === 'danger',
    'clasifica como inviable la cuota superior al flujo',
  );

  const fechaFutura = fechaDeMes(1, 1);
  const reglaGastoFutura = await servicio.crearRecurrencia({
    monto: 20_000,
    tipo: 'gasto',
    fechaInicio: fechaFutura,
    descripcion: 'Seguro del próximo mes',
    categoriaId: catTransporteD.id,
    cuentaId: cuentaD.id,
    frecuencia: 'mensual',
  });
  afirmar(
    reglaGastoFutura.generadas === 0,
    'una regla futura no genera movimientos',
  );
  const simulacionConGastoFuturo = await servicio.simularEscenario({
    montoObjetivo: 300_000,
    meses: 6,
  });
  afirmar(
    simulacionConGastoFuturo.compromisoRecurrenteMensual === 20_000 &&
      simulacionConGastoFuturo.recurrenciasActivas.length === 1,
    'mensualiza el compromiso de una regla de gasto vigente',
  );
  afirmar(
    Math.abs(simulacionConGastoFuturo.gastosBase - 65_333.33) < 0.01 &&
      Math.abs(simulacionConGastoFuturo.flujoLibreActual - 534_666.67) < 0.01,
    'suma la regla al flujo sin tocar el promedio histórico',
  );

  const reglaIngresoFutura = await servicio.crearRecurrencia({
    monto: 12_000,
    tipo: 'ingreso',
    fechaInicio: fechaFutura,
    descripcion: 'Consultoría semanal futura',
    categoriaId: catSalarioD.id,
    cuentaId: cuentaD.id,
    frecuencia: 'semanal',
  });
  afirmar(
    reglaIngresoFutura.generadas === 0,
    'una regla de ingreso futura tampoco genera movimientos',
  );
  const simulacionConIngresoFuturo = await servicio.simularEscenario({
    montoObjetivo: 300_000,
    meses: 6,
  });
  afirmar(
    simulacionConIngresoFuturo.ingresoRecurrenteMensual === 52_000 &&
      simulacionConIngresoFuturo.ingresosBase === 652_000 &&
      simulacionConIngresoFuturo.recurrenciasActivas.length === 2,
    'mensualiza un ingreso semanal (×52/12) en la proyección',
  );

  const reglaGastoPasada = await servicio.crearRecurrencia({
    monto: 5_000,
    tipo: 'gasto',
    fechaInicio: fechaDeMes(-2, 1),
    descripcion: 'Streaming mensual',
    categoriaId: catStreamingD.id,
    cuentaId: cuentaD.id,
    frecuencia: 'mensual',
  });
  afirmar(
    reglaGastoPasada.generadas === 3,
    'una regla pasada genera sus ocurrencias vencidas',
  );
  const simulacionSinDobleConteo = await servicio.simularEscenario({
    montoObjetivo: 300_000,
    meses: 6,
  });
  afirmar(
    simulacionSinDobleConteo.recurrenciasActivas.length === 3 &&
      simulacionSinDobleConteo.compromisoRecurrenteMensual === 25_000,
    'incluye todas las reglas activas vigentes en el compromiso',
  );
  afirmar(
    Math.abs(simulacionSinDobleConteo.gastosPromedio - 48_666.67) < 0.01,
    'el promedio real conserva los movimientos generados por la regla',
  );
  afirmar(
    Math.abs(simulacionSinDobleConteo.gastosBase - 70_333.33) < 0.01,
    'no cuenta dos veces los movimientos vinculados a reglas activas',
  );
  afirmar(
    Math.abs(simulacionSinDobleConteo.flujoLibrePromedio - 551_333.33) < 0.01,
    'el flujo histórico también refleja los movimientos recurrentes',
  );

  await esperarError(
    () =>
      servicio.simularEscenario({
        montoObjetivo: 100_000,
        meses: 6,
        categoriaRecorteId: catSalarioD.id,
        porcentajeRecorte: 10,
      }),
    'rechaza recortar una categoría de ingreso',
  );
  await esperarError(
    () =>
      servicio.simularEscenario({
        montoObjetivo: 100_000,
        meses: 6,
        categoriaRecorteId: catCafeD.id,
        porcentajeRecorte: 150,
      }),
    'rechaza un porcentaje de recorte fuera de rango',
  );
  await esperarError(
    () =>
      servicio.simularEscenario({
        montoObjetivo: 100_000,
        meses: 6,
        porcentajeRecorte: 50,
      }),
    'exige categoría cuando se pide un recorte',
  );
  await esperarError(
    () => servicio.simularEscenario({ montoObjetivo: 0, meses: 6 }),
    'rechaza un monto objetivo en cero',
  );
  await esperarError(
    () => servicio.simularEscenario({ montoObjetivo: 100_000, meses: 0 }),
    'rechaza una cantidad de meses en cero',
  );

  await servicio.cerrarSesion();
  await esperarError(
    () => servicio.analizarGastosHormiga(),
    'exige sesión para analizar gastos hormiga',
  );
  await esperarError(
    () =>
      servicio.simularEscenario({ montoObjetivo: 100_000, meses: 1 }),
    'exige sesión para simular escenarios',
  );

  console.log(`\n${pruebas} verificaciones correctas.`);
} finally {
  await db.delete();
  await servidor.close();
}
