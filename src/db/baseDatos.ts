import Dexie from 'dexie';
import type { Table } from 'dexie';
import { CONFIG_APP } from '../config/app';
import type { DatosCategoria } from '../models/Categoria';
import type { DatosCuenta } from '../models/Cuenta';
import type { DatosPresupuesto } from '../models/Presupuesto';
import type { DatosRecurrencia } from '../models/Recurrencia';
import type { DatosTransaccion } from '../models/Transaccion';
import type { DatosTransferencia } from '../models/Transferencia';
import type { ConfiguracionUsuario } from '../models/tipos';

/**
 * Registro de usuario tal como se guarda en IndexedDB.
 *
 * Incluye credenciales que NUNCA salen del servicio: el dominio expone solo
 * `Usuario` (sin hash ni sal).
 */
export interface RegistroUsuario {
  id: string;
  nombre: string;
  correo: string;
  hashContrasena: string;
  sal: string;
  hashRecuperacion: string;
  salRecuperacion: string;
  creadoEn: string;
  ultimoAcceso: string;
}

export type RegistroCuenta = DatosCuenta;
export type RegistroCategoria = DatosCategoria;
export type RegistroTransaccion = DatosTransaccion;
export type RegistroTransferencia = DatosTransferencia;
export type RegistroPresupuesto = DatosPresupuesto;
export type RegistroRecurrencia = DatosRecurrencia;
export type RegistroConfiguracion = ConfiguracionUsuario;

/** Base de datos local (IndexedDB) de la aplicación. */
export class BaseDatosFinanzas extends Dexie {
  usuarios!: Table<RegistroUsuario, string>;
  cuentas!: Table<RegistroCuenta, string>;
  categorias!: Table<RegistroCategoria, string>;
  transacciones!: Table<RegistroTransaccion, string>;
  transferencias!: Table<RegistroTransferencia, string>;
  presupuestos!: Table<RegistroPresupuesto, string>;
  recurrencias!: Table<RegistroRecurrencia, string>;
  configuracion!: Table<RegistroConfiguracion, string>;

  constructor(nombre: string = CONFIG_APP.nombreBaseDatos) {
    super(nombre);

    this.version(1).stores({
      usuarios: 'id, &correo',
      cuentas: 'id, usuarioId, [usuarioId+tipo]',
      categorias: 'id, usuarioId, padreId, [usuarioId+tipo]',
      transacciones:
        'id, usuarioId, cuentaId, categoriaId, fecha, [usuarioId+fecha], [usuarioId+cuentaId], [usuarioId+categoriaId]',
      transferencias: 'id, usuarioId, cuentaOrigenId, cuentaDestinoId, [usuarioId+fecha]',
      configuracion: 'usuarioId',
    });

    // v2: reglas de movimientos recurrentes y vínculo desde cada transacción
    // generada. Dexie migra la base existente sin perder datos.
    this.version(2).stores({
      usuarios: 'id, &correo',
      cuentas: 'id, usuarioId, [usuarioId+tipo]',
      categorias: 'id, usuarioId, padreId, [usuarioId+tipo]',
      transacciones:
        'id, usuarioId, cuentaId, categoriaId, fecha, recurrenciaId, [usuarioId+fecha], [usuarioId+cuentaId], [usuarioId+categoriaId], [usuarioId+recurrenciaId]',
      transferencias: 'id, usuarioId, cuentaOrigenId, cuentaDestinoId, [usuarioId+fecha]',
      recurrencias: 'id, usuarioId, [usuarioId+activa]',
      configuracion: 'usuarioId',
    });

    // v3: presupuestos por categoria con limite manual y deteccion de concentracion
    this.version(3).stores({
      usuarios: 'id, &correo',
      cuentas: 'id, usuarioId, [usuarioId+tipo]',
      categorias: 'id, usuarioId, padreId, [usuarioId+tipo]',
      transacciones:
        'id, usuarioId, cuentaId, categoriaId, fecha, recurrenciaId, [usuarioId+fecha], [usuarioId+cuentaId], [usuarioId+categoriaId], [usuarioId+recurrenciaId]',
      transferencias: 'id, usuarioId, cuentaOrigenId, cuentaDestinoId, [usuarioId+fecha]',
      recurrencias: 'id, usuarioId, [usuarioId+activa]',
      presupuestos: 'id, usuarioId, categoriaId, [usuarioId+categoriaId], [usuarioId+activo]',
      configuracion: 'usuarioId',
    });
  }
}

/**
 * Instancia compartida por la aplicación.
 * Dexie abre la base de forma perezosa en la primera consulta.
 */
export const baseDatos = new BaseDatosFinanzas();
