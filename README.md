# ðŸ“Š FinTrack Â· Gestor de Finanzas Personales

AplicaciÃ³n web **local-first** para registrar ingresos y gastos, controlar cuentas bancarias y efectivo, y consultar reportes. Funciona sin internet ni servidores: todos los datos viven en el navegador del usuario.

> **Este README es el documento tÃ©cnico oficial del proyecto.**
> Todo cambio relevante (cÃ³digo, estructura, decisiones o pendientes) debe registrarse en la secciÃ³n [BitÃ¡cora de cambios](#-bitÃ¡cora-de-cambios).

---

## ðŸ“Œ Estado del proyecto

| Ãrea | Estado | Detalle |
| --- | --- | --- |
| Dominio (`src/models`) | âœ… Listo | Usuario, Cuenta, CategorÃ­a, TransacciÃ³n, Transferencia y Recurrencia |
| Persistencia local | âœ… Listo | Dexie sobre IndexedDB (esquema v2) |
| AutenticaciÃ³n local | âœ… Listo | Registro abierto, login, cÃ³digo de recuperaciÃ³n |
| Aislamiento por usuario | âœ… Listo | Todas las entidades llevan `usuarioId` y se filtran por sesiÃ³n |
| Contrato de datos v2 | âœ… Listo | `FinanzasService` + `LocalFinanzasService` |
| Movimientos recurrentes | âœ… Listo | Reglas diarias, semanales y mensuales; generaciÃ³n solo al llegar la fecha |
| Reportes | âœ… Listo | Estado de resultados, gastos por categorÃ­a, PDF y CSV |
| Interfaz de producto | ðŸš§ Fuera de esta entrega | La construirÃ¡ el compaÃ±ero de frontend |
| Demo funcional | âœ… Listo | `demo.html`: acceso, dashboard, movimientos, cuentas, categorÃ­as, reportes y perfil |
| Modo offline (PWA) | âœ… Listo | Manifiesto, service worker y precache; instalable y 100 % offline |
| SincronizaciÃ³n remota | â³ Futuro | Documentada como migraciÃ³n opcional |

### Alcance de esta entrega

1. Modelo de dominio completo con validaciones y serializaciÃ³n.
2. Persistencia real en IndexedDB mediante Dexie.
3. Servicio Ãºnico de datos con sesiÃ³n, aislamiento por usuario y reportes.
4. Seguridad local: hash PBKDF2, sal por credencial y cÃ³digo de recuperaciÃ³n rotativo.
5. ExportaciÃ³n de respaldos JSON, CSV y reportes PDF.
6. Movimientos recurrentes diarios, semanales y mensuales sin proyecciones futuras.
7. Demo funcional con React + Bootstrap, **sin CSS propio**.
8. PWA instalable con manifiesto, service worker y precache de todos los assets.

**Regla de la entrega:** toda la interfaz visual vive solo en `src/dev` y `demo.html`. **No se modificaron** `src/App.tsx`, `src/main.tsx`, `src/App.css` ni `src/index.css`; el compaÃ±ero de frontend los trabajarÃ¡ despuÃ©s. La demo se apoya Ãºnicamente en React Bootstrap.

---

## ðŸ§° TecnologÃ­as

| Capa | TecnologÃ­a |
| --- | --- |
| Frontend | React 19 + TypeScript 6 |
| Empaquetador | Vite 8 |
| UI | Bootstrap 5 + React Bootstrap (sin CSS propio) |
| Persistencia | Dexie 4 + IndexedDB |
| GrÃ¡ficos | Chart.js 4 + react-chartjs-2 |
| Reportes | jsPDF + jspdf-autotable |
| PWA | `vite-plugin-pwa` 2 + Workbox 7 |
| Pruebas de humo | Node + `fake-indexeddb` + `vite.ssrLoadModule` |
| Calidad | ESLint 10 + `tsc` |

---

## ðŸš€ Puesta en marcha

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run dev
```

| Comando | DescripciÃ³n |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173` |
| `npm run build` | VerificaciÃ³n de tipos + build de producciÃ³n |
| `npm run lint` | AnÃ¡lisis estÃ¡tico con ESLint |
| `npm test` | Pruebas de humo del servicio con `fake-indexeddb` |
| `npm run preview` | Sirve el build de producciÃ³n (necesario para probar la PWA) |
| `node scripts/generar-iconos.mjs` | Regenera `public/pwa-192x192.png` y `public/pwa-512x512.png` |

**Demo funcional:** `http://localhost:5173/demo.html`

La demo no forma parte del build de producciÃ³n: `vite build` solo incluye `index.html`. Sirve como referencia visual y funcional para el frontend.

---

## ðŸ“ Estructura del proyecto

```
app-contabilidad/
â”œâ”€â”€ demo.html                       # Entrada de la demo (solo desarrollo)
â”œâ”€â”€ index.html                      # Entrada de la aplicaciÃ³n real
â”œâ”€â”€ vite.config.ts                  # React + VitePWA (manifiesto y service worker)
â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ favicon.svg                 # Icono del navegador
â”‚   â”œâ”€â”€ icons.svg                   # Iconos auxiliares
â”‚   â”œâ”€â”€ pwa-192x192.png             # Icono PWA 192 x 192
â”‚   â””â”€â”€ pwa-512x512.png             # Icono PWA 512 x 512
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ generar-iconos.mjs          # Regenera los PNG de la PWA sin dependencias
â”‚   â””â”€â”€ smoke.mjs                   # Pruebas de humo del servicio (Node)
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â””â”€â”€ app.ts                  # Moneda, locale, versiÃ³n de BD, sesiÃ³n, hash
â”‚   â”œâ”€â”€ db/
â”‚   â”‚   â”œâ”€â”€ baseDatos.ts            # Esquema Dexie v2 (incluye recurrencias)
â”‚   â”‚   â””â”€â”€ semilla.ts              # 34 categorÃ­as base, cuenta y configuraciÃ³n
â”‚   â”œâ”€â”€ dev/                        # Demo: TODO lo visual
â”‚   â”‚   â”œâ”€â”€ componentes/
â”‚   â”‚   â”‚   â”œâ”€â”€ Estado.tsx          # Cargando, AlertaErrorCarga, TarjetaKpi
â”‚   â”‚   â”‚   â”œâ”€â”€ ErrorBoundary.tsx   # LÃ­mite de errores de render
â”‚   â”‚   â”‚   â”œâ”€â”€ Graficos.tsx        # GrÃ¡fico de flujo y de categorÃ­as
â”‚   â”‚   â”‚   â”œâ”€â”€ Notificaciones.tsx  # Provider y toasts de React Bootstrap
â”‚   â”‚   â”‚   â”œâ”€â”€ notificacionesContexto.ts # Contexto y useNotificaciones()
â”‚   â”‚   â”‚   â”œâ”€â”€ TablaRecurrencias.tsx # Reglas recurrentes: pausar y eliminar
â”‚   â”‚   â”‚   â””â”€â”€ useErroresFormulario.ts   # Errores inline por campo
â”‚   â”‚   â”œâ”€â”€ pantallas/
â”‚   â”‚   â”‚   â”œâ”€â”€ Acceso.tsx          # Login, registro, recuperaciÃ³n, cÃ³digo
â”‚   â”‚   â”‚   â”œâ”€â”€ Dashboard.tsx       # KPIs, grÃ¡ficos, Ãºltimos movimientos
â”‚   â”‚   â”‚   â”œâ”€â”€ Movimientos.tsx     # Alta (con repeticiÃ³n), filtros y eliminaciÃ³n
â”‚   â”‚   â”‚   â”œâ”€â”€ Cuentas.tsx         # Saldos, cuentas y transferencias
â”‚   â”‚   â”‚   â”œâ”€â”€ Categorias.tsx      # Ãrbol ingreso/gasto y alta
â”‚   â”‚   â”‚   â”œâ”€â”€ Reportes.tsx        # Periodo, estado de resultados, PDF y CSV
â”‚   â”‚   â”‚   â””â”€â”€ MiCuenta.tsx        # Perfil, contraseÃ±a, respaldo y borrado
â”‚   â”‚   â”œâ”€â”€ DemoDatos.tsx           # Shell: sesiÃ³n, navbar y navegaciÃ³n
â”‚   â”‚   â”œâ”€â”€ main-demo.tsx           # Montaje de la demo
â”‚   â”‚   â””â”€â”€ secciones.ts            # Secciones navegables
â”‚   â”œâ”€â”€ models/
â”‚   â”‚   â”œâ”€â”€ Usuario.ts              # Usuario sin credenciales
â”‚   â”‚   â”œâ”€â”€ Cuenta.ts               # Efectivo, banco, ahorro, tarjeta
â”‚   â”‚   â”œâ”€â”€ Categoria.ts            # CategorÃ­as jerÃ¡rquicas
â”‚   â”‚   â”œâ”€â”€ Transaccion.ts          # Ingreso o gasto
â”‚   â”‚   â”œâ”€â”€ Transferencia.ts        # Movimiento entre cuentas
â”‚   â”‚   â”œâ”€â”€ Recurrencia.ts          # Regla de gasto/ingreso repetitivo
â”‚   â”‚   â”œâ”€â”€ errores.ts              # ErrorValidacion
â”‚   â”‚   â”œâ”€â”€ tipos.ts                # Constantes, tipos y DTOs
â”‚   â”‚   â””â”€â”€ index.ts                # Barrel del dominio
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ FinanzasService.ts      # Contrato Ãºnico (interfaz)
â”‚   â”‚   â”œâ”€â”€ LocalFinanzasService.ts # ImplementaciÃ³n IndexedDB
â”‚   â”‚   â””â”€â”€ index.ts                # Singleton `finanzasService`
â”‚   â”œâ”€â”€ utils/
â”‚   â”‚   â”œâ”€â”€ criptografia.ts         # PBKDF2, sales y cÃ³digos
â”‚   â”‚   â”œâ”€â”€ descargas.ts            # Descargar y leer archivos
â”‚   â”‚   â”œâ”€â”€ errores.ts              # Normalizador de errores de la UI
â”‚   â”‚   â”œâ”€â”€ formato.ts              # Moneda CRC, fechas y etiquetas
â”‚   â”‚   â”œâ”€â”€ numeros.ts              # Redondeo y sumas
â”‚   â”‚   â”œâ”€â”€ recurrencia.ts          # CÃ¡lculo de ocurrencias y fin de mes
â”‚   â”‚   â””â”€â”€ reportesPdf.ts          # Reportes con jsPDF + AutoTable
â”‚   â”œâ”€â”€ App.tsx                     # Interfaz real (sin cambios)
â”‚   â””â”€â”€ main.tsx                    # Montaje real (sin cambios)
â””â”€â”€ README.md
```

### Arquitectura local-first

```
Demo (React + Bootstrap)
        â”‚  solo conoce la interfaz
        â–¼
finanzasService  â—„â”€â”€ contrato Ãºnico (src/services/index.ts)
        â”‚
        â–¼
LocalFinanzasService
        â”‚  obtiene el usuario de la sesiÃ³n
        â–¼
Dexie  â”€â”€â–º  IndexedDB (fintrack)
```

Regla de oro: **la interfaz nunca importa `LocalFinanzasService`**. Siempre usa `finanzasService`.

No hay llamadas de red en ningÃºn punto de la aplicaciÃ³n: el flujo completo funciona con el servidor de desarrollo apagado una vez cargada la pÃ¡gina.

---

## ðŸ” Seguridad y aislamiento

| Aspecto | ImplementaciÃ³n |
| --- | --- |
| ContraseÃ±as | PBKDF2-SHA256, 210 000 iteraciones, sal aleatoria de 16 bytes por usuario |
| ComparaciÃ³n | Tiempo constante para evitar filtraciones por temporizaciÃ³n |
| CÃ³digo de recuperaciÃ³n | 12 caracteres (`XXXX-XXXX-XXXX`), alfabeto sin caracteres ambiguos |
| Almacenamiento del cÃ³digo | Hash PBKDF2 con **sal independiente**; nunca en claro |
| RotaciÃ³n | El cÃ³digo se muestra una sola vez y se reemplaza al usarlo |
| SesiÃ³n | Solo el `usuarioId` en `sessionStorage` (`fintrack:sesion:v1`) |
| ValidaciÃ³n de sesiÃ³n | Cada operaciÃ³n verifica que el usuario exista en la base |
| Intentos fallidos | Espera exponencial tras 3 intentos (1 s, 2 s, 4 sâ€¦ mÃ¡ximo 8 s) |
| Roles | No existen: registro abierto, sin administrador |
| Aislamiento | Todas las consultas filtran por `usuarioId`; las entidades ajenas se rechazan |

El servicio nunca devuelve hashes ni sales: el dominio expone `Usuario` sin credenciales. Las credenciales viven Ãºnicamente en la tabla interna `usuarios`.

> **LÃ­mite honesto:** al ser una aplicaciÃ³n local, la protecciÃ³n depende del navegador y del equipo. Los datos de IndexedDB no estÃ¡n cifrados en reposo; el hash protege las contraseÃ±as, no el contenido financiero.

---

## ðŸ§© Modelo de datos

```mermaid
erDiagram
    USUARIO ||--o{ CUENTA : "posee"
    USUARIO ||--o{ CATEGORIA : "define"
    USUARIO ||--o{ TRANSACCION : "registra"
    USUARIO ||--o{ TRANSFERENCIA : "mueve"
    USUARIO ||--o{ RECURRENCIA : "programa"
    USUARIO ||--|| CONFIGURACION : "prefiere"
    CUENTA ||--o{ TRANSACCION : "afecta"
    CATEGORIA ||--o{ TRANSACCION : "clasifica"
    CUENTA ||--o{ TRANSFERENCIA : "origen/destino"
    CUENTA ||--o{ RECURRENCIA : "afecta"
    CATEGORIA ||--o{ RECURRENCIA : "clasifica"
    RECURRENCIA ||--o{ TRANSACCION : "genera"
```

### `Usuario`

| Campo | Tipo | DescripciÃ³n |
| --- | --- | --- |
| `id` | `string` | Identificador Ãºnico (`usr-...`) |
| `nombre` | `string` | Nombre completo |
| `correo` | `string` | Correo normalizado a minÃºsculas; Ãºnico |
| `creadoEn` | `string` | Fecha de creaciÃ³n ISO 8601 |
| `ultimoAcceso` | `string` | Ãšltimo inicio de sesiÃ³n ISO 8601 |

Miembro calculado: `iniciales` (`"Ana RodrÃ­guez"` â†’ `"AR"`).

### `Cuenta`

| Campo | Tipo | DescripciÃ³n |
| --- | --- | --- |
| `id` | `string` | Identificador Ãºnico (`cta-...`) |
| `usuarioId` | `string` | DueÃ±o de la cuenta |
| `nombre` | `string` | Ãšnico por usuario (sin distinguir mayÃºsculas ni tildes) |
| `tipo` | `"efectivo"` \| `"banco"` \| `"ahorro"` \| `"tarjeta"` | Tipo fijo |
| `saldoInicial` | `number` | Punto de partida |
| `moneda` | `string` | `CRC` por defecto |
| `institucion` | `string` | Banco o entidad, opcional |
| `color` / `icono` | `string` | PresentaciÃ³n |
| `activa` | `boolean` | Las archivadas no admiten movimientos nuevos |
| `creadoEn` | `string` | ISO 8601 |

El **saldo no se almacena**: se calcula con saldo inicial + ingresos âˆ’ gastos confirmados Â± transferencias.

### `Categoria`

| Campo | Tipo | DescripciÃ³n |
| --- | --- | --- |
| `id` | `string` | Identificador Ãºnico (`cat-...`) |
| `usuarioId` | `string` | DueÃ±o |
| `nombre` | `string` | Ãšnico entre hermanas del mismo tipo |
| `tipo` | `"ingreso"` \| `"gasto"` | Fijo desde su creaciÃ³n |
| `padreId` | `string \| null` | CategorÃ­a padre para jerarquÃ­a |
| `color` / `icono` | `string` | PresentaciÃ³n |

### `Transaccion`

| Campo | Tipo | DescripciÃ³n |
| --- | --- | --- |
| `id` | `string` | Identificador Ãºnico (`trx-...`) |
| `usuarioId` | `string` | DueÃ±o |
| `cuentaId` | `string` | Cuenta afectada |
| `monto` | `number` | Siempre positivo, 2 decimales |
| `tipo` | `"ingreso"` \| `"gasto"` | Naturaleza del movimiento |
| `fecha` | `string` | Fecha real `AAAA-MM-DD` |
| `descripcion` | `string` | Obligatoria |
| `categoriaId` | `string` | CategorÃ­a del mismo tipo |
| `metodoPago` | `efectivo` \| `tarjeta` \| `transferencia` \| `sinpe` \| `otro` | Por defecto `otro` |
| `estado` | `"confirmado"` \| `"pendiente"` | Solo los confirmados afectan saldos y reportes |
| `etiquetas` | `string[]` | Sin duplicados |
| `creadoEn` | `string` | ISO 8601 |
| `recurrenciaId` | `string?` | Regla que generÃ³ el movimiento, si aplica |
| `recurrenciaFecha` | `string?` | Fecha de la ocurrencia dentro de la serie |

Miembros calculados: `esIngreso`, `montoFirmado`, `periodo` (`AAAA-MM`).

### `Transferencia`

| Campo | Tipo |
| --- | --- |
| `id` | `string` (`trf-...`) |
| `usuarioId` | `string` |
| `cuentaOrigenId` / `cuentaDestinoId` | `string` (deben ser distintas) |
| `monto` | `number` (> 0) |
| `fecha` | `AAAA-MM-DD` |
| `descripcion` | `string` (opcional) |
| `creadoEn` | ISO 8601 |

Las transferencias se guardan **aparte** de las transacciones: mueven saldos, pero no son ingreso ni gasto en los reportes.

### `Recurrencia`

| Campo | Tipo | DescripciÃ³n |
| --- | --- | --- |
| `id` | `string` | Identificador Ãºnico (`rec-...`) |
| `usuarioId` | `string` | DueÃ±o de la regla |
| `cuentaId` / `categoriaId` | `string` | Referencias validadas contra el usuario y el tipo |
| `monto` | `number` | Siempre positivo, 2 decimales |
| `tipo` | `"ingreso"` \| `"gasto"` | Naturaleza del movimiento |
| `descripcion` | `string` | Obligatoria |
| `metodoPago` | `MetodoPago` | Se copia en cada ocurrencia |
| `etiquetas` | `string[]` | Se copian en cada ocurrencia |
| `frecuencia` | `"diaria"` \| `"semanal"` \| `"mensual"` | Cadencia de la serie |
| `fechaInicio` | `string` | Primera fecha de la serie (`AAAA-MM-DD`) |
| `fechaFin` | `string \| null` | Fin opcional de la serie |
| `diaAncla` | `number` | DÃ­a original del mes (1â€“31) para frecuencias mensuales |
| `proximaFecha` | `string` | Siguiente ocurrencia pendiente de generar |
| `activa` | `boolean` | Pausada o activa |
| `creadoEn` | `string` | ISO 8601 |

La regla **no crea movimientos virtuales ni proyecciones**: cuando `proximaFecha <= hoy`, el servicio inserta una transacciÃ³n real, avanza `proximaFecha` y repite hasta agotar las ocurrencias vencidas. Las fechas futuras nunca se registran, por lo que los saldos no se alteran por adelantado.

### `ConfiguracionUsuario`

`usuarioId`, `moneda` (`CRC`), `locale` (`es-CR`) y `tema` (`claro`).

### Enumeraciones (sin `enum`)

El proyecto compila con `erasableSyntaxOnly`, por lo que no se usan `enum`. Se emplean objetos `as const` que funcionan como valor y como tipo:

```ts
import { TipoCuenta, TipoTransaccion, TIPOS_CUENTA } from '../models';

TipoTransaccion.Ingreso; // 'ingreso'
TipoCuenta.Banco;        // 'banco'
```

---

## âœ… Reglas de negocio

1. El monto debe ser un nÃºmero finito **mayor que cero**; el signo lo define el tipo.
2. Los montos se redondean a **2 decimales** al guardarse.
3. La fecha debe existir en el calendario y usar `AAAA-MM-DD`.
4. La descripciÃ³n de una transacciÃ³n es obligatoria.
5. Toda transacciÃ³n apunta a una cuenta activa y a una categorÃ­a **del mismo usuario**.
6. El tipo de la categorÃ­a debe coincidir con el tipo de la transacciÃ³n.
7. El nombre de una cuenta es Ãºnico por usuario; el de una categorÃ­a, Ãºnico entre hermanas del mismo tipo (sin mayÃºsculas ni tildes).
8. El tipo de una categorÃ­a no se puede cambiar; una subcategorÃ­a hereda el tipo de su padre.
9. Una cuenta archivada conserva historial pero no admite movimientos nuevos.
10. Los saldos y reportes solo consideran transacciones **confirmadas**.
11. Las transferencias requieren cuentas distintas y no alteran ingresos ni gastos.
12. Al registrarse se crean 34 categorÃ­as base, una cuenta de efectivo con saldo 0 y la configuraciÃ³n CRC/es-CR.
13. Los errores de negocio se lanzan como `ErrorValidacion` con un `campo` opcional.
14. El servicio devuelve copias: mutarlas no altera la base.
15. Una regla recurrente genera transacciones **solo cuando su fecha ya llegÃ³** (`fecha <= hoy`); nunca se registran movimientos futuros ni proyecciones.
16. Al crear una regla se recuperan todas las ocurrencias vencidas desde `fechaInicio`; si la fecha es futura, no se crea ningÃºn movimiento todavÃ­a.
17. `proximaFecha` y las inserciones se actualizan en la misma transacciÃ³n Dexie, de modo que procesar dos veces es idempotente.
18. Las ocurrencias se guardan **confirmadas** y quedan vinculadas con `recurrenciaId` y `recurrenciaFecha`.
19. En frecuencias mensuales se usa `diaAncla` recortado al Ãºltimo dÃ­a del mes: 31 de enero â†’ 28/29 de febrero â†’ 31 de marzo, sin desplazamiento permanente.
20. Al archivar una cuenta se pausan sus reglas; al eliminarlas o pausarlas, las transacciones ya generadas se conservan como historial.

---

## ðŸ”Œ Contrato del servicio (`FinanzasService`)

```ts
import { finanzasService } from './services';
```

La interfaz **no recibe `usuarioId`**: el servicio lo toma de la sesiÃ³n activa.

### SesiÃ³n y cuenta

| MÃ©todo | Devuelve | Notas |
| --- | --- | --- |
| `registrar(datos)` | `ResultadoRegistro` | Devuelve el cÃ³digo de recuperaciÃ³n una sola vez e inicia sesiÃ³n |
| `iniciarSesion(correo, contrasena)` | `Usuario` | Normaliza el correo; aplica espera tras fallos |
| `cerrarSesion()` | `void` | Limpia `sessionStorage` |
| `usuarioActual()` | `Usuario \| null` | Valida la sesiÃ³n contra la base |
| `cambiarContrasena(actual, nueva)` | `void` | Exige la contraseÃ±a actual |
| `recuperarContrasena(correo, codigo, nueva)` | `ResultadoRecuperacion` | Rota el cÃ³digo de recuperaciÃ³n |
| `eliminarCuenta(contrasena)` | `void` | Borra usuario y todos sus datos |
| `obtenerConfiguracion()` | `ConfiguracionUsuario` | Crea la configuraciÃ³n si falta |

### Cuentas

| MÃ©todo | Devuelve | Notas |
| --- | --- | --- |
| `listarCuentas()` | `Cuenta[]` | Orden alfabÃ©tico |
| `crearCuenta(datos)` | `Cuenta` | Valida nombre Ãºnico |
| `actualizarCuenta(id, cambios)` | `Cuenta` | Permite archivar/reactivar |
| `transferir(datos)` | `Transferencia` | Valida pertenencia y cuentas distintas |
| `obtenerSaldos()` | `SaldoCuenta[]` | Calculados con movimientos confirmados |

### CategorÃ­as

| MÃ©todo | Devuelve | Notas |
| --- | --- | --- |
| `listarCategorias(tipo?)` | `Categoria[]` | Filtro opcional por tipo |
| `crearCategoria(datos)` | `Categoria` | Valida padre, tipo y nombre Ãºnico entre hermanas |

### Transacciones

| MÃ©todo | Devuelve | Notas |
| --- | --- | --- |
| `listarTransacciones(filtro?)` | `Transaccion[]` | Orden por defecto: fecha descendente |
| `obtenerTransaccion(id)` | `Transaccion \| null` | `null` si es de otro usuario |
| `crearTransaccion(datos)` | `Transaccion` | Valida cuenta, categorÃ­a y tipo |
| `actualizarTransaccion(id, cambios)` | `Transaccion` | Cambios parciales validados |
| `eliminarTransaccion(id)` | `void` | Falla si no existe o es ajena |

### Recurrencias

| MÃ©todo | Devuelve | Notas |
| --- | --- | --- |
| `listarRecurrencias()` | `Recurrencia[]` | Activas primero, luego por prÃ³xima fecha |
| `crearRecurrencia(datos)` | `ResultadoCreacionRecurrencia` | Crea la regla y genera las ocurrencias vencidas |
| `actualizarRecurrencia(id, cambios)` | `Recurrencia` | Permite pausar/reanudar y fijar `fechaFin` |
| `eliminarRecurrencia(id)` | `void` | Conserva las transacciones ya generadas |
| `procesarRecurrencias()` | `number` | Genera lo vencido de todas las reglas activas; devuelve cuÃ¡ntas creÃ³ |

`NuevaRecurrencia` acepta `monto`, `tipo`, `fechaInicio`, `descripcion`, `categoriaId`, `cuentaId`, `frecuencia`, `fechaFin?`, `metodoPago?` y `etiquetas?`. El servicio valida las referencias con la misma lÃ³gica que una transacciÃ³n.

```ts
const { recurrencia, generadas } = await finanzasService.crearRecurrencia({
  monto: 42000,
  tipo: 'gasto',
  fechaInicio: '2026-11-15',
  descripcion: 'Luz',
  categoriaId: 'cat-...',
  cuentaId: 'cta-...',
  frecuencia: 'mensual',
  fechaFin: null,
});

// Si hoy es 2026-11-15 y la regla empieza hoy, generadas === 1.
// Si empieza el 2026-12-01, generadas === 0 y proximaFecha === '2026-12-01'.
```

### Reportes y datos

| MÃ©todo | Devuelve | Notas |
| --- | --- | --- |
| `obtenerResumen(filtro?)` | `ResumenFinanciero` | Totales, categorÃ­as, meses y rango |
| `obtenerEstadoResultados(desde, hasta)` | `EstadoResultados` | Filas por categorÃ­a |
| `obtenerFlujoCaja(desde, hasta)` | `ResumenMensual[]` | Ingresos, gastos y balance por mes |
| `exportarRespaldo()` | `RespaldoFinanzas` | JSON completo del usuario |
| `importarRespaldo(respaldo)` | `void` | Reemplaza datos; **regenera ids y remapea referencias** |
| `exportarTransaccionesCsv(filtro?)` | `string` | Cabecera en espaÃ±ol, separador coma |
| `resetearDatos()` | `void` | Borra movimientos y reglas, y restaura categorÃ­as base |

### Filtros disponibles

```ts
interface FiltroTransacciones {
  desde?: string;              // AAAA-MM-DD, inclusive
  hasta?: string;              // AAAA-MM-DD, inclusive
  tipo?: TipoTransaccion;
  categoriaId?: string;
  cuentaId?: string;
  metodoPago?: MetodoPago;
  estado?: EstadoTransaccion;
  texto?: string;              // descripciÃ³n, categorÃ­a, cuenta y etiquetas
  orden?: 'fecha-desc' | 'fecha-asc' | 'monto-desc' | 'monto-asc';
}
```

`ResumenFinanciero` expone `totalIngresos`, `totalGastos`, `balance`, cantidades, promedios, `porCategoria` (con porcentaje por tipo), `porMes` y el rango real cubierto. `porCategoria` se ordena de mayor a menor monto; `porMes`, del mes mÃ¡s antiguo al mÃ¡s reciente.

---

## ðŸ—„ï¸ Persistencia (IndexedDB con Dexie)

Base: **`fintrack`**, versiÃ³n de esquema **2** (`src/db/baseDatos.ts`). Al cambiar tablas o Ã­ndices hay que incrementar `versionBaseDatos` en `src/config/app.ts`. La migraciÃ³n v1 â†’ v2 agrega la tabla de reglas y el Ã­ndice `recurrenciaId` sin perder datos existentes.

| Tabla | Clave primaria | Ãndices |
| --- | --- | --- |
| `usuarios` | `id` | `&correo` (Ãºnico) |
| `cuentas` | `id` | `usuarioId`, `[usuarioId+tipo]` |
| `categorias` | `id` | `usuarioId`, `padreId`, `[usuarioId+tipo]` |
| `transacciones` | `id` | `usuarioId`, `cuentaId`, `categoriaId`, `fecha`, `recurrenciaId`, `[usuarioId+fecha]`, `[usuarioId+cuentaId]`, `[usuarioId+categoriaId]`, `[usuarioId+recurrenciaId]` |
| `transferencias` | `id` | `usuarioId`, `cuentaOrigenId`, `cuentaDestinoId`, `[usuarioId+fecha]` |
| `recurrencias` | `id` | `usuarioId`, `[usuarioId+activa]` |
| `configuracion` | `usuarioId` | â€” |

La tabla `usuarios` guarda ademÃ¡s `hashContrasena`, `sal`, `hashRecuperacion` y `salRecuperacion`; esos campos nunca salen del servicio.

### Semilla por usuario

- **34 categorÃ­as** jerÃ¡rquicas pensadas para Costa Rica: salario, outsourcing (SINPE/efectivo), inversiones, servicios del hogar, suscripciones, alimentaciÃ³n (supermercado, minisÃºper, cafeterÃ­a, restaurante, express), transporte (Didi/Uber, gasolina, bus/tren, mantenimiento), salud, educaciÃ³n, ocio, compras, mascotas y otros.
- Cuenta **Efectivo** con saldo 0.
- ConfiguraciÃ³n **CRC / es-CR / tema claro**.

### Respaldos

- Se exportan como JSON con `version`, `exportadoEn`, usuario y todas las colecciones, incluidas las reglas recurrentes.
- La versiÃ³n actual es **2**. La importaciÃ³n acepta respaldos **v1** (sin reglas) y **v2**; se rechazan versiones futuras o archivos incompletos.
- Al importar se valida la versiÃ³n y la integridad de las referencias, incluidas las de las reglas.
- Los ids se **regeneran** y las relaciones se remapean (tambiÃ©n `recurrenciaId` en cada movimiento) para evitar colisiones cuando varios usuarios comparten la misma base local.

---

## ðŸ–¥ï¸ Demo funcional (`/demo.html`)

| Pantalla | Contenido |
| --- | --- |
| **Acceso** | Login, registro abierto, recuperaciÃ³n con cÃ³digo y pantalla de cÃ³digo Ãºnico |
| **Dashboard** | KPIs del mes, patrimonio, flujo mensual, gastos por categorÃ­a y Ãºltimos movimientos |
| **Movimientos** | Alta con tipo/monto/fecha/categorÃ­a/cuenta/mÃ©todo/estado/etiquetas y casilla **Repetir** (diaria, semanal o mensual, con fin opcional); administraciÃ³n de reglas (pausar, reanudar, eliminar), filtros y eliminaciÃ³n; botÃ³n de 8 ejemplos |
| **Cuentas** | Saldos calculados, alta y archivado de cuentas, transferencias entre cuentas |
| **CategorÃ­as** | Ãrbol ingreso/gasto con uso real y alta de raÃ­ces o subcategorÃ­as |
| **Reportes** | Rango de fechas con atajos, estado de resultados, grÃ¡ficos, PDF y CSV |
| **Mi cuenta** | Perfil, cambio de contraseÃ±a, respaldo exportar/importar, reset y eliminaciÃ³n |

La navegaciÃ³n es por estado (no hay router instalado). Toda la UI usa React Bootstrap: no hay archivos CSS nuevos. Los resultados de las acciones se informan con toasts; los errores de campo se muestran inline y los fallos de carga con una alerta que permite reintentar.

### CÃ³mo funcionan los movimientos recurrentes

- En el formulario de movimientos, la casilla **â€œRepetir este movimientoâ€** convierte el alta en una regla. Se elige frecuencia (cada dÃ­a, cada semana o cada mes) y, opcionalmente, una fecha final.
- Si la fecha de inicio es **hoy o anterior**, se registran de inmediato las ocurrencias vencidas (cada una con su fecha real). Si es **futura**, no se crea nada todavÃ­a: la tarjeta de reglas muestra la prÃ³xima fecha.
- Al abrir la demo, la app procesa las reglas activas antes de mostrar el dashboard. Si estuvo cerrada varios dÃ­as, recupera las ocurrencias atrasadas sin duplicarlas.
- Las transacciones generadas se marcan con ðŸ” y se guardan confirmadas.
- **Pausar** detiene la generaciÃ³n; **Reanudar** recupera lo vencido durante la pausa. **Eliminar** borra la regla pero conserva los movimientos ya generados.
- En mensuales, el dÃ­a se recorta al Ãºltimo del mes sin perder el original: una regla del dÃ­a 31 genera el 28 de febrero de 2026 y vuelve al 31 en marzo.
- Si se archiva la cuenta asociada, sus reglas se pausan automÃ¡ticamente.

### Reportes PDF

- **Estado de resultados:** ingresos, gastos y utilidad del periodo.
- **Gastos por categorÃ­a:** total, movimientos y porcentaje del gasto.
- Se generan con texto y tablas nativas de jsPDF (no capturas), con encabezado, pie y numeraciÃ³n.
- Los montos se escriben como `CRC 1 234,56` porque la fuente estÃ¡ndar de jsPDF no incluye el sÃ­mbolo `â‚¡`.

---

## ðŸ“² PWA e instalaciÃ³n offline

La aplicaciÃ³n se puede instalar en escritorio o mÃ³vil y funciona sin conexiÃ³n despuÃ©s de la primera visita.

### ConfiguraciÃ³n

`vite.config.ts` integra `VitePWA` con:

- `registerType: 'autoUpdate'`: la versiÃ³n nueva del service worker se activa sola y `cleanupOutdatedCaches` elimina las cachÃ©s anteriores.
- `injectRegister: 'auto'`: el registro del service worker se inyecta en el HTML generado, **sin tocar `src/main.tsx`**.
- `workbox.globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`: precachea todo el shell estÃ¡tico.
- `navigateFallback: '/index.html'`: cualquier ruta del SPA se resuelve desde la cachÃ©.

El manifiesto declara `name`, `short_name`, `description`, `start_url: "/"`, `display: "standalone"`, `background_color: "#ffffff"`, `theme_color: "#0d6efd"`, `lang: "es-CR"` e iconos de 192 y 512 px.

| Artefacto del build | Contenido |
| --- | --- |
| `dist/manifest.webmanifest` | Manifiesto de la aplicaciÃ³n |
| `dist/sw.js` | Service worker con el precache de los assets |
| `dist/registerSW.js` | Registro inyectado en `index.html` |
| `dist/workbox-*.js` | Runtime de Workbox |

Los iconos son PNG generados localmente por `scripts/generar-iconos.mjs`, un script sin dependencias que dibuja el cuadrado azul con barras blancas y escribe el PNG con `node:zlib`. Se pueden sustituir por un diseÃ±o propio manteniendo los nombres y tamaÃ±os.

### InstalaciÃ³n y prueba offline

1. `npm run build` y `npm run preview`.
2. Abrir `http://localhost:4173`.
3. Instalar desde el icono de la barra de direcciones (escritorio) o desde el menÃº del navegador â†’ â€œInstalar aplicaciÃ³nâ€ / â€œAÃ±adir a pantalla de inicioâ€ (mÃ³vil).
4. En DevTools â†’ Application â†’ Service Workers, activar **Offline** y recargar: la app abre y opera con IndexedDB.

> El service worker solo se registra en `localhost` o HTTPS. La primera visita necesita red para descargar la app; a partir de ahÃ­ todo queda cacheado. `demo.html`, `src/dev` y el cÃ³digo de desarrollo no entran al build ni al precache.

---

## ðŸ‘©â€ðŸ’» GuÃ­a rÃ¡pida para el frontend

### 1. Arrancar la demo y entrar

```bash
npm run dev
# abrir http://localhost:5173/demo.html
```

Registre un usuario; el cÃ³digo de recuperaciÃ³n se muestra una sola vez.

### 2. Leer datos

```tsx
import { useEffect, useState } from 'react';
import type { ResumenFinanciero } from './models';
import { finanzasService } from './services';

function Panel() {
  const [resumen, setResumen] = useState<ResumenFinanciero | null>(null);

  useEffect(() => {
    let activo = true;
    finanzasService.obtenerResumen().then((datos) => {
      if (activo) setResumen(datos);
    });
    return () => {
      activo = false;
    };
  }, []);

  if (!resumen) return <p>Cargandoâ€¦</p>;
  return <p>Balance: {resumen.balance}</p>;
}
```

### 3. Registrar un gasto

```tsx
import { MetodoPago, TipoTransaccion } from './models';
import { finanzasService } from './services';

await finanzasService.crearTransaccion({
  monto: 25000,
  tipo: TipoTransaccion.Gasto,
  fecha: '2026-11-15',
  descripcion: 'Supermercado',
  categoriaId: 'cat-...',
  cuentaId: 'cta-...',
  metodoPago: MetodoPago.Tarjeta,
});
```

### 4. Manejar errores

La demo aplica cuatro reglas de presentaciÃ³n:

| SituaciÃ³n | PresentaciÃ³n |
| --- | --- |
| AcciÃ³n completada | Toast de Ã©xito abajo a la derecha |
| Error de campo (`ErrorValidacion.campo`) | Mensaje inline bajo el campo (`isInvalid` + `Form.Control.Feedback`) |
| Error general o tÃ©cnico | Toast de error con mensaje en espaÃ±ol, sin detalles de Dexie/IndexedDB |
| Pantalla que no puede cargar | Alerta inline con botÃ³n **Reintentar** |

`normalizarError` convierte cualquier fallo en `{ mensaje, campo?, tipo }`. Los tipos son `validacion`, `sesion`, `almacenamiento` y `desconocido`.

```tsx
import { normalizarError } from './utils/errores';

try {
  await finanzasService.crearTransaccion(datos);
} catch (fallo) {
  const error = normalizarError(fallo);
  if (error.campo === 'monto') {
    setErrorMonto(error.mensaje); // inline
  } else {
    notificaciones.error(error.mensaje); // toast
  }
}
```

En el login no se marcan campos concretos: el toast usa el mismo mensaje para correo inexistente o contraseÃ±a incorrecta. Las acciones destructivas conservan `window.confirm`; el toast solo informa el resultado. `ErrorBoundary` evita que un fallo de render deje la secciÃ³n en blanco.

### 5. Formatear valores

```ts
import { formatearMoneda, formatearFecha } from './utils/formato';

formatearMoneda(950000);        // "â‚¡950 000,00"
formatearFecha('2026-11-15');   // "15 de noviembre de 2026"
```

Las pantallas de `src/dev/pantallas` son la referencia completa de consumo del servicio.

---

## ðŸ§­ Convenciones de cÃ³digo

- **Dominio en espaÃ±ol** (`Transaccion`, `categoriaId`); infraestructura en inglÃ©s (`services`, `config`).
- **Sin `enum`**: objetos `as const` + tipo uniÃ³n (requisito de `erasableSyntaxOnly`).
- **Sin parÃ¡metros de propiedad** en constructores (`constructor(private x)`), por la misma razÃ³n.
- `import type` obligatorio para importaciones de solo tipo (`verbatimModuleSyntax`).
- `noUnusedLocals` y `noUnusedParameters` activos.
- Fechas de dominio como `AAAA-MM-DD`; marcas de tiempo en ISO 8601.
- Montos positivos en el dominio; el signo se deriva con `montoFirmado`.
- Entidades con `toJSON()` y `desdeJSON()`.
- Operaciones de datos siempre asÃ­ncronas.
- Efectos de React que cargan datos usan promesas con guardas (`activo`) para cumplir `react-hooks/set-state-in-effect`.
- GrÃ¡ficos: contenedor con `ratio ratio-16x9` y `maintainAspectRatio: false`.

### Reparto de archivos

| Zona | Responsable | Regla |
| --- | --- | --- |
| `src/models`, `src/services`, `src/db`, `src/utils`, `src/config` | Capa de datos | Cambios coordinados y registrados en la bitÃ¡cora |
| `src/App.tsx`, `src/main.tsx`, `App.css`, `index.css` | Frontend | Reservado para el compaÃ±ero; **no tocar desde la demo** |
| `src/dev`, `demo.html` | DemostraciÃ³n | Solo desarrollo; no se incluye en el build |

---

## ðŸ§ª VerificaciÃ³n

```bash
npm run build   # tsc -b + vite build
npm run lint    # ESLint
npm test        # 75 comprobaciones de comportamiento
```

La prueba de humo (`scripts/smoke.mjs`) usa `fake-indexeddb` y `vite.ssrLoadModule` y cubre:

- registro, normalizaciÃ³n de correo y correo duplicado;
- 34 categorÃ­as base, cuenta inicial y saldo 0;
- CRUD de cuentas y transacciones, validaciÃ³n de tipo y monto;
- saldos con gastos, ingresos y transferencias;
- reportes, estado de resultados, flujo mensual y CSV;
- aislamiento entre dos usuarios (lectura y escritura);
- respaldo, importaciÃ³n con ids regenerados y reseteo;
- movimientos recurrentes: ocurrencias vencidas, idempotencia, reglas futuras sin movimientos, pausa/reanudaciÃ³n, fin de mes, respaldo/importaciÃ³n con remapeo y aislamiento entre usuarios;
- normalizaciÃ³n de errores de validaciÃ³n, sesiÃ³n, cuota de almacenamiento y fallos tÃ©cnicos;
- cambio de contraseÃ±a, recuperaciÃ³n con rotaciÃ³n de cÃ³digo y eliminaciÃ³n de cuenta.

El build de producciÃ³n genera `dist/manifest.webmanifest`, `dist/sw.js` y los iconos de la PWA, y **no incluye** `demo.html` ni `src/dev`. Para verificarlo:

```powershell
npm run build
Select-String -Path dist/sw.js -Pattern 'demo\.html|src/dev'   # sin coincidencias
```

La instalaciÃ³n y el modo offline se comprueban con `npm run preview` y DevTools â†’ Application â†’ Manifest y Service Workers.

---

## ðŸ—ºï¸ Pendientes (roadmap)

- [ ] Interfaz de producto en `App.tsx` (a cargo del compaÃ±ero de frontend).
- [x] Manifiesto PWA y service worker para instalaciÃ³n offline.
- [x] Presupuestos por categorÃ­a y alertas.
- [ ] EdiciÃ³n de movimientos desde la UI (el servicio ya la soporta).
- [ ] EdiciÃ³n de monto, categorÃ­a y frecuencia de reglas recurrentes desde la UI.
- [ ] Cifrado de la base local con frase de paso (opcional).
- [ ] SincronizaciÃ³n opcional con Supabase y RLS, si el cliente la pide mÃ¡s adelante.
- [ ] ExportaciÃ³n de reportes en otros formatos.

---

## ðŸ—“ï¸ BitÃ¡cora de cambios

| Fecha | Cambio | Archivos |
| --- | --- | --- |
| 2026-11-14 | InicializaciÃ³n del repositorio con plantilla Vite + React + TypeScript y Bootstrap instalado. | `package.json`, `src/main.tsx` |
| 2026-11-14 | README inicial con la visiÃ³n del gestor de finanzas personales. | `README.md` |
| 2026-11-14 | **Entrega 1 â€” capa de dominio y datos simulados.** Clases `Usuario`, `Categoria` y `Transaccion` con validaciones; tipos y DTOs; interfaz `FinanzasService`; `MockFinanzasService` con persistencia en `localStorage`, latencia simulada y copias defensivas; seed de 13 categorÃ­as y 39 transacciones relativas a la fecha actual; utilidades de formato para CRC y fechas; pÃ¡gina demo `/demo.html`. | `src/models/*`, `src/services/*`, `src/data/seed.ts`, `src/utils/*`, `src/config/mock.ts`, `src/dev/*`, `demo.html` |
| 2026-11-14 | README convertido en documento tÃ©cnico: arquitectura, modelo de datos, contrato del servicio, reglas de negocio, guÃ­a de consumo, persistencia, migraciÃ³n a Supabase, convenciones y bitÃ¡cora. | `README.md` |
| 2026-11-14 | Variables de entorno documentadas y credenciales excluidas del repositorio. | `.env.example`, `.gitignore` |
| 2026-11-15 | **Entrega 2 â€” MVP local-first.** Se instalan Dexie, Chart.js, jsPDF, jspdf-autotable y fake-indexeddb. Se reemplazan el mock, el seed y la configuraciÃ³n simulada por una base IndexedDB real con sesiÃ³n, aislamiento por usuario y credenciales PBKDF2. Se aÃ±aden cuentas, categorÃ­as jerÃ¡rquicas, transferencias, respaldos y reportes. | `package.json`, `src/config/app.ts`, `src/db/*`, `src/models/*`, `src/services/*` |
| 2026-11-15 | AutenticaciÃ³n local: registro abierto sin roles, login, cambio de contraseÃ±a, recuperaciÃ³n con cÃ³digo de 12 caracteres mostrado una vez y rotado al usarlo, y eliminaciÃ³n de cuenta. | `src/utils/criptografia.ts`, `src/services/LocalFinanzasService.ts`, `src/models/Usuario.ts` |
| 2026-11-15 | Reportes y exportaciones: estado de resultados, gastos por categorÃ­a, PDF con jsPDF/AutoTable, CSV y respaldo JSON con remapeo de ids al importar. | `src/utils/reportesPdf.ts`, `src/utils/descargas.ts`, `src/services/LocalFinanzasService.ts` |
| 2026-11-15 | Demo visual completa solo en `src/dev`: acceso, dashboard, movimientos, cuentas, categorÃ­as, reportes y mi cuenta, con navegaciÃ³n por estado y React Bootstrap. No se tocaron `App.tsx`, `main.tsx` ni los CSS. | `src/dev/*`, `demo.html` |
| 2026-11-15 | Prueba de humo automatizada (`npm test`) con 44 verificaciones sobre `fake-indexeddb`; se corrige la importaciÃ³n de respaldos para regenerar identificadores y remapear referencias. | `scripts/smoke.mjs`, `package.json`, `src/services/LocalFinanzasService.ts` |
| 2026-11-15 | README reescrito como documento tÃ©cnico del MVP local-first: arquitectura, seguridad, modelo, contrato v2, persistencia, demo y verificaciÃ³n. | `README.md` |
| 2026-11-15 | **Nivel B â€” manejo de errores en la demo.** Normalizador compartido (`normalizarError`), toasts de React Bootstrap, validaciÃ³n inline por campo, alertas con reintento para cargas fallidas y `ErrorBoundary`. El login usa un mensaje genÃ©rico para no revelar si el correo existe; las acciones destructivas conservan la confirmaciÃ³n. La prueba de humo sube de 44 a 48 comprobaciones. | `src/utils/errores.ts`, `src/dev/componentes/Notificaciones.tsx`, `notificacionesContexto.ts`, `useErroresFormulario.ts`, `ErrorBoundary.tsx`, `Estado.tsx`, `src/dev/pantallas/*`, `src/dev/DemoDatos.tsx`, `scripts/smoke.mjs`, `README.md` |
| 2026-11-15 | **Movimientos recurrentes.** Nueva entidad `Recurrencia` con frecuencias diaria, semanal y mensual; tabla Dexie v2, Ã­ndice `recurrenciaId` y migraciÃ³n sin pÃ©rdida de datos. El servicio crea reglas, genera ocurrencias vencidas hasta hoy (nunca futuras), recupera atrasos al iniciar sesiÃ³n, evita duplicados con avance atÃ³mico de `proximaFecha` y conserva el historial al pausar o eliminar. Fin de mes anclado al dÃ­a original. Respaldos v2 con retrocompatibilidad v1. UI en Movimientos: casilla â€œRepetirâ€, fecha final opcional y tarjeta de reglas con pausar/reanudar/eliminar. La prueba de humo sube de 48 a 75 comprobaciones. | `src/models/Recurrencia.ts`, `tipos.ts`, `Transaccion.ts`, `index.ts`, `src/utils/recurrencia.ts`, `formato.ts`, `src/db/baseDatos.ts`, `src/config/app.ts`, `src/services/*`, `src/dev/pantallas/Movimientos.tsx`, `src/dev/componentes/TablaRecurrencias.tsx`, `src/dev/DemoDatos.tsx`, `scripts/smoke.mjs`, `README.md` |
| 2026-11-16 | **PWA offline e instalable.** Se instala `vite-plugin-pwa` 2 y se configura `VitePWA` con `registerType: 'autoUpdate'`, precache de JS/CSS/HTML/ICO/PNG/SVG/WOFF2, `cleanupOutdatedCaches` y `navigateFallback` al `index.html`. Manifiesto FinTrack en modo `standalone` con `theme_color: #0d6efd` e iconos de 192 y 512 px. El registro del service worker se inyecta automÃ¡ticamente, sin tocar `main.tsx`. Se aÃ±aden los iconos PNG generados por `scripts/generar-iconos.mjs` (sin dependencias) y en `index.html` el `theme-color` y el `apple-touch-icon`. El build produce `manifest.webmanifest` y `sw.js` sin incluir `demo.html` ni `src/dev`; build, lint y 75 pruebas en verde. | `package.json`, `package-lock.json`, `vite.config.ts`, `index.html`, `public/pwa-192x192.png`, `public/pwa-512x512.png`, `scripts/generar-iconos.mjs`, `README.md` |
| 2026-11-16 | **Sistema híbrido de control de gastos y presupuestos.** Entidad Presupuesto con validaciones y serialización. Esquema Dexie v3 con tabla presupuestos e índices compuestos. CRUD de presupuestos con cálculo de consumo acumulado por jerarquía (subcategorías) y clasificación de estados (
ormal, dvertencia, excedido). Alerta automática por concentración de gasto (>= 30% del gasto total). Meta de ahorro mensual en configuración y progreso en tiempo real. Soporte completo en respaldos v3 con retrocompatibilidad v1/v2. En UI: Alertas de consumo y progreso en Dashboard, gestión de presupuestos en Categorías y meta de ahorro en Mi Cuenta. Pruebas de humo suben a 91 verificaciones. | src/models/*, src/db/*, src/services/*, src/dev/*, scripts/smoke.mjs, README.md |
