import { CONFIG_APP } from '../config/app';
import { baseDatos, BaseDatosFinanzas } from '../db/baseDatos';
import type { RegistroConfiguracion, RegistroUsuario } from '../db/baseDatos';
import {
  crearCategoriasBase,
  crearConfiguracionInicial,
  crearCuentaInicial,
} from '../db/semilla';
import { Categoria } from '../models/Categoria';
import { Presupuesto } from '../models/Presupuesto';
import type { DatosPresupuesto } from '../models/Presupuesto';
import { Cuenta } from '../models/Cuenta';
import { ErrorValidacion } from '../models/errores';
import { Recurrencia } from '../models/Recurrencia';
import type { DatosRecurrencia } from '../models/Recurrencia';
import { Transaccion } from '../models/Transaccion';
import type { DatosTransaccion } from '../models/Transaccion';
import { Transferencia } from '../models/Transferencia';
import { Usuario } from '../models/Usuario';
import {
  EstadoAlertaPresupuesto,
  EstadoTransaccion,
  OrdenTransacciones,
  TipoTransaccion,
} from '../models/tipos';
import type {
  AlertaConcentracionGasto,
  CambiosPresupuesto,
  CambiosRecurrencia,
  ConfiguracionUsuario,
  EstadoPresupuesto,
  EstadoResultados,
  FiltroTransacciones,
  NuevaCategoria,
  NuevaCuenta,
  NuevaRecurrencia,
  NuevaTransaccion,
  NuevaTransferencia,
  NuevoPresupuesto,
  NuevoUsuario,
  ResumenFinanciero,
  ResumenMensual,
  ResumenPorCategoria,
  ResultadoCreacionRecurrencia,
  ResultadoRecuperacion,
  ResultadoRegistro,
  SaldoCuenta,
  TipoTransaccion as TipoTransaccionType,
} from '../models/tipos';
import {
  derivarHash,
  generarCodigoRecuperacion,
  generarSal,
  normalizarCodigoRecuperacion,
  normalizarCorreo,
  verificarHash,
} from '../utils/criptografia';
import { redondearMonto, sumarMontos } from '../utils/numeros';
import { fechaHoy } from '../utils/formato';
import { planificarOcurrencias } from '../utils/recurrencia';
import type { FinanzasService, RespaldoFinanzas } from './FinanzasService';

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarTexto(valor: string): string {
  return valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function mapearUsuario(registro: RegistroUsuario): Usuario {
  return new Usuario({
    id: registro.id,
    nombre: registro.nombre,
    correo: registro.correo,
    creadoEn: registro.creadoEn,
    ultimoAcceso: registro.ultimoAcceso,
  });
}

function escaparCsv(valor: string | number): string {
  const texto = String(valor ?? '');
  return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Implementación local-first sobre IndexedDB.
 *
 * - Todo dato financiero lleva `usuarioId` y se filtra por la sesión activa.
 * - La sesión guarda solo el id del usuario en `sessionStorage`.
 * - Los saldos nunca se almacenan: se calculan con movimientos confirmados.
 * - Las credenciales se guardan como hash PBKDF2 con sal individual.
 */
export class LocalFinanzasService implements FinanzasService {
  private readonly db: BaseDatosFinanzas;
  private usuarioIdSesion: string | null = null;
  private intentosFallidos = new Map<string, number>();

  constructor(db: BaseDatosFinanzas = baseDatos) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Sesión y cuenta
  // ---------------------------------------------------------------------------

  async registrar(datos: NuevoUsuario): Promise<ResultadoRegistro> {
    const nombre = datos.nombre ? datos.nombre.trim() : '';
    const correo = normalizarCorreo(datos.correo ?? '');
    const contrasena = datos.contrasena ?? '';

    if (!nombre) {
      throw new ErrorValidacion('El nombre es obligatorio.', 'nombre');
    }
    if (!PATRON_CORREO.test(correo)) {
      throw new ErrorValidacion('El correo no es válido.', 'correo');
    }
    this.validarContrasena(contrasena);

    const existente = await this.db.usuarios.where('correo').equals(correo).first();
    if (existente) {
      throw new ErrorValidacion('Ya existe una cuenta con ese correo.', 'correo');
    }

    const sal = generarSal();
    const hashContrasena = await derivarHash(contrasena, sal);
    const salRecuperacion = generarSal();
    const codigoRecuperacion = generarCodigoRecuperacion();
    const hashRecuperacion = await derivarHash(
      normalizarCodigoRecuperacion(codigoRecuperacion),
      salRecuperacion,
    );

    const ahora = new Date().toISOString();
    const registro: RegistroUsuario = {
      id: `usr-${crypto.randomUUID()}`,
      nombre,
      correo,
      hashContrasena,
      sal,
      hashRecuperacion,
      salRecuperacion,
      creadoEn: ahora,
      ultimoAcceso: ahora,
    };

    await this.db.transaction(
      'rw',
      [this.db.usuarios, this.db.categorias, this.db.cuentas, this.db.configuracion],
      async () => {
        await this.db.usuarios.add(registro);
        await this.db.categorias.bulkAdd(crearCategoriasBase(registro.id));
        await this.db.cuentas.add(crearCuentaInicial(registro.id));
        await this.db.configuracion.add(crearConfiguracionInicial(registro.id));
      },
    );

    this.guardarSesion(registro.id);
    return { usuario: mapearUsuario(registro), codigoRecuperacion };
  }

  async iniciarSesion(correo: string, contrasena: string): Promise<Usuario> {
    const correoNormalizado = normalizarCorreo(correo);
    const claveIntentos = `login:${correoNormalizado}`;

    await this.aplicarEspera(claveIntentos);

    const registro = await this.db.usuarios
      .where('correo')
      .equals(correoNormalizado)
      .first();

    const esValida = registro
      ? await verificarHash(contrasena, registro.sal, registro.hashContrasena)
      : false;

    if (!registro || !esValida) {
      this.registrarFallo(claveIntentos);
      throw new ErrorValidacion('Correo o contraseña incorrectos.', 'contrasena');
    }

    this.limpiarFallos(claveIntentos);
    const actualizado: RegistroUsuario = {
      ...registro,
      ultimoAcceso: new Date().toISOString(),
    };
    await this.db.usuarios.put(actualizado);
    this.guardarSesion(registro.id);
    return mapearUsuario(actualizado);
  }

  async cerrarSesion(): Promise<void> {
    this.limpiarSesion();
  }

  async usuarioActual(): Promise<Usuario | null> {
    const id = this.leerSesionId();
    if (!id) return null;

    const registro = await this.db.usuarios.get(id);
    if (!registro) {
      this.limpiarSesion();
      return null;
    }

    return mapearUsuario(registro);
  }

  async cambiarContrasena(actual: string, nueva: string): Promise<void> {
    const sesion = await this.requerirSesion();
    const esValida = await verificarHash(actual, sesion.sal, sesion.hashContrasena);
    if (!esValida) {
      throw new ErrorValidacion('La contraseña actual no es correcta.', 'actual');
    }

    this.validarContrasena(nueva);
    const sal = generarSal();
    const hashContrasena = await derivarHash(nueva, sal);

    await this.db.usuarios.put({ ...sesion, sal, hashContrasena });
  }

  async recuperarContrasena(
    correo: string,
    codigo: string,
    nueva: string,
  ): Promise<ResultadoRecuperacion> {
    const correoNormalizado = normalizarCorreo(correo);
    const claveIntentos = `recuperacion:${correoNormalizado}`;

    await this.aplicarEspera(claveIntentos);

    const registro = await this.db.usuarios
      .where('correo')
      .equals(correoNormalizado)
      .first();

    const esValido = registro
      ? await verificarHash(
          normalizarCodigoRecuperacion(codigo),
          registro.salRecuperacion,
          registro.hashRecuperacion,
        )
      : false;

    if (!registro || !esValido) {
      this.registrarFallo(claveIntentos);
      throw new ErrorValidacion(
        'El correo o el código de recuperación no son válidos.',
        'codigo',
      );
    }

    this.validarContrasena(nueva);
    this.limpiarFallos(claveIntentos);

    const sal = generarSal();
    const hashContrasena = await derivarHash(nueva, sal);
    const salRecuperacion = generarSal();
    const codigoRecuperacion = generarCodigoRecuperacion();
    const hashRecuperacion = await derivarHash(
      normalizarCodigoRecuperacion(codigoRecuperacion),
      salRecuperacion,
    );

    const actualizado: RegistroUsuario = {
      ...registro,
      sal,
      hashContrasena,
      salRecuperacion,
      hashRecuperacion,
    };
    await this.db.usuarios.put(actualizado);

    return { usuario: mapearUsuario(actualizado), codigoRecuperacion };
  }

  async eliminarCuenta(contrasena: string): Promise<void> {
    const sesion = await this.requerirSesion();
    const esValida = await verificarHash(
      contrasena,
      sesion.sal,
      sesion.hashContrasena,
    );
    if (!esValida) {
      throw new ErrorValidacion('La contraseña no es correcta.', 'contrasena');
    }

    await this.db.transaction(
      'rw',
      [
        this.db.usuarios,
        this.db.cuentas,
        this.db.categorias,
        this.db.transacciones,
        this.db.transferencias,
        this.db.recurrencias,
        this.db.presupuestos,
        this.db.configuracion,
      ],
      async () => {
        await this.db.transacciones.where('usuarioId').equals(sesion.id).delete();
        await this.db.transferencias.where('usuarioId').equals(sesion.id).delete();
        await this.db.recurrencias.where('usuarioId').equals(sesion.id).delete();
        await this.db.presupuestos.where('usuarioId').equals(sesion.id).delete();
        await this.db.cuentas.where('usuarioId').equals(sesion.id).delete();
        await this.db.categorias.where('usuarioId').equals(sesion.id).delete();
        await this.db.configuracion.delete(sesion.id);
        await this.db.usuarios.delete(sesion.id);
      },
    );

    this.limpiarSesion();
  }

  async obtenerConfiguracion(): Promise<ConfiguracionUsuario> {
    const sesion = await this.requerirSesion();
    return this.configuracionDe(sesion.id);
  }

  async actualizarConfiguracion(
    cambios: Partial<ConfiguracionUsuario>,
  ): Promise<ConfiguracionUsuario> {
    const sesion = await this.requerirSesion();
    const actual = await this.configuracionDe(sesion.id);
    const actualizada: ConfiguracionUsuario = { ...actual, ...cambios, usuarioId: sesion.id };
    await this.db.configuracion.put(actualizada);
    return actualizada;
  }

  // ---------------------------------------------------------------------------
  // Cuentas
  // ---------------------------------------------------------------------------

  async listarCuentas(): Promise<Cuenta[]> {
    const sesion = await this.requerirSesion();
    const registros = await this.db.cuentas
      .where('usuarioId')
      .equals(sesion.id)
      .toArray();

    return registros
      .map((registro) => Cuenta.desdeJSON(registro))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async crearCuenta(datos: NuevaCuenta): Promise<Cuenta> {
    const sesion = await this.requerirSesion();
    const configuracion = await this.configuracionDe(sesion.id);
    const existentes = await this.db.cuentas
      .where('usuarioId')
      .equals(sesion.id)
      .toArray();
    const nombre = datos.nombre ? datos.nombre.trim() : '';

    if (!nombre) {
      throw new ErrorValidacion('El nombre de la cuenta es obligatorio.', 'nombre');
    }
    if (
      existentes.some(
        (cuenta) => normalizarTexto(cuenta.nombre) === normalizarTexto(nombre),
      )
    ) {
      throw new ErrorValidacion(
        `Ya existe una cuenta llamada "${nombre}".`,
        'nombre',
      );
    }

    const cuenta = Cuenta.crear(
      { ...datos, nombre },
      sesion.id,
      configuracion.moneda,
    );
    await this.db.cuentas.add(cuenta.toJSON());
    return cuenta;
  }

  async actualizarCuenta(
    id: string,
    cambios: Partial<NuevaCuenta> & { activa?: boolean },
  ): Promise<Cuenta> {
    const sesion = await this.requerirSesion();
    const registro = await this.db.cuentas.get(id);

    if (!registro || registro.usuarioId !== sesion.id) {
      throw new ErrorValidacion('No existe la cuenta indicada.', 'id');
    }

    const limpio: Partial<typeof registro> = {};
    if (cambios.nombre !== undefined) limpio.nombre = cambios.nombre.trim();
    if (cambios.saldoInicial !== undefined) limpio.saldoInicial = cambios.saldoInicial;
    if (cambios.institucion !== undefined) limpio.institucion = cambios.institucion;
    if (cambios.color !== undefined) limpio.color = cambios.color;
    if (cambios.icono !== undefined) limpio.icono = cambios.icono;
    if (cambios.activa !== undefined) limpio.activa = cambios.activa;

    const actualizada = new Cuenta({ ...registro, ...limpio });

    if (actualizada.nombre !== registro.nombre) {
      const hermanas = await this.db.cuentas
        .where('usuarioId')
        .equals(sesion.id)
        .toArray();
      const duplicada = hermanas.some(
        (cuenta) =>
          cuenta.id !== id &&
          normalizarTexto(cuenta.nombre) === normalizarTexto(actualizada.nombre),
      );
      if (duplicada) {
        throw new ErrorValidacion(
          `Ya existe una cuenta llamada "${actualizada.nombre}".`,
          'nombre',
        );
      }
    }

    await this.db.cuentas.put(actualizada.toJSON());

    // Una cuenta archivada no admite movimientos nuevos: sus reglas se pausan
    // para no acumular ocurrencias que luego no podrían aplicarse.
    if (!actualizada.activa) {
      await this.db.recurrencias
        .where('usuarioId')
        .equals(sesion.id)
        .filter(
          (recurrencia) => recurrencia.cuentaId === id && recurrencia.activa,
        )
        .modify({ activa: false });
    }

    return actualizada;
  }

  async transferir(datos: NuevaTransferencia): Promise<Transferencia> {
    const sesion = await this.requerirSesion();
    const origen = await this.db.cuentas.get(datos.cuentaOrigenId);
    const destino = await this.db.cuentas.get(datos.cuentaDestinoId);

    if (!origen || origen.usuarioId !== sesion.id) {
      throw new ErrorValidacion(
        'La cuenta de origen no existe o no le pertenece.',
        'cuentaOrigenId',
      );
    }
    if (!destino || destino.usuarioId !== sesion.id) {
      throw new ErrorValidacion(
        'La cuenta de destino no existe o no le pertenece.',
        'cuentaDestinoId',
      );
    }

    const transferencia = Transferencia.crear(datos, sesion.id);
    await this.db.transferencias.add(transferencia.toJSON());
    return transferencia;
  }

  async obtenerSaldos(): Promise<SaldoCuenta[]> {
    const sesion = await this.requerirSesion();
    const [cuentas, transacciones, transferencias] = await Promise.all([
      this.db.cuentas.where('usuarioId').equals(sesion.id).toArray(),
      this.db.transacciones.where('usuarioId').equals(sesion.id).toArray(),
      this.db.transferencias.where('usuarioId').equals(sesion.id).toArray(),
    ]);

    const saldos = new Map<string, number>();
    for (const cuenta of cuentas) {
      saldos.set(cuenta.id, cuenta.saldoInicial);
    }

    for (const transaccion of transacciones) {
      if (transaccion.estado !== EstadoTransaccion.Confirmado) continue;
      const actual = saldos.get(transaccion.cuentaId) ?? 0;
      const signo = transaccion.tipo === TipoTransaccion.Ingreso ? 1 : -1;
      saldos.set(transaccion.cuentaId, actual + signo * transaccion.monto);
    }

    for (const transferencia of transferencias) {
      saldos.set(
        transferencia.cuentaOrigenId,
        (saldos.get(transferencia.cuentaOrigenId) ?? 0) - transferencia.monto,
      );
      saldos.set(
        transferencia.cuentaDestinoId,
        (saldos.get(transferencia.cuentaDestinoId) ?? 0) + transferencia.monto,
      );
    }

    return cuentas
      .map((cuenta) => ({
        cuentaId: cuenta.id,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
        color: cuenta.color,
        icono: cuenta.icono,
        activa: cuenta.activa,
        saldo: redondearMonto(saldos.get(cuenta.id) ?? cuenta.saldoInicial),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  // ---------------------------------------------------------------------------
  // Categorías
  // ---------------------------------------------------------------------------

  async listarCategorias(tipo?: TipoTransaccionType): Promise<Categoria[]> {
    const sesion = await this.requerirSesion();
    const registros = await this.db.categorias
      .where('usuarioId')
      .equals(sesion.id)
      .toArray();

    return registros
      .filter((categoria) => !tipo || categoria.tipo === tipo)
      .map((categoria) => Categoria.desdeJSON(categoria))
      .sort(
        (a, b) =>
          a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre),
      );
  }

  async crearCategoria(datos: NuevaCategoria): Promise<Categoria> {
    const sesion = await this.requerirSesion();
    const nombre = datos.nombre ? datos.nombre.trim() : '';

    if (!nombre) {
      throw new ErrorValidacion('El nombre de la categoría es obligatorio.', 'nombre');
    }

    let padreId: string | null = null;
    if (datos.padreId) {
      const padre = await this.db.categorias.get(datos.padreId);
      if (!padre || padre.usuarioId !== sesion.id) {
        throw new ErrorValidacion('La categoría padre no existe.', 'padreId');
      }
      if (padre.tipo !== datos.tipo) {
        throw new ErrorValidacion(
          'La subcategoría debe ser del mismo tipo que su padre.',
          'padreId',
        );
      }
      padreId = padre.id;
    }

    const hermanas = await this.db.categorias
      .where('usuarioId')
      .equals(sesion.id)
      .toArray();
    const duplicada = hermanas.some(
      (categoria) =>
        categoria.tipo === datos.tipo &&
        (categoria.padreId ?? null) === padreId &&
        normalizarTexto(categoria.nombre) === normalizarTexto(nombre),
    );
    if (duplicada) {
      throw new ErrorValidacion(
        `Ya existe una categoría llamada "${nombre}" en ese nivel.`,
        'nombre',
      );
    }

    const categoria = Categoria.crear({ ...datos, nombre, padreId }, sesion.id);
    await this.db.categorias.add(categoria.toJSON());
    return categoria;
  }

  // ---------------------------------------------------------------------------
  // Transacciones
  // ---------------------------------------------------------------------------

  async listarTransacciones(
    filtro: FiltroTransacciones = {},
  ): Promise<Transaccion[]> {
    const sesion = await this.requerirSesion();
    const contexto = await this.contextoConsulta(sesion.id);
    const filtradas = contexto.transacciones.filter((transaccion) =>
      this.cumpleFiltro(transaccion, filtro, contexto),
    );

    return this.ordenar(filtradas, filtro.orden).map((transaccion) =>
      Transaccion.desdeJSON(transaccion.toJSON()),
    );
  }

  async obtenerTransaccion(id: string): Promise<Transaccion | null> {
    const sesion = await this.requerirSesion();
    const registro = await this.db.transacciones.get(id);

    if (!registro || registro.usuarioId !== sesion.id) return null;
    return Transaccion.desdeJSON(registro);
  }

  async crearTransaccion(datos: NuevaTransaccion): Promise<Transaccion> {
    const sesion = await this.requerirSesion();
    await this.validarReferencias(sesion.id, datos.cuentaId, datos.categoriaId, datos.tipo);

    const transaccion = Transaccion.crear(datos, sesion.id);
    await this.db.transacciones.add(transaccion.toJSON());
    return transaccion;
  }

  async actualizarTransaccion(
    id: string,
    cambios: Partial<NuevaTransaccion>,
  ): Promise<Transaccion> {
    const sesion = await this.requerirSesion();
    const registro = await this.db.transacciones.get(id);

    if (!registro || registro.usuarioId !== sesion.id) {
      throw new ErrorValidacion(`No existe una transacción con id "${id}".`, 'id');
    }

    const transaccion = Transaccion.desdeJSON(registro);
    const cuentaId = cambios.cuentaId ?? transaccion.cuentaId;
    const categoriaId = cambios.categoriaId ?? transaccion.categoriaId;
    const tipo = cambios.tipo ?? transaccion.tipo;
    await this.validarReferencias(sesion.id, cuentaId, categoriaId, tipo);

    transaccion.actualizar(cambios as Partial<DatosTransaccion>);
    await this.db.transacciones.put(transaccion.toJSON());
    return transaccion;
  }

  async eliminarTransaccion(id: string): Promise<void> {
    const sesion = await this.requerirSesion();
    const registro = await this.db.transacciones.get(id);

    if (!registro || registro.usuarioId !== sesion.id) {
      throw new ErrorValidacion(`No existe una transacción con id "${id}".`, 'id');
    }

    await this.db.transacciones.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Recurrencias
  // ---------------------------------------------------------------------------

  async listarRecurrencias(): Promise<Recurrencia[]> {
    const sesion = await this.requerirSesion();
    const registros = await this.db.recurrencias
      .where('usuarioId')
      .equals(sesion.id)
      .toArray();

    return registros
      .map((registro) => Recurrencia.desdeJSON(registro))
      .sort(
        (a, b) =>
          Number(b.activa) - Number(a.activa) ||
          a.proximaFecha.localeCompare(b.proximaFecha),
      );
  }

  async crearRecurrencia(
    datos: NuevaRecurrencia,
  ): Promise<ResultadoCreacionRecurrencia> {
    const sesion = await this.requerirSesion();
    await this.validarReferencias(
      sesion.id,
      datos.cuentaId,
      datos.categoriaId,
      datos.tipo,
    );

    const recurrencia = Recurrencia.crear(datos, sesion.id);
    await this.db.recurrencias.add(recurrencia.toJSON());

    const generadas = await this.procesarRecurrenciasDe(
      sesion.id,
      recurrencia.id,
    );
    const registro = await this.db.recurrencias.get(recurrencia.id);

    return {
      recurrencia: Recurrencia.desdeJSON(registro ?? recurrencia.toJSON()),
      generadas,
    };
  }

  async actualizarRecurrencia(
    id: string,
    cambios: CambiosRecurrencia,
  ): Promise<Recurrencia> {
    const sesion = await this.requerirSesion();
    const registro = await this.db.recurrencias.get(id);

    if (!registro || registro.usuarioId !== sesion.id) {
      throw new ErrorValidacion(`No existe la recurrencia "${id}".`, 'id');
    }

    const recurrencia = Recurrencia.desdeJSON(registro);
    recurrencia.actualizar(cambios);
    await this.db.recurrencias.put(recurrencia.toJSON());

    // Al reanudar se recuperan las ocurrencias vencidas durante la pausa.
    if (recurrencia.activa) {
      await this.procesarRecurrenciasDe(sesion.id, id);
    }

    const actualizado = await this.db.recurrencias.get(id);
    return Recurrencia.desdeJSON(actualizado ?? recurrencia.toJSON());
  }

  async eliminarRecurrencia(id: string): Promise<void> {
    const sesion = await this.requerirSesion();
    const registro = await this.db.recurrencias.get(id);

    if (!registro || registro.usuarioId !== sesion.id) {
      throw new ErrorValidacion(`No existe la recurrencia "${id}".`, 'id');
    }

    // Las transacciones ya generadas se conservan: son historial real.
    await this.db.recurrencias.delete(id);
  }

  async procesarRecurrencias(): Promise<number> {
    const sesion = await this.requerirSesion();
    return this.procesarRecurrenciasDe(sesion.id);
  }

  /** Periodo mensual actual en formato AAAA-MM. */
  private periodoActual(): string {
    return fechaHoy().slice(0, 7);
  }

  // ---------------------------------------------------------------------------
  // Presupuestos
  // ---------------------------------------------------------------------------

  async listarPresupuestos(): Promise<Presupuesto[]> {
    const sesion = await this.requerirSesion();
    const registros = await this.db.presupuestos
      .where('usuarioId')
      .equals(sesion.id)
      .toArray();
    return registros.map((registro) => Presupuesto.desdeJSON(registro));
  }

  async crearPresupuesto(datos: NuevoPresupuesto): Promise<Presupuesto> {
    const sesion = await this.requerirSesion();

    const categoria = await this.db.categorias.get(datos.categoriaId);
    if (!categoria || categoria.usuarioId !== sesion.id) {
      throw new ErrorValidacion('La categoria no existe o no le pertenece.', 'categoriaId');
    }
    if (categoria.tipo !== TipoTransaccion.Gasto) {
      throw new ErrorValidacion(
        'Solo se pueden crear presupuestos para categorias de tipo gasto.',
        'categoriaId',
      );
    }

    // No se permite duplicado activo para la misma categoria
    const existente = await this.db.presupuestos
      .where('usuarioId')
      .equals(sesion.id)
      .filter(
        (presupuesto) =>
          presupuesto.categoriaId === datos.categoriaId && presupuesto.activo,
      )
      .first();
    if (existente) {
      throw new ErrorValidacion(
        'Ya existe un presupuesto activo para esta categoria.',
        'categoriaId',
      );
    }

    const presupuesto = Presupuesto.crear(datos, sesion.id);
    await this.db.presupuestos.add(presupuesto.toJSON());
    return presupuesto;
  }

  async actualizarPresupuesto(
    id: string,
    cambios: CambiosPresupuesto,
  ): Promise<Presupuesto> {
    const sesion = await this.requerirSesion();
    const registro = await this.db.presupuestos.get(id);

    if (!registro || registro.usuarioId !== sesion.id) {
      throw new ErrorValidacion('No existe el presupuesto indicado.', 'id');
    }

    const presupuesto = Presupuesto.desdeJSON(registro);
    presupuesto.actualizar(cambios);
    await this.db.presupuestos.put(presupuesto.toJSON());
    return presupuesto;
  }

  async eliminarPresupuesto(id: string): Promise<void> {
    const sesion = await this.requerirSesion();
    const registro = await this.db.presupuestos.get(id);

    if (!registro || registro.usuarioId !== sesion.id) {
      throw new ErrorValidacion('No existe el presupuesto indicado.', 'id');
    }

    await this.db.presupuestos.delete(id);
  }

  async obtenerEstadoPresupuestos(periodo?: string): Promise<EstadoPresupuesto[]> {
    const sesion = await this.requerirSesion();
    const mes = periodo ?? this.periodoActual();

    const [presupuestos, categorias, transacciones] = await Promise.all([
      this.db.presupuestos.where('usuarioId').equals(sesion.id).toArray(),
      this.db.categorias.where('usuarioId').equals(sesion.id).toArray(),
      this.db.transacciones.where('usuarioId').equals(sesion.id).toArray(),
    ]);

    const categoriasActivos = presupuestos.filter(
      (p) => p.activo && (p.periodo === null || p.periodo === mes),
    );

    // Mapa de categoria -> categoriaRaiz para detectar subcategorias
    const categoriasPorId = new Map(categorias.map((c) => [c.id, c]));

    // Funcion: dado un categoriaId raiz, devuelve ese id mas todos sus descendientes
    const descendientes = (raizId: string): Set<string> => {
      const resultado = new Set<string>();
      const pila = [raizId];
      while (pila.length > 0) {
        const actual = pila.pop() as string;
        resultado.add(actual);
        for (const c of categorias) {
          if (c.padreId === actual && !resultado.has(c.id)) {
            pila.push(c.id);
          }
        }
      }
      return resultado;
    };

    // Gastos confirmados del mes
    const desdeMes = `${mes}-01`;
    const hastaMes = `${mes}-31`;
    const gastosDelMes = transacciones.filter(
      (t) =>
        t.tipo === TipoTransaccion.Gasto &&
        t.estado === EstadoTransaccion.Confirmado &&
        t.fecha >= desdeMes &&
        t.fecha <= hastaMes,
    );

    return categoriasActivos.map((presupuesto) => {
      const idsAfectos = descendientes(presupuesto.categoriaId);
      const montoGastado = redondearMonto(
        gastosDelMes
          .filter((t) => idsAfectos.has(t.categoriaId))
          .reduce((suma, t) => suma + t.monto, 0),
      );
      const porcentajeConsumido = redondearMonto(
        presupuesto.montoLimite === 0
          ? 0
          : (montoGastado / presupuesto.montoLimite) * 100,
      );
      const montoDisponible = redondearMonto(presupuesto.montoLimite - montoGastado);
      const categoria = categoriasPorId.get(presupuesto.categoriaId);

      let estadoAlerta: EstadoAlertaPresupuesto;
      if (porcentajeConsumido >= 100) {
        estadoAlerta = EstadoAlertaPresupuesto.Excedido;
      } else if (porcentajeConsumido >= presupuesto.alertaPorcentaje) {
        estadoAlerta = EstadoAlertaPresupuesto.Advertencia;
      } else {
        estadoAlerta = EstadoAlertaPresupuesto.Normal;
      }

      return {
        presupuestoId: presupuesto.id,
        categoriaId: presupuesto.categoriaId,
        categoriaNombre: categoria?.nombre ?? presupuesto.categoriaId,
        montoLimite: presupuesto.montoLimite,
        montoGastado,
        montoDisponible,
        porcentajeConsumido,
        estadoAlerta,
      };
    });
  }

  async obtenerAlertasConcentracion(
    periodo?: string,
    umbral = 30,
  ): Promise<AlertaConcentracionGasto[]> {
    const sesion = await this.requerirSesion();
    const mes = periodo ?? this.periodoActual();

    const [categorias, transacciones] = await Promise.all([
      this.db.categorias.where('usuarioId').equals(sesion.id).toArray(),
      this.db.transacciones.where('usuarioId').equals(sesion.id).toArray(),
    ]);

    const desdeMes = `${mes}-01`;
    const hastaMes = `${mes}-31`;
    const gastosDelMes = transacciones.filter(
      (t) =>
        t.tipo === TipoTransaccion.Gasto &&
        t.estado === EstadoTransaccion.Confirmado &&
        t.fecha >= desdeMes &&
        t.fecha <= hastaMes,
    );

    const totalGastos = redondearMonto(
      gastosDelMes.reduce((suma, t) => suma + t.monto, 0),
    );
    if (totalGastos === 0) return [];

    // Acumular por categoria raiz (si la transaccion es en una subcategoria,
    // se imputa a la raiz para la alerta de concentracion)
    const categoriasPorId = new Map(categorias.map((c) => [c.id, c]));

    const raizDe = (categoriaId: string): string => {
      let cat = categoriasPorId.get(categoriaId);
      while (cat?.padreId) {
        cat = categoriasPorId.get(cat.padreId);
      }
      return cat?.id ?? categoriaId;
    };

    const acumuladosPorRaiz = new Map<string, number>();
    for (const t of gastosDelMes) {
      const raiz = raizDe(t.categoriaId);
      acumuladosPorRaiz.set(raiz, (acumuladosPorRaiz.get(raiz) ?? 0) + t.monto);
    }

    const alertas: AlertaConcentracionGasto[] = [];
    for (const [categoriaId, montoGastado] of acumuladosPorRaiz.entries()) {
      const porcentajeDelTotal = redondearMonto((montoGastado / totalGastos) * 100);
      if (porcentajeDelTotal >= umbral) {
        const categoria = categoriasPorId.get(categoriaId);
        alertas.push({
          categoriaId,
          categoriaNombre: categoria?.nombre ?? categoriaId,
          montoGastado: redondearMonto(montoGastado),
          porcentajeDelTotal,
          umbral,
        });
      }
    }

    return alertas.sort((a, b) => b.porcentajeDelTotal - a.porcentajeDelTotal);
  }
  // ---------------------------------------------------------------------------
  // Reportes
  // ---------------------------------------------------------------------------

  async obtenerResumen(
    filtro: FiltroTransacciones = {},
  ): Promise<ResumenFinanciero> {
    const sesion = await this.requerirSesion();
    const contexto = await this.contextoConsulta(sesion.id);
    const transacciones = contexto.transacciones
      .filter((transaccion) => transaccion.estado === EstadoTransaccion.Confirmado)
      .filter((transaccion) => this.cumpleFiltro(transaccion, filtro, contexto));

    const ingresos = transacciones.filter((transaccion) => transaccion.esIngreso);
    const gastos = transacciones.filter((transaccion) => !transaccion.esIngreso);
    const totalIngresos = sumarMontos(ingresos.map((item) => item.monto));
    const totalGastos = sumarMontos(gastos.map((item) => item.monto));
    const fechas = transacciones.map((item) => item.fecha).sort();

    return {
      totalIngresos,
      totalGastos,
      balance: redondearMonto(totalIngresos - totalGastos),
      cantidadTransacciones: transacciones.length,
      cantidadIngresos: ingresos.length,
      cantidadGastos: gastos.length,
      promedioIngreso:
        ingresos.length === 0 ? 0 : redondearMonto(totalIngresos / ingresos.length),
      promedioGasto:
        gastos.length === 0 ? 0 : redondearMonto(totalGastos / gastos.length),
      porCategoria: this.agruparPorCategoria(
        transacciones,
        contexto.categorias,
        totalIngresos,
        totalGastos,
      ),
      porMes: this.agruparPorMes(transacciones),
      rango: {
        desde: fechas.length > 0 ? fechas[0] : null,
        hasta: fechas.length > 0 ? fechas[fechas.length - 1] : null,
      },
    };
  }

  async obtenerEstadoResultados(
    desde: string,
    hasta: string,
  ): Promise<EstadoResultados> {
    const resumen = await this.obtenerResumen({ desde, hasta });

    return {
      desde,
      hasta,
      totalIngresos: resumen.totalIngresos,
      totalGastos: resumen.totalGastos,
      utilidad: resumen.balance,
      filas: resumen.porCategoria.map((categoria) => ({
        categoriaId: categoria.categoriaId,
        nombre: categoria.nombre,
        tipo: categoria.tipo,
        total: categoria.total,
      })),
    };
  }

  async obtenerFlujoCaja(
    desde: string,
    hasta: string,
  ): Promise<ResumenMensual[]> {
    const resumen = await this.obtenerResumen({ desde, hasta });
    return resumen.porMes;
  }

  // ---------------------------------------------------------------------------
  // Datos
  // ---------------------------------------------------------------------------

  async exportarRespaldo(): Promise<RespaldoFinanzas> {
    const sesion = await this.requerirSesion();
    const [
      cuentas,
      categorias,
      transacciones,
      transferencias,
      recurrencias,
      presupuestos,
      configuracion,
    ] = await Promise.all([
      this.db.cuentas.where('usuarioId').equals(sesion.id).toArray(),
      this.db.categorias.where('usuarioId').equals(sesion.id).toArray(),
      this.db.transacciones.where('usuarioId').equals(sesion.id).toArray(),
      this.db.transferencias.where('usuarioId').equals(sesion.id).toArray(),
      this.db.recurrencias.where('usuarioId').equals(sesion.id).toArray(),
      this.db.presupuestos.where('usuarioId').equals(sesion.id).toArray(),
      this.configuracionDe(sesion.id),
    ]);

    return {
      version: CONFIG_APP.versionBaseDatos,
      exportadoEn: new Date().toISOString(),
      usuario: mapearUsuario(sesion).toJSON(),
      cuentas,
      categorias,
      transacciones,
      transferencias,
      recurrencias,
      presupuestos,
      configuracion,
    };
  }

  async importarRespaldo(respaldo: RespaldoFinanzas): Promise<void> {
    const sesion = await this.requerirSesion();

    if (
      !respaldo ||
      !this.esVersionDeRespaldoValida(respaldo.version) ||
      !Array.isArray(respaldo.cuentas) ||
      !Array.isArray(respaldo.categorias) ||
      !Array.isArray(respaldo.transacciones) ||
      !Array.isArray(respaldo.transferencias)
    ) {
      throw new ErrorValidacion(
        'El archivo de respaldo no es válido o es de otra versión.',
        'respaldo',
      );
    }

    // Los respaldos v1 no incluyen reglas recurrentes: se aceptan igual y se
    // importan como una lista vacía.
    const recurrenciasRespaldo = Array.isArray(respaldo.recurrencias)
      ? respaldo.recurrencias
      : [];
    // Los respaldos v1/v2 no incluyen presupuestos: retrocompatibilidad.
    const presupuestosRespaldo: DatosPresupuesto[] = Array.isArray(respaldo.presupuestos)
      ? (respaldo.presupuestos as DatosPresupuesto[])
      : [];

    try {
      // Los respaldos conservan los ids del usuario que los generó. Al importar
      // en otra cuenta (que convive en la misma base) hay que regenerarlos y
      // remapear todas las referencias para no chocar con los datos existentes.
      const mapaCuentas = new Map<string, string>();
      for (const cuenta of respaldo.cuentas) {
        mapaCuentas.set(cuenta.id, `cta-${crypto.randomUUID()}`);
      }

      const mapaCategorias = new Map<string, string>();
      for (const categoria of respaldo.categorias) {
        mapaCategorias.set(categoria.id, `cat-${crypto.randomUUID()}`);
      }

      const mapaRecurrencias = new Map<string, string>();
      for (const recurrencia of recurrenciasRespaldo) {
        mapaRecurrencias.set(recurrencia.id, `rec-${crypto.randomUUID()}`);
      }

      const mapaPresupuestos = new Map<string, string>();
      for (const presupuesto of presupuestosRespaldo) {
        mapaPresupuestos.set(presupuesto.id, `pre-${crypto.randomUUID()}`);
      }

      const cuentas = respaldo.cuentas.map((cuenta) =>
        Cuenta.desdeJSON({
          ...cuenta,
          id: mapaCuentas.get(cuenta.id) as string,
          usuarioId: sesion.id,
        }),
      );

      const categorias = respaldo.categorias.map((categoria) => {
        const padreId = categoria.padreId
          ? mapaCategorias.get(categoria.padreId)
          : null;
        if (categoria.padreId && !padreId) {
          throw new ErrorValidacion(
            'El respaldo hace referencia a una categoría padre inexistente.',
            'respaldo',
          );
        }

        return Categoria.desdeJSON({
          ...categoria,
          id: mapaCategorias.get(categoria.id) as string,
          usuarioId: sesion.id,
          padreId: padreId ?? null,
        });
      });

      const tiposDeCategoria = new Map(
        respaldo.categorias.map((categoria) => [categoria.id, categoria.tipo]),
      );

      const recurrencias = recurrenciasRespaldo.map((recurrencia) => {
        const cuentaId = mapaCuentas.get(recurrencia.cuentaId);
        const categoriaId = mapaCategorias.get(recurrencia.categoriaId);
        if (!cuentaId || !categoriaId) {
          throw new ErrorValidacion(
            'El respaldo tiene reglas con cuentas o categorías inexistentes.',
            'respaldo',
          );
        }
        if (tiposDeCategoria.get(recurrencia.categoriaId) !== recurrencia.tipo) {
          throw new ErrorValidacion(
            'El respaldo tiene reglas cuya categoría no coincide con el tipo.',
            'respaldo',
          );
        }

        return Recurrencia.desdeJSON({
          ...recurrencia,
          id: mapaRecurrencias.get(recurrencia.id) as string,
          usuarioId: sesion.id,
          cuentaId,
          categoriaId,
          fechaFin: recurrencia.fechaFin ?? null,
        });
      });

      const transacciones = respaldo.transacciones.map((transaccion) => {
        const cuentaId = mapaCuentas.get(transaccion.cuentaId);
        const categoriaId = mapaCategorias.get(transaccion.categoriaId);
        if (!cuentaId || !categoriaId) {
          throw new ErrorValidacion(
            'El respaldo tiene movimientos con cuentas o categorías inexistentes.',
            'respaldo',
          );
        }
        if (tiposDeCategoria.get(transaccion.categoriaId) !== transaccion.tipo) {
          throw new ErrorValidacion(
            'El respaldo tiene movimientos cuya categoría no coincide con el tipo.',
            'respaldo',
          );
        }

        const recurrenciaId = transaccion.recurrenciaId
          ? mapaRecurrencias.get(transaccion.recurrenciaId)
          : undefined;

        return Transaccion.desdeJSON({
          ...transaccion,
          id: `trx-${crypto.randomUUID()}`,
          usuarioId: sesion.id,
          cuentaId,
          categoriaId,
          recurrenciaId,
          recurrenciaFecha: recurrenciaId
            ? transaccion.recurrenciaFecha
            : undefined,
        });
      });

      const transferencias = respaldo.transferencias.map((transferencia) => {
        const cuentaOrigenId = mapaCuentas.get(transferencia.cuentaOrigenId);
        const cuentaDestinoId = mapaCuentas.get(transferencia.cuentaDestinoId);
        if (!cuentaOrigenId || !cuentaDestinoId) {
          throw new ErrorValidacion(
            'El respaldo tiene transferencias con cuentas inexistentes.',
            'respaldo',
          );
        }

        return Transferencia.desdeJSON({
          ...transferencia,
          id: `trf-${crypto.randomUUID()}`,
          usuarioId: sesion.id,
          cuentaOrigenId,
          cuentaDestinoId,
        });
      });

      const presupuestos = presupuestosRespaldo.map((presupuesto) => {
        const categoriaId = mapaCategorias.get(presupuesto.categoriaId);
        if (!categoriaId) {
          throw new ErrorValidacion(
            'El respaldo tiene presupuestos con categorías inexistentes.',
            'respaldo',
          );
        }
        if (tiposDeCategoria.get(presupuesto.categoriaId) !== TipoTransaccion.Gasto) {
          throw new ErrorValidacion(
            'El respaldo tiene presupuestos para categorías que no son de tipo gasto.',
            'respaldo',
          );
        }

        return Presupuesto.desdeJSON({
          ...presupuesto,
          id: mapaPresupuestos.get(presupuesto.id) as string,
          usuarioId: sesion.id,
          categoriaId,
          periodo: presupuesto.periodo ?? null,
        });
      });

      const configuracion: RegistroConfiguracion = {
        ...respaldo.configuracion,
        usuarioId: sesion.id,
      };

      await this.db.transaction(
        'rw',
        [
          this.db.cuentas,
          this.db.categorias,
          this.db.transacciones,
          this.db.transferencias,
          this.db.recurrencias,
          this.db.presupuestos,
          this.db.configuracion,
        ],
        async () => {
          await this.db.transacciones.where('usuarioId').equals(sesion.id).delete();
          await this.db.transferencias.where('usuarioId').equals(sesion.id).delete();
          await this.db.recurrencias.where('usuarioId').equals(sesion.id).delete();
          await this.db.presupuestos.where('usuarioId').equals(sesion.id).delete();
          await this.db.cuentas.where('usuarioId').equals(sesion.id).delete();
          await this.db.categorias.where('usuarioId').equals(sesion.id).delete();

          await this.db.cuentas.bulkAdd(cuentas.map((cuenta) => cuenta.toJSON()));
          await this.db.categorias.bulkAdd(
            categorias.map((categoria) => categoria.toJSON()),
          );
          await this.db.transacciones.bulkAdd(
            transacciones.map((transaccion) => transaccion.toJSON()),
          );
          await this.db.transferencias.bulkAdd(
            transferencias.map((transferencia) => transferencia.toJSON()),
          );
          await this.db.recurrencias.bulkAdd(
            recurrencias.map((recurrencia) => recurrencia.toJSON()),
          );
          await this.db.presupuestos.bulkAdd(
            presupuestos.map((presupuesto) => presupuesto.toJSON()),
          );
          await this.db.configuracion.put(configuracion);
        },
      );
    } catch (fallo) {
      if (fallo instanceof ErrorValidacion) throw fallo;
      throw new ErrorValidacion(
        'El archivo de respaldo tiene datos inválidos.',
        'respaldo',
      );
    }
  }

  async exportarTransaccionesCsv(
    filtro: FiltroTransacciones = {},
  ): Promise<string> {
    const sesion = await this.requerirSesion();
    const contexto = await this.contextoConsulta(sesion.id);
    const transacciones = this.ordenar(
      contexto.transacciones.filter((transaccion) =>
        this.cumpleFiltro(transaccion, filtro, contexto),
      ),
      OrdenTransacciones.FechaAsc,
    );

    const cabecera = [
      'Fecha',
      'Tipo',
      'Descripción',
      'Categoría',
      'Cuenta',
      'Método de pago',
      'Estado',
      'Monto',
      'Etiquetas',
    ];

    const filas = transacciones.map((transaccion) => {
      const categoria = contexto.porCategoriaId.get(transaccion.categoriaId);
      const cuenta = contexto.porCuentaId.get(transaccion.cuentaId);

      return [
        transaccion.fecha,
        transaccion.esIngreso ? 'Ingreso' : 'Gasto',
        transaccion.descripcion,
        categoria ? categoria.nombreCompleto(contexto.categorias) : 'Sin categoría',
        cuenta ? cuenta.nombre : 'Sin cuenta',
        transaccion.metodoPago,
        transaccion.estado,
        transaccion.monto.toFixed(2),
        transaccion.etiquetas.join(' '),
      ]
        .map(escaparCsv)
        .join(',');
    });

    return [cabecera.join(','), ...filas].join('\r\n');
  }

  async resetearDatos(): Promise<void> {
    const sesion = await this.requerirSesion();

    await this.db.transaction(
      'rw',
      [
        this.db.cuentas,
        this.db.categorias,
        this.db.transacciones,
        this.db.transferencias,
        this.db.recurrencias,
        this.db.presupuestos,
        this.db.configuracion,
      ],
      async () => {
        await this.db.transacciones.where('usuarioId').equals(sesion.id).delete();
        await this.db.transferencias.where('usuarioId').equals(sesion.id).delete();
        await this.db.recurrencias.where('usuarioId').equals(sesion.id).delete();
        await this.db.presupuestos.where('usuarioId').equals(sesion.id).delete();
        await this.db.cuentas.where('usuarioId').equals(sesion.id).delete();
        await this.db.categorias.where('usuarioId').equals(sesion.id).delete();
        await this.db.configuracion.delete(sesion.id);

        await this.db.categorias.bulkAdd(crearCategoriasBase(sesion.id));
        await this.db.cuentas.add(crearCuentaInicial(sesion.id));
        await this.db.configuracion.add(crearConfiguracionInicial(sesion.id));
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Apoyo interno
  // ---------------------------------------------------------------------------

  /**
   * Acepta respaldos de la versión actual y anteriores. Las versiones futuras
   * podrían contener campos que esta app no sabe leer.
   */
  private esVersionDeRespaldoValida(version: number): boolean {
    return (
      Number.isInteger(version) &&
      version >= 1 &&
      version <= CONFIG_APP.versionBaseDatos
    );
  }

  private validarContrasena(contrasena: string): void {
    if (!contrasena || contrasena.length < CONFIG_APP.longitudMinimaContrasena) {
      throw new ErrorValidacion(
        `La contraseña debe tener al menos ${CONFIG_APP.longitudMinimaContrasena} caracteres.`,
        'contrasena',
      );
    }
  }

  private almacenSesion(): Storage | null {
    try {
      return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
      return null;
    }
  }

  private guardarSesion(usuarioId: string): void {
    this.usuarioIdSesion = usuarioId;
    this.almacenSesion()?.setItem(CONFIG_APP.claveSesion, usuarioId);
  }

  private leerSesionId(): string | null {
    if (this.usuarioIdSesion) return this.usuarioIdSesion;

    try {
      const id = this.almacenSesion()?.getItem(CONFIG_APP.claveSesion) ?? null;
      this.usuarioIdSesion = id;
      return id;
    } catch {
      return null;
    }
  }

  private limpiarSesion(): void {
    this.usuarioIdSesion = null;
    try {
      this.almacenSesion()?.removeItem(CONFIG_APP.claveSesion);
    } catch {
      // Sin almacenamiento disponible: la sesión en memoria ya se limpió.
    }
  }

  private async requerirSesion(): Promise<RegistroUsuario> {
    const id = this.leerSesionId();
    if (!id) {
      throw new ErrorValidacion('Debe iniciar sesión para continuar.', 'sesion');
    }

    const registro = await this.db.usuarios.get(id);
    if (!registro) {
      this.limpiarSesion();
      throw new ErrorValidacion('La sesión expiró. Vuelva a iniciar sesión.', 'sesion');
    }

    return registro;
  }

  private async configuracionDe(usuarioId: string): Promise<ConfiguracionUsuario> {
    const existente = await this.db.configuracion.get(usuarioId);
    if (existente) return existente;

    const inicial = crearConfiguracionInicial(usuarioId);
    await this.db.configuracion.put(inicial);
    return inicial;
  }

  private async aplicarEspera(clave: string): Promise<void> {
    const intentos = this.intentosFallidos.get(clave) ?? 0;
    if (intentos < CONFIG_APP.intentosAntesDeEspera) return;

    const factor = 2 ** (intentos - CONFIG_APP.intentosAntesDeEspera);
    const espera = Math.min(1000 * factor, CONFIG_APP.esperaMaximaMs);
    await new Promise<void>((resolver) => {
      setTimeout(resolver, espera);
    });
  }

  private registrarFallo(clave: string): void {
    this.intentosFallidos.set(clave, (this.intentosFallidos.get(clave) ?? 0) + 1);
  }

  private limpiarFallos(clave: string): void {
    this.intentosFallidos.delete(clave);
  }

  /**
   * Genera las transacciones vencidas de una regla o de todas las activas.
   *
   * El avance de `proximaFecha` y las inserciones ocurren dentro de la misma
   * transacción Dexie, por lo que procesar dos veces no duplica movimientos.
   * Nunca se generan fechas posteriores a hoy: los saldos no se alteran con
   * ocurrencias futuras.
   */
  private async procesarRecurrenciasDe(
    usuarioId: string,
    soloId?: string,
  ): Promise<number> {
    const hoy = fechaHoy();
    let generadas = 0;

    await this.db.transaction(
      'rw',
      [
        this.db.recurrencias,
        this.db.transacciones,
        this.db.cuentas,
        this.db.categorias,
      ],
      async () => {
        let registros: DatosRecurrencia[];

        if (soloId) {
          const registro = await this.db.recurrencias.get(soloId);
          registros =
            registro && registro.usuarioId === usuarioId ? [registro] : [];
        } else {
          registros = await this.db.recurrencias
            .where('usuarioId')
            .equals(usuarioId)
            .toArray();
        }

        const [cuentas, categorias] = await Promise.all([
          this.db.cuentas.where('usuarioId').equals(usuarioId).toArray(),
          this.db.categorias.where('usuarioId').equals(usuarioId).toArray(),
        ]);
        const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
        const categoriasPorId = new Map(
          categorias.map((categoria) => [categoria.id, categoria]),
        );

        for (const registro of registros) {
          if (!registro.activa) continue;

          const cuenta = cuentasPorId.get(registro.cuentaId);
          const categoria = categoriasPorId.get(registro.categoriaId);
          if (
            !cuenta ||
            !cuenta.activa ||
            !categoria ||
            categoria.tipo !== registro.tipo
          ) {
            // Referencias inválidas: se conserva la regla sin avanzar para que
            // el usuario pueda corregirla cuando la interfaz lo permita.
            continue;
          }

          const recurrencia = Recurrencia.desdeJSON(registro);
          const plan = planificarOcurrencias(recurrencia.toJSON(), hoy);
          const finalizada = Boolean(
            recurrencia.fechaFin && plan.proximaFecha > recurrencia.fechaFin,
          );

          for (const fecha of plan.fechas) {
            const transaccion = Transaccion.crear(
              {
                monto: recurrencia.monto,
                tipo: recurrencia.tipo,
                fecha,
                descripcion: recurrencia.descripcion,
                categoriaId: recurrencia.categoriaId,
                cuentaId: recurrencia.cuentaId,
                metodoPago: recurrencia.metodoPago,
                estado: EstadoTransaccion.Confirmado,
                etiquetas: recurrencia.etiquetas,
              },
              usuarioId,
              { id: recurrencia.id, fecha },
            );

            await this.db.transacciones.add(transaccion.toJSON());
            generadas += 1;
          }

          if (plan.fechas.length > 0 || finalizada) {
            await this.db.recurrencias.put({
              ...registro,
              proximaFecha: plan.proximaFecha,
              activa: finalizada ? false : registro.activa,
            });
          }
        }
      },
    );

    return generadas;
  }

  private async validarReferencias(
    usuarioId: string,
    cuentaId: string,
    categoriaId: string,
    tipo: TipoTransaccionType,
  ): Promise<void> {
    const [cuenta, categoria] = await Promise.all([
      this.db.cuentas.get(cuentaId),
      this.db.categorias.get(categoriaId),
    ]);

    if (!cuenta || cuenta.usuarioId !== usuarioId) {
      throw new ErrorValidacion('La cuenta no existe o no le pertenece.', 'cuentaId');
    }
    if (!cuenta.activa) {
      throw new ErrorValidacion('La cuenta está archivada.', 'cuentaId');
    }
    if (!categoria || categoria.usuarioId !== usuarioId) {
      throw new ErrorValidacion(
        'La categoría no existe o no le pertenece.',
        'categoriaId',
      );
    }
    if (categoria.tipo !== tipo) {
      throw new ErrorValidacion(
        `La categoría "${categoria.nombre}" es de tipo ${categoria.tipo} y la transacción es de tipo ${tipo}.`,
        'categoriaId',
      );
    }
  }

  private async contextoConsulta(usuarioId: string): Promise<{
    transacciones: Transaccion[];
    categorias: Categoria[];
    cuentas: Cuenta[];
    porCategoriaId: Map<string, Categoria>;
    porCuentaId: Map<string, Cuenta>;
  }> {
    const [registrosTransacciones, registrosCategorias, registrosCuentas] =
      await Promise.all([
        this.db.transacciones.where('usuarioId').equals(usuarioId).toArray(),
        this.db.categorias.where('usuarioId').equals(usuarioId).toArray(),
        this.db.cuentas.where('usuarioId').equals(usuarioId).toArray(),
      ]);

    const categorias = registrosCategorias.map((categoria) =>
      Categoria.desdeJSON(categoria),
    );
    const cuentas = registrosCuentas.map((cuenta) => Cuenta.desdeJSON(cuenta));

    return {
      transacciones: registrosTransacciones.map((transaccion) =>
        Transaccion.desdeJSON(transaccion),
      ),
      categorias,
      cuentas,
      porCategoriaId: new Map(categorias.map((categoria) => [categoria.id, categoria])),
      porCuentaId: new Map(cuentas.map((cuenta) => [cuenta.id, cuenta])),
    };
  }

  private cumpleFiltro(
    transaccion: Transaccion,
    filtro: FiltroTransacciones,
    contexto: {
      categorias: Categoria[];
      porCategoriaId: Map<string, Categoria>;
      porCuentaId: Map<string, Cuenta>;
    },
  ): boolean {
    if (filtro.desde && transaccion.fecha < filtro.desde) return false;
    if (filtro.hasta && transaccion.fecha > filtro.hasta) return false;
    if (filtro.tipo && transaccion.tipo !== filtro.tipo) return false;
    if (filtro.categoriaId && transaccion.categoriaId !== filtro.categoriaId) {
      return false;
    }
    if (filtro.cuentaId && transaccion.cuentaId !== filtro.cuentaId) return false;
    if (filtro.metodoPago && transaccion.metodoPago !== filtro.metodoPago) {
      return false;
    }
    if (filtro.estado && transaccion.estado !== filtro.estado) return false;

    if (filtro.texto && filtro.texto.trim()) {
      const categoria = contexto.porCategoriaId.get(transaccion.categoriaId);
      const cuenta = contexto.porCuentaId.get(transaccion.cuentaId);
      const contenido = normalizarTexto(
        [
          transaccion.descripcion,
          categoria ? categoria.nombre : '',
          categoria ? categoria.nombreCompleto(contexto.categorias) : '',
          cuenta ? cuenta.nombre : '',
          transaccion.etiquetas.join(' '),
        ].join(' '),
      );
      if (!contenido.includes(normalizarTexto(filtro.texto))) return false;
    }

    return true;
  }

  private ordenar(
    transacciones: Transaccion[],
    orden: OrdenTransacciones = OrdenTransacciones.FechaDesc,
  ): Transaccion[] {
    const copia = [...transacciones];

    switch (orden) {
      case OrdenTransacciones.FechaAsc:
        return copia.sort(
          (a, b) =>
            a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn),
        );
      case OrdenTransacciones.MontoDesc:
        return copia.sort((a, b) => b.monto - a.monto);
      case OrdenTransacciones.MontoAsc:
        return copia.sort((a, b) => a.monto - b.monto);
      case OrdenTransacciones.FechaDesc:
      default:
        return copia.sort(
          (a, b) =>
            b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn),
        );
    }
  }

  private agruparPorCategoria(
    transacciones: Transaccion[],
    categorias: Categoria[],
    totalIngresos: number,
    totalGastos: number,
  ): ResumenPorCategoria[] {
    const porId = new Map(categorias.map((categoria) => [categoria.id, categoria]));
    const acumulados = new Map<
      string,
      { categoria: Categoria; total: number; cantidad: number }
    >();

    for (const transaccion of transacciones) {
      const categoria = porId.get(transaccion.categoriaId);
      if (!categoria) continue;

      const acumulado = acumulados.get(categoria.id) ?? {
        categoria,
        total: 0,
        cantidad: 0,
      };
      acumulado.total += transaccion.monto;
      acumulado.cantidad += 1;
      acumulados.set(categoria.id, acumulado);
    }

    const resumen: ResumenPorCategoria[] = [];

    for (const acumulado of acumulados.values()) {
      const totalDelTipo =
        acumulado.categoria.tipo === TipoTransaccion.Ingreso
          ? totalIngresos
          : totalGastos;

      resumen.push({
        categoriaId: acumulado.categoria.id,
        nombre: acumulado.categoria.nombreCompleto(categorias),
        color: acumulado.categoria.color,
        icono: acumulado.categoria.icono,
        tipo: acumulado.categoria.tipo,
        total: redondearMonto(acumulado.total),
        cantidad: acumulado.cantidad,
        porcentaje:
          totalDelTipo === 0
            ? 0
            : redondearMonto((acumulado.total / totalDelTipo) * 100),
      });
    }

    return resumen.sort((a, b) => b.total - a.total);
  }

  private agruparPorMes(transacciones: Transaccion[]): ResumenMensual[] {
    const acumulados = new Map<string, ResumenMensual>();

    for (const transaccion of transacciones) {
      const actual = acumulados.get(transaccion.periodo) ?? {
        mes: transaccion.periodo,
        ingresos: 0,
        gastos: 0,
        balance: 0,
      };

      if (transaccion.esIngreso) {
        actual.ingresos += transaccion.monto;
      } else {
        actual.gastos += transaccion.monto;
      }
      acumulados.set(transaccion.periodo, actual);
    }

    return [...acumulados.values()]
      .map((mes) => ({
        mes: mes.mes,
        ingresos: redondearMonto(mes.ingresos),
        gastos: redondearMonto(mes.gastos),
        balance: redondearMonto(mes.ingresos - mes.gastos),
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }
}
