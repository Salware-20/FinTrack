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

  console.log(`\n${pruebas} verificaciones correctas.`);
} finally {
  await db.delete();
  await servidor.close();
}
