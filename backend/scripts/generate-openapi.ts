/**
 * Generador del catálogo de APIs de GOYA → `docs/api/openapi.json` (OpenAPI 3.1).
 *
 * Correr desde la raíz del repo:  pnpm docs:api
 *
 * Dos fuentes, un solo documento:
 *
 *   1) BACKEND NestJS (`backend/src`): se construye el AppModule EN MEMORIA con
 *      NestFactory.create() —logger apagado, sin app.listen()— y se le pide el
 *      documento a SwaggerModule.createDocument(). No se levanta ningún puerto.
 *      Tampoco se abre conexión a Postgres: PrismaService conecta recién en
 *      onModuleInit, hook que sólo dispara app.init() (que acá nunca se llama).
 *
 *   2) FRONT Next (`src/app/api`): los route handlers no tienen decoradores, así
 *      que se escanean en forma estática: el path sale de la estructura de
 *      carpetas y los métodos de los `export async function GET|POST|...`.
 *
 * El documento se escribe ordenado alfabéticamente y sin timestamps para que
 * dos corridas seguidas produzcan bytes idénticos (el JSON se versiona).
 *
 * Se corre con el ts-node del workspace `backend` y no con tsx: esbuild no
 * emite `emitDecoratorMetadata` y sin esa metadata la inyección de Nest rompe.
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

const RAIZ_REPO = path.resolve(__dirname, '..', '..');
const DIR_SALIDA = path.join(RAIZ_REPO, 'docs', 'api');
const ARCHIVO_SALIDA = path.join(DIR_SALIDA, 'openapi.json');
const DIR_API_FRONT = path.join(RAIZ_REPO, 'src', 'app', 'api');

const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;
type Metodo = (typeof METODOS)[number];

// ---------------------------------------------------------------------------
// 1) Backend NestJS
// ---------------------------------------------------------------------------

async function documentoNest(): Promise<Record<string, any>> {
  // `logger: false` para que el arranque no ensucie la salida del script.
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });

  // Mismo prefijo global que backend/src/main.ts, para que los paths del
  // documento sean los reales (`/api/...`).
  app.setGlobalPrefix('api');

  // Espejo del DocumentBuilder de backend/src/main.ts. Lo único que se agrega
  // es setOpenAPIVersion('3.1.0') — main.ts sirve el Swagger vivo en 3.0 y no
  // se toca; el archivo versionado sí sale en 3.1 como pide el diseño.
  const config = new DocumentBuilder()
    .setTitle('Riogas Gestión API')
    .setDescription('API Backend para el sistema de gestión Riogas')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('health', 'Health check')
    .addTag('clientes', 'Gestión de clientes')
    .addTag('zonas', 'Gestión de zonas')
    .addTag('usuarios', 'Gestión de usuarios')
    .setOpenAPIVersion('3.1.0')
    .build();

  const documento = SwaggerModule.createDocument(app, config) as unknown as Record<string, any>;
  await app.close();
  return documento;
}

// ---------------------------------------------------------------------------
// 2) Route handlers del front (escaneo estático)
// ---------------------------------------------------------------------------

type HandlerFront = {
  ruta: string; // path OpenAPI, p.ej. /api/sorteos-descarga/{path}
  metodos: Metodo[];
  descripcion: string;
  auth: string;
  archivo: string; // relativo a la raíz del repo
  parametros: Array<{ nombre: string; catchAll: boolean }>;
};

function listarRouteTs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const salida: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...listarRouteTs(completo));
    else if (entrada.name === 'route.ts' || entrada.name === 'route.tsx') salida.push(completo);
  }
  return salida.sort();
}

/** `src/app/api/sorteos-descarga/[...path]/route.ts` → `/api/sorteos-descarga/{path}` */
function rutaDesdeArchivo(archivo: string) {
  const rel = path.relative(DIR_API_FRONT, path.dirname(archivo)).split(path.sep).filter(Boolean);
  const parametros: HandlerFront['parametros'] = [];
  const segmentos = rel.map((seg) => {
    const catchAll = /^\[\.\.\..+\]$/.test(seg);
    const dinamico = catchAll || /^\[.+\]$/.test(seg);
    if (!dinamico) return seg;
    const nombre = seg.replace(/^\[\.*/, '').replace(/\]$/, '');
    parametros.push({ nombre, catchAll });
    return `{${nombre}}`;
  });
  return { ruta: '/api/' + segmentos.join('/'), parametros };
}

/** Comentario de cabecera del archivo (`//` o `/** *\/`) como descripción. */
function descripcionDeCabecera(fuente: string): string {
  const lineas = fuente.split(/\r?\n/);
  const acumulado: string[] = [];
  let enBloque = false;
  for (const linea of lineas) {
    const t = linea.trim();
    if (!enBloque && t.startsWith('/*')) enBloque = true;
    if (enBloque) {
      acumulado.push(t.replace(/^\/\*+/, '').replace(/\*+\/$/, '').replace(/^\*\s?/, ''));
      if (t.endsWith('*/')) break;
      continue;
    }
    if (t.startsWith('//')) {
      acumulado.push(t.replace(/^\/\/\s?/, ''));
      continue;
    }
    if (t === '') {
      if (acumulado.length) break;
      continue;
    }
    break;
  }
  return acumulado.join('\n').trim();
}

/**
 * Autenticación inferida por heurística de texto — el front no la declara en
 * ningún lado. Sirve como punto de partida; el valor definitivo se pisa desde
 * `docs/api/anotaciones.yaml`.
 */
function authInferida(fuente: string): string {
  if (/x-api-key/i.test(fuente)) return 'x-api-key';
  if (/cookies\.get\(["'`]token["'`]\)/.test(fuente) || /Bearer \$\{token\}/.test(fuente)) {
    return 'JWT (cookie token)';
  }
  if (/authorization/i.test(fuente)) return 'JWT (Bearer)';
  return 'ninguna';
}

function handlersFront(): HandlerFront[] {
  return listarRouteTs(DIR_API_FRONT).map((archivo) => {
    const fuente = fs.readFileSync(archivo, 'utf8');
    const metodos = METODOS.filter((m) =>
      new RegExp(`export\\s+(async\\s+)?function\\s+${m.toUpperCase()}\\b`).test(fuente),
    );
    const { ruta, parametros } = rutaDesdeArchivo(archivo);
    return {
      ruta,
      metodos,
      descripcion: descripcionDeCabecera(fuente),
      auth: authInferida(fuente),
      archivo: path.relative(RAIZ_REPO, archivo).split(path.sep).join('/'),
      parametros,
    };
  });
}

function pathsFront(handlers: HandlerFront[]): Record<string, any> {
  const paths: Record<string, any> = {};
  for (const h of handlers) {
    const item: Record<string, any> = {};
    // Módulo = primer segmento después de /api. Si es dinámico, es el catch-all
    // que hace de proxy hacia GeneXus/NestJS.
    const primerSegmento = h.ruta.split('/')[2] ?? 'raiz';
    const tag = `front:${primerSegmento.startsWith('{') ? 'proxy' : primerSegmento}`;
    for (const metodo of h.metodos) {
      item[metodo] = {
        tags: [tag],
        summary: h.descripcion.split('\n')[0] || `${metodo.toUpperCase()} ${h.ruta}`,
        description: h.descripcion,
        parameters: h.parametros.map((p) => ({
          name: p.nombre,
          in: 'path',
          required: true,
          description: p.catchAll ? 'Segmentos restantes de la ruta (catch-all)' : undefined,
          schema: { type: 'string' },
        })),
        responses: { default: { description: 'Ver el handler' } },
        'x-goya-origen': 'front (Next route handler)',
        'x-goya-archivo': h.archivo,
        'x-goya-auth': h.auth,
      };
    }
    paths[h.ruta] = item;
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Armado del documento final
// ---------------------------------------------------------------------------

/** Auth declarada del lado Nest: sale del `security` que agrega @ApiBearerAuth. */
function authNest(operacion: any, documento: any): string {
  const sec = operacion?.security ?? documento?.security;
  if (Array.isArray(sec) && sec.length > 0) {
    const nombres = sec.flatMap((s: Record<string, unknown>) => Object.keys(s ?? {}));
    if (nombres.includes('bearer')) return 'JWT (Bearer)';
    if (nombres.length) return nombres.join(', ');
  }
  return 'sin declarar';
}

function ordenarPorClave<T>(obj: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const nest = await documentoNest();
  const front = handlersFront();

  // Marcar origen + auth en cada operación del backend.
  for (const item of Object.values(nest.paths ?? {}) as any[]) {
    for (const metodo of METODOS) {
      const op = item?.[metodo];
      if (!op) continue;
      op['x-goya-origen'] = 'backend (NestJS)';
      op['x-goya-auth'] = authNest(op, nest);
    }
  }

  // Merge a nivel operación, no a nivel path: `/api/health` existe en los dos
  // lados (el del front es el healthcheck del contenedor Next). Pisar el path
  // item entero perdería la operación del backend, y OpenAPI no admite dos
  // operaciones con el mismo método y path — se conserva la del backend y la
  // del front queda anotada en `x-goya-tambien-en-front`.
  const paths: Record<string, any> = { ...(nest.paths ?? {}) };
  for (const [ruta, itemFront] of Object.entries(pathsFront(front))) {
    if (!paths[ruta]) {
      paths[ruta] = itemFront;
      continue;
    }
    for (const [metodo, opFront] of Object.entries(itemFront as Record<string, any>)) {
      const opBackend = paths[ruta][metodo];
      if (!opBackend) {
        paths[ruta][metodo] = opFront;
        continue;
      }
      opBackend['x-goya-tambien-en-front'] = {
        archivo: opFront['x-goya-archivo'],
        auth: opFront['x-goya-auth'],
        descripcion: opFront.description,
      };
    }
  }

  const documento = {
    ...nest,
    openapi: '3.1.0',
    info: {
      ...nest.info,
      description:
        'Catálogo de APIs de GOYA (app 3). Backend NestJS (prefijo /api) + route handlers del front Next.\n' +
        'Generado por `pnpm docs:api`; no editar a mano — las descripciones y ejemplos van en docs/api/anotaciones.yaml.',
    },
    paths: ordenarPorClave(paths),
    'x-goya-generador': 'backend/scripts/generate-openapi.ts',
  };

  let total = 0;
  let deFront = 0;
  for (const item of Object.values(paths) as any[]) {
    for (const metodo of METODOS) {
      if (!item?.[metodo]) continue;
      total += 1;
      if (String(item[metodo]['x-goya-origen'] ?? '').startsWith('front')) deFront += 1;
    }
  }

  fs.mkdirSync(DIR_SALIDA, { recursive: true });
  fs.writeFileSync(ARCHIVO_SALIDA, JSON.stringify(documento, null, 2) + '\n', 'utf8');

  console.log('openapi.json escrito en docs/api/openapi.json');
  console.log(`  rutas:       ${Object.keys(paths).length}`);
  console.log(`  operaciones: ${total} (backend ${total - deFront} / front ${deFront})`);
  console.log(`  handlers del front escaneados: ${front.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falló la generación del openapi.json:', err);
    process.exit(1);
  });
