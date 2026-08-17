/**
 * Generador del catálogo de APIs de GOYA → `docs/api/openapi.json` (OpenAPI 3.1).
 *
 * Correr desde la raíz del repo:  pnpm docs:api
 *
 * PARSER ESTÁTICO, NO ARRANQUE DE LA APP
 * --------------------------------------
 * La versión anterior levantaba el AppModule con NestFactory por ts-node para
 * pedirle el documento a @nestjs/swagger. Eso ataba el catálogo entero a que
 * TODO backend/src compilara: un error de tipos en un módulo cualquiera dejaba
 * al repo sin catálogo (pasó con backend/src/mostrador/). Ahora el documento se
 * arma leyendo el AST con ts-morph:
 *
 *   - No se ejecuta nada del backend. No hay DI, ni Prisma, ni puerto, ni
 *     `emitDecoratorMetadata`: un módulo roto no puede romper la generación.
 *   - Se corre con `tsx` desde la raíz (ts-morph es dependencia del workspace
 *     raíz). El workspace `backend` ya no participa.
 *
 * De yapa sale un documento MEJOR que el que producía Swagger, porque el
 * backend no tiene un solo `@ApiProperty` ni el plugin del CLI de Nest: los 23
 * schemas que generaba salían vacíos (`properties: {}`) y ninguna operación
 * declaraba query params. Acá los tipos y las restricciones se leen del código
 * (tipo TS + decoradores de class-validator).
 *
 * Tres fuentes, un solo documento:
 *
 *   1) CONTROLLERS de Nest (`backend/src/**\/*.controller.ts`): @Controller +
 *      @Get/@Post/…, params (@Param/@Query/@Headers), body (@Body), guards
 *      (@UseGuards) y descripciones (@ApiOperation → JSDoc → comentario `//`).
 *   2) DTOs referenciados desde los controllers: se resuelven por nombre en
 *      todo backend/src, incluidos los mapped types de @nestjs/swagger
 *      (PartialType / OmitType / PickType).
 *   3) ROUTE HANDLERS del front Next (`src/app/api/**\/route.ts`): el path sale
 *      de la estructura de carpetas y los métodos de los `export async function`.
 *
 * El documento se escribe ordenado alfabéticamente y sin timestamps para que
 * dos corridas seguidas produzcan bytes idénticos (el JSON se versiona).
 *
 * Flags:
 *   --excluir=<texto>   omite los archivos cuyo path relativo contenga <texto>.
 *                       Repetible. También por env DOCS_API_EXCLUIR=a,b.
 *                       Sirve para módulos que todavía no están en el repo.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ClassDeclaration,
  Decorator,
  MethodDeclaration,
  Node,
  ObjectLiteralExpression,
  ParameterDeclaration,
  Project,
  PropertyDeclaration,
  SyntaxKind,
} from 'ts-morph';

const RAIZ_REPO = path.resolve(__dirname, '..', '..');
const DIR_SALIDA = path.join(RAIZ_REPO, 'docs', 'api');
const ARCHIVO_SALIDA = path.join(DIR_SALIDA, 'openapi.json');
const DIR_SRC_BACKEND = path.join(RAIZ_REPO, 'backend', 'src');
const DIR_API_FRONT = path.join(RAIZ_REPO, 'src', 'app', 'api');

const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;
type Metodo = (typeof METODOS)[number];

/** Decoradores de ruta de Nest → método HTTP. */
const DECORADORES_RUTA: Record<string, Metodo> = {
  Get: 'get',
  Post: 'post',
  Put: 'put',
  Patch: 'patch',
  Delete: 'delete',
  Head: 'head',
  Options: 'options',
};

/** Descripciones de tags que traía el DocumentBuilder de backend/src/main.ts. */
const DESCRIPCIONES_TAG: Record<string, string> = {
  health: 'Health check',
  clientes: 'Gestión de clientes',
  zonas: 'Gestión de zonas',
  usuarios: 'Gestión de usuarios',
};

type Json = Record<string, any>;

// ---------------------------------------------------------------------------
// Exclusiones
// ---------------------------------------------------------------------------

function exclusiones(): string[] {
  const deCli = process.argv
    .slice(2)
    .flatMap((arg, i, todos) => {
      if (arg.startsWith('--excluir=')) return [arg.slice('--excluir='.length)];
      if (arg === '--excluir' && todos[i + 1]) return [todos[i + 1]];
      return [];
    })
    .filter(Boolean);
  const deEnv = (process.env.DOCS_API_EXCLUIR ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...deCli, ...deEnv];
}

const EXCLUIDOS = exclusiones();

/** Path relativo a la raíz del repo, siempre con `/`. */
function relativo(archivo: string): string {
  return path.relative(RAIZ_REPO, archivo).split(path.sep).join('/');
}

function excluido(archivo: string): boolean {
  const rel = relativo(archivo);
  return EXCLUIDOS.some((patron) => rel.includes(patron));
}

// ---------------------------------------------------------------------------
// Proyecto ts-morph — sólo sintaxis, nunca el type checker
// ---------------------------------------------------------------------------

const proyecto = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
  skipLoadingLibFiles: true,
  compilerOptions: { allowJs: false },
});

proyecto.addSourceFilesAtPaths([
  `${DIR_SRC_BACKEND.split(path.sep).join('/')}/**/*.ts`,
  `!${DIR_SRC_BACKEND.split(path.sep).join('/')}/**/*.spec.ts`,
]);

/** Índice global de clases y de constantes, para resolver DTOs y enums por nombre. */
const clasesPorNombre = new Map<string, ClassDeclaration>();
const arraysConstPorNombre = new Map<string, string[]>();

for (const sf of proyecto.getSourceFiles()) {
  if (excluido(sf.getFilePath())) continue;
  for (const cls of sf.getClasses()) {
    const nombre = cls.getName();
    if (nombre && !clasesPorNombre.has(nombre)) clasesPorNombre.set(nombre, cls);
  }
  for (const decl of sf.getVariableDeclarations()) {
    const arr = decl.getInitializer()?.asKind(SyntaxKind.ArrayLiteralExpression);
    if (!arr) continue;
    const valores = arr
      .getElements()
      .map((e) => e.asKind(SyntaxKind.StringLiteral)?.getLiteralValue())
      .filter((v): v is string => typeof v === 'string');
    if (valores.length) arraysConstPorNombre.set(decl.getName(), valores);
  }
}

// ---------------------------------------------------------------------------
// Helpers de decoradores / comentarios
// ---------------------------------------------------------------------------

function decoradorDe(nodo: { getDecorators(): Decorator[] }, nombre: string): Decorator | undefined {
  return nodo.getDecorators().find((d) => d.getName() === nombre);
}

/** Valor de un argumento string literal (`'x'` o `` `x` ``). */
function argString(dec: Decorator | undefined, indice = 0): string | undefined {
  const arg = dec?.getArguments()[indice];
  if (!arg) return undefined;
  return (
    arg.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ??
    arg.asKind(SyntaxKind.NoSubstitutionTemplateLiteral)?.getLiteralValue()
  );
}

function argNumero(dec: Decorator | undefined, indice = 0): number | undefined {
  const arg = dec?.getArguments()[indice];
  const n = arg?.asKind(SyntaxKind.NumericLiteral)?.getLiteralValue();
  return typeof n === 'number' ? n : undefined;
}

function argObjeto(dec: Decorator | undefined, indice = 0): ObjectLiteralExpression | undefined {
  return dec?.getArguments()[indice]?.asKind(SyntaxKind.ObjectLiteralExpression);
}

function propString(obj: ObjectLiteralExpression | undefined, nombre: string): string | undefined {
  const inicial = obj?.getProperty(nombre)?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
  if (!inicial) return undefined;
  return (
    inicial.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ??
    inicial.asKind(SyntaxKind.NoSubstitutionTemplateLiteral)?.getLiteralValue()
  );
}

function propNumero(obj: ObjectLiteralExpression | undefined, nombre: string): number | undefined {
  const inicial = obj?.getProperty(nombre)?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
  const n = inicial?.asKind(SyntaxKind.NumericLiteral)?.getLiteralValue();
  return typeof n === 'number' ? n : undefined;
}

/** Lista de strings de un argumento: `['a','b']` o el nombre de un const array. */
function listaDeStrings(nodo: Node | undefined): string[] | undefined {
  if (!nodo) return undefined;
  const sinAssertion = Node.isAsExpression(nodo) ? nodo.getExpression() : nodo;
  const arr = sinAssertion.asKind(SyntaxKind.ArrayLiteralExpression);
  if (arr) {
    const valores = arr
      .getElements()
      .map((e) => e.asKind(SyntaxKind.StringLiteral)?.getLiteralValue())
      .filter((v): v is string => typeof v === 'string');
    return valores.length ? valores : undefined;
  }
  const ident = sinAssertion.asKind(SyntaxKind.Identifier);
  if (ident) return arraysConstPorNombre.get(ident.getText());
  return undefined;
}

/** Descarta separadores decorativos del tipo `// ── CRUD ──────`. */
function esSeparador(texto: string): boolean {
  const limpio = texto.replace(/[─═\-=~_*·.]/g, '').trim();
  return limpio.length === 0;
}

/**
 * Docblock del miembro: JSDoc (`/** … *\/`) o, si no hay, el bloque de líneas
 * `//` INMEDIATAMENTE encima (sin línea en blanco de por medio, para no robarse
 * el comentario de sección que agrupa varios métodos).
 */
function docblock(nodo: MethodDeclaration | PropertyDeclaration | ClassDeclaration): string {
  const jsdocs = nodo.getJsDocs();
  if (jsdocs.length) {
    const texto = jsdocs[jsdocs.length - 1].getDescription().trim();
    if (texto) return texto;
  }

  const sf = nodo.getSourceFile();
  const rangos = nodo.getLeadingCommentRanges().filter((r) => r.getText().startsWith('//'));
  if (!rangos.length) return '';

  const lineaNodo = sf.getLineAndColumnAtPos(nodo.getStart(false)).line;
  const lineas: string[] = [];
  // De abajo hacia arriba: sólo comentarios contiguos y pegados al miembro.
  let lineaEsperada = lineaNodo - 1;
  for (let i = rangos.length - 1; i >= 0; i--) {
    const rango = rangos[i];
    const linea = sf.getLineAndColumnAtPos(rango.getPos()).line;
    if (linea !== lineaEsperada) break;
    const texto = rango.getText().replace(/^\/\/\s?/, '').trimEnd();
    if (esSeparador(texto)) break;
    lineas.unshift(texto);
    lineaEsperada = linea - 1;
  }
  return lineas.join('\n').trim();
}

/** Primera línea del docblock — es lo que va como `summary`. */
function primeraLinea(texto: string): string {
  return texto.split('\n')[0]?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Schemas: DTOs → components.schemas
// ---------------------------------------------------------------------------

const schemas: Record<string, Json> = {};
const pendientes: string[] = [];

function encolarSchema(nombre: string): string {
  if (!(nombre in schemas) && !pendientes.includes(nombre)) pendientes.push(nombre);
  return `#/components/schemas/${nombre}`;
}

const PRIMITIVOS: Record<string, Json> = {
  string: { type: 'string' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  Date: { type: 'string', format: 'date-time' },
  any: {},
  unknown: {},
  object: { type: 'object' },
};

/** Tipo TS escrito en el código → schema JSON. Sin type checker: puro texto. */
function esquemaDeTipo(textoTipo: string | undefined): Json {
  if (!textoTipo) return {};
  let t = textoTipo.trim();

  // `X | null` / `X | undefined` → X
  const alternativas = t
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'null' && s !== 'undefined');
  if (alternativas.length === 1) t = alternativas[0];
  else if (alternativas.length > 1) {
    // Unión de literales de string → enum
    const literales = alternativas
      .map((s) => s.match(/^'(.*)'$/)?.[1] ?? s.match(/^"(.*)"$/)?.[1])
      .filter((v): v is string => typeof v === 'string');
    if (literales.length === alternativas.length) return { type: 'string', enum: literales };
    return { 'x-goya-tipo': textoTipo };
  }

  if (t.endsWith('[]')) return { type: 'array', items: esquemaDeTipo(t.slice(0, -2)) };
  const arrayGenerico = t.match(/^Array<(.+)>$/);
  if (arrayGenerico) return { type: 'array', items: esquemaDeTipo(arrayGenerico[1]) };

  const literal = t.match(/^'(.*)'$/) ?? t.match(/^"(.*)"$/);
  if (literal) return { type: 'string', enum: [literal[1]] };

  if (t in PRIMITIVOS) return { ...PRIMITIVOS[t] };
  if (t.startsWith('Record<') || t.startsWith('{')) return { type: 'object' };

  if (clasesPorNombre.has(t)) return { $ref: encolarSchema(t) };
  return { 'x-goya-tipo': t };
}

/** Restricciones que aportan los decoradores de class-validator. */
function aplicarValidadores(prop: PropertyDeclaration, schema: Json): { requerido: boolean } {
  let requerido = !prop.hasQuestionToken();

  for (const dec of prop.getDecorators()) {
    const nombre = dec.getName();
    switch (nombre) {
      case 'IsOptional':
        requerido = false;
        break;
      case 'IsInt':
        schema.type = 'integer';
        break;
      case 'IsNumber':
        if (!schema.type) schema.type = 'number';
        break;
      case 'IsString':
        if (!schema.type) schema.type = 'string';
        break;
      case 'IsBoolean':
        if (!schema.type) schema.type = 'boolean';
        break;
      case 'IsArray':
        if (schema.type !== 'array') schema.type = 'array';
        break;
      case 'IsEmail':
        schema.type = 'string';
        schema.format = 'email';
        break;
      case 'IsUrl':
        schema.type = 'string';
        schema.format = 'uri';
        break;
      case 'IsDateString':
        schema.type = 'string';
        schema.format = 'date-time';
        break;
      case 'IsLatitude':
      case 'IsLongitude':
        schema.type = 'number';
        break;
      case 'MaxLength':
        schema.maxLength = argNumero(dec) ?? schema.maxLength;
        break;
      case 'MinLength':
        schema.minLength = argNumero(dec) ?? schema.minLength;
        break;
      case 'Length': {
        const min = argNumero(dec, 0);
        const max = argNumero(dec, 1);
        if (min !== undefined) schema.minLength = min;
        if (max !== undefined) schema.maxLength = max;
        break;
      }
      case 'Min':
        schema.minimum = argNumero(dec) ?? schema.minimum;
        break;
      case 'Max':
        schema.maximum = argNumero(dec) ?? schema.maximum;
        break;
      case 'ArrayMinSize':
        schema.minItems = argNumero(dec) ?? schema.minItems;
        break;
      case 'ArrayMaxSize':
        schema.maxItems = argNumero(dec) ?? schema.maxItems;
        break;
      case 'Matches': {
        const regex = dec.getArguments()[0]?.asKind(SyntaxKind.RegularExpressionLiteral)?.getText();
        if (regex) schema.pattern = regex.replace(/^\//, '').replace(/\/[gimsuy]*$/, '');
        break;
      }
      case 'IsIn': {
        const valores = listaDeStrings(dec.getArguments()[0]);
        if (!valores) break;
        // `@IsIn(X, { each: true })` valida CADA elemento del array.
        const cadaUno = argObjeto(dec, 1)?.getProperty('each') !== undefined;
        if (cadaUno || schema.type === 'array') {
          schema.type = 'array';
          schema.items = { ...(schema.items ?? {}), type: 'string', enum: valores };
        } else {
          schema.type = 'string';
          schema.enum = valores;
        }
        break;
      }
      case 'Type': {
        // `@Type(() => PuntoPoligonoDto)` es la pista del tipo de los elementos.
        const flecha = dec.getArguments()[0]?.asKind(SyntaxKind.ArrowFunction);
        const nombreTipo = flecha?.getBody().getText();
        if (nombreTipo && clasesPorNombre.has(nombreTipo)) {
          const ref = { $ref: encolarSchema(nombreTipo) };
          if (schema.type === 'array') schema.items = ref;
        }
        break;
      }
      default:
        break;
    }
  }

  return { requerido };
}

/**
 * Resuelve `extends PartialType(OmitType(Base, ['a'] as const))` y compañía.
 * Devuelve las props heredadas ya transformadas.
 */
function propsHeredadas(cls: ClassDeclaration): { schema: Json; todoOpcional: boolean } | null {
  const clausula = cls.getExtends();
  if (!clausula) return null;

  const expr = clausula.getExpression();
  const llamada = expr.asKind(SyntaxKind.CallExpression);
  if (!llamada) {
    // `extends OtraClase` a secas
    const nombre = expr.getText();
    const base = clasesPorNombre.get(nombre);
    return base ? { schema: schemaDeClase(base), todoOpcional: false } : null;
  }

  const helper = llamada.getExpression().getText();
  const args = llamada.getArguments();
  const interior = args[0];
  if (!interior) return null;

  const anidado = interior.asKind(SyntaxKind.CallExpression);
  let base: Json | null = null;
  let todoOpcional = helper === 'PartialType';

  if (anidado) {
    const claseInterior = clasesPorNombre.get(anidado.getArguments()[0]?.getText() ?? '');
    if (!claseInterior) return null;
    base = schemaDeClase(claseInterior);
    base = aplicarHelper(anidado.getExpression().getText(), base, anidado.getArguments()[1]);
  } else {
    const claseBase = clasesPorNombre.get(interior.getText());
    if (!claseBase) return null;
    base = schemaDeClase(claseBase);
  }

  base = aplicarHelper(helper, base, args[1]);
  if (helper === 'PartialType') todoOpcional = true;
  return { schema: base, todoOpcional };
}

function aplicarHelper(helper: string, schema: Json, listaNodo: Node | undefined): Json {
  const lista = listaDeStrings(listaNodo) ?? [];
  const props: Json = { ...(schema.properties ?? {}) };
  let requeridos: string[] = Array.isArray(schema.required) ? [...schema.required] : [];

  if (helper === 'OmitType' && lista.length) {
    for (const k of lista) delete props[k];
    requeridos = requeridos.filter((k) => !lista.includes(k));
  }
  if (helper === 'PickType' && lista.length) {
    for (const k of Object.keys(props)) if (!lista.includes(k)) delete props[k];
    requeridos = requeridos.filter((k) => lista.includes(k));
  }
  if (helper === 'PartialType') requeridos = [];

  const salida: Json = { type: 'object', properties: props };
  if (requeridos.length) salida.required = requeridos;
  return salida;
}

function schemaDeClase(cls: ClassDeclaration): Json {
  const heredado = propsHeredadas(cls);
  const properties: Json = { ...(heredado?.schema?.properties ?? {}) };
  const requeridos = new Set<string>(
    heredado && !heredado.todoOpcional && Array.isArray(heredado.schema.required)
      ? heredado.schema.required
      : [],
  );

  for (const prop of cls.getProperties()) {
    if (prop.hasModifier(SyntaxKind.PrivateKeyword) || prop.isStatic()) continue;
    const nombre = prop.getName();
    const schema = esquemaDeTipo(prop.getTypeNode()?.getText());
    const { requerido } = aplicarValidadores(prop, schema);
    const desc = docblock(prop);
    if (desc) schema.description = desc;
    properties[nombre] = schema;
    if (requerido) requeridos.add(nombre);
    else requeridos.delete(nombre);
  }

  const salida: Json = { type: 'object', properties };
  if (requeridos.size) salida.required = Array.from(requeridos).sort();
  const doc = docblock(cls);
  if (doc) salida.description = doc;
  return salida;
}

/** Procesa la cola de DTOs referenciados hasta que no queden. */
function resolverSchemasPendientes(): void {
  while (pendientes.length) {
    const nombre = pendientes.shift() as string;
    if (nombre in schemas) continue;
    const cls = clasesPorNombre.get(nombre);
    // Se reserva el lugar antes de recorrer, por si el DTO se referencia a sí mismo.
    schemas[nombre] = { type: 'object' };
    schemas[nombre] = cls ? schemaDeClase(cls) : { type: 'object', 'x-goya-sin-resolver': nombre };
  }
}

// ---------------------------------------------------------------------------
// Controllers de Nest
// ---------------------------------------------------------------------------

/** Auth deducida de los guards del controller/método. */
function authDeGuards(guards: string[]): string {
  const relevantes = guards.filter((g) => !/Throttler/i.test(g));
  if (!relevantes.length) return 'ninguna (sin guard)';
  const partes = relevantes.map((g) => {
    if (g === 'AuthGuard') return 'JWT (Bearer)';
    if (/ApiKey/i.test(g)) return `x-api-key (${g})`;
    return `guard ${g}`;
  });
  return Array.from(new Set(partes)).join(' + ');
}

function guardsDe(nodo: { getDecorators(): Decorator[] }): string[] {
  const dec = decoradorDe(nodo, 'UseGuards');
  if (!dec) return [];
  return dec.getArguments().map((a) => a.getText());
}

/** `clientes/:id/direcciones` + `:dirId` → `/api/clientes/{id}/direcciones/{dirId}` */
function unirPath(base: string, sub: string): string {
  const segmentos = [...base.split('/'), ...sub.split('/')].map((s) => s.trim()).filter(Boolean);
  const ruta = '/api' + (segmentos.length ? '/' + segmentos.join('/') : '');
  return ruta.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

interface OperacionNest {
  ruta: string;
  metodo: Metodo;
  operacion: Json;
}

function parametrosYBody(metodo: MethodDeclaration, ruta: string): {
  parameters: Json[];
  requestBody?: Json;
} {
  const parameters: Json[] = [];
  let requestBody: Json | undefined;
  const declaradosEnPath = new Set(
    Array.from(ruta.matchAll(/\{([^}]+)\}/g)).map((m) => m[1]),
  );
  const cubiertos = new Set<string>();

  for (const p of metodo.getParameters() as ParameterDeclaration[]) {
    for (const dec of p.getDecorators()) {
      const nombreDec = dec.getName();
      const clave = argString(dec);
      const tipo = p.getTypeNode()?.getText();

      if (nombreDec === 'Param') {
        if (!clave) continue;
        const pipeInt = dec.getArguments().some((a) => /ParseIntPipe/.test(a.getText()));
        parameters.push({
          name: clave,
          in: 'path',
          required: true,
          schema: pipeInt ? { type: 'integer' } : { type: 'string' },
        });
        cubiertos.add(clave);
      } else if (nombreDec === 'Query') {
        if (clave) {
          parameters.push({
            name: clave,
            in: 'query',
            required: !p.hasQuestionToken(),
            schema: esquemaDeTipo(tipo),
          });
          continue;
        }
        // `@Query() q: AlgunDto` → cada propiedad del DTO es un query param.
        const cls = tipo ? clasesPorNombre.get(tipo) : undefined;
        if (!cls) {
          if (tipo) parameters.push({ name: 'query', in: 'query', schema: esquemaDeTipo(tipo) });
          continue;
        }
        const schema = schemaDeClase(cls);
        const requeridos: string[] = Array.isArray(schema.required) ? schema.required : [];
        for (const [nombreProp, esquemaProp] of Object.entries(schema.properties ?? {})) {
          // La descripción sube al parámetro; no se repite adentro del schema.
          const { description, ...soloSchema } = (esquemaProp ?? {}) as Json;
          const entrada: Json = {
            name: nombreProp,
            in: 'query',
            required: requeridos.includes(nombreProp),
            schema: soloSchema,
          };
          if (description) entrada.description = description;
          parameters.push(entrada);
        }
      } else if (nombreDec === 'Headers') {
        if (!clave) continue;
        parameters.push({
          name: clave,
          in: 'header',
          required: !p.hasQuestionToken(),
          schema: { type: 'string' },
        });
      } else if (nombreDec === 'Body') {
        const schema = clave
          ? { type: 'object', properties: { [clave]: esquemaDeTipo(tipo) } }
          : esquemaDeTipo(tipo);
        requestBody = {
          required: !p.hasQuestionToken(),
          content: { 'application/json': { schema } },
        };
      }
    }
  }

  // Todo `{param}` del path tiene que estar declarado, lo tome o no el método.
  for (const nombre of declaradosEnPath) {
    if (cubiertos.has(nombre)) continue;
    parameters.push({ name: nombre, in: 'path', required: true, schema: { type: 'string' } });
  }

  return { parameters, requestBody };
}

function respuestasDe(metodo: MethodDeclaration, verbo: Metodo): Json {
  const respuestas: Json = {};
  for (const dec of metodo.getDecorators()) {
    const nombre = dec.getName();
    if (nombre !== 'ApiResponse' && !nombre.startsWith('Api')) continue;
    const obj = argObjeto(dec);
    if (!obj) continue;
    const status = propNumero(obj, 'status');
    if (status === undefined) continue;
    respuestas[String(status)] = { description: propString(obj, 'description') ?? '' };
  }
  if (Object.keys(respuestas).length) return respuestas;

  const httpCode = argNumero(decoradorDe(metodo, 'HttpCode'));
  const porDefecto = httpCode ?? (verbo === 'post' ? 201 : 200);
  return { [String(porDefecto)]: { description: '' } };
}

function operacionesDeControlador(cls: ClassDeclaration, archivo: string): OperacionNest[] {
  const decControlador = decoradorDe(cls, 'Controller');
  if (!decControlador) return [];

  const base = argString(decControlador) ?? '';
  const tagClase = argString(decoradorDe(cls, 'ApiTags'));
  const guardsClase = guardsDe(cls);
  const bearerClase = Boolean(decoradorDe(cls, 'ApiBearerAuth'));
  const nombreClase = cls.getName() ?? 'Controller';
  const salida: OperacionNest[] = [];

  for (const metodo of cls.getMethods()) {
    for (const dec of metodo.getDecorators()) {
      const verbo = DECORADORES_RUTA[dec.getName()];
      if (!verbo) continue;

      const ruta = unirPath(base, argString(dec) ?? '');
      const guards = [...guardsClase, ...guardsDe(metodo)];
      const doc = docblock(metodo);
      const apiOperation = argObjeto(decoradorDe(metodo, 'ApiOperation'));

      // Cadena de fallback del summary: @ApiOperation → JSDoc → comentario `//`.
      const summary = propString(apiOperation, 'summary') ?? primeraLinea(doc);
      const description = propString(apiOperation, 'description') ?? doc;

      const { parameters, requestBody } = parametrosYBody(metodo, ruta);

      const operacion: Json = {
        operationId: `${nombreClase}_${metodo.getName()}`,
        tags: [tagClase ?? (base.split('/')[0] || 'raiz')],
        parameters,
        responses: respuestasDe(metodo, verbo),
        'x-goya-origen': 'backend (NestJS)',
        'x-goya-archivo': relativo(archivo),
        'x-goya-auth': authDeGuards(guards),
      };
      if (summary) operacion.summary = summary;
      if (description && description !== summary) operacion.description = description;
      if (requestBody) operacion.requestBody = requestBody;
      if (bearerClase || decoradorDe(metodo, 'ApiBearerAuth')) {
        operacion.security = [{ bearer: [] }];
      }

      salida.push({ ruta, metodo: verbo, operacion });
    }
  }

  return salida;
}

function operacionesNest(): OperacionNest[] {
  const salida: OperacionNest[] = [];
  for (const sf of proyecto.getSourceFiles()) {
    const archivo = sf.getFilePath();
    if (!archivo.endsWith('.controller.ts') || excluido(archivo)) continue;
    for (const cls of sf.getClasses()) salida.push(...operacionesDeControlador(cls, archivo));
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Route handlers del front (escaneo estático de texto)
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
  return listarRouteTs(DIR_API_FRONT)
    .filter((archivo) => !excluido(archivo))
    .map((archivo) => {
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
        archivo: relativo(archivo),
        parametros,
      };
    });
}

function pathsFront(handlers: HandlerFront[]): Record<string, Json> {
  const paths: Record<string, Json> = {};
  for (const h of handlers) {
    const item: Json = {};
    // Módulo = primer segmento después de /api. Si es dinámico, es el catch-all
    // que hace de proxy hacia GeneXus/NestJS.
    const primerSegmento = h.ruta.split('/')[2] ?? 'raiz';
    const tag = `front:${primerSegmento.startsWith('{') ? 'proxy' : primerSegmento}`;
    for (const metodo of h.metodos) {
      item[metodo] = {
        tags: [tag],
        summary: primeraLinea(h.descripcion) || `${metodo.toUpperCase()} ${h.ruta}`,
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

function ordenarPorClave<T>(obj: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

function main(): void {
  const nest = operacionesNest();
  const front = handlersFront();

  const paths: Record<string, Json> = {};
  for (const { ruta, metodo, operacion } of nest) {
    paths[ruta] = paths[ruta] ?? {};
    paths[ruta][metodo] = operacion;
  }

  // Merge a nivel operación, no a nivel path: `/api/health` existe en los dos
  // lados (el del front es el healthcheck del contenedor Next). Pisar el path
  // item entero perdería la operación del backend, y OpenAPI no admite dos
  // operaciones con el mismo método y path — se conserva la del backend y la
  // del front queda anotada en `x-goya-tambien-en-front`.
  for (const [ruta, itemFront] of Object.entries(pathsFront(front))) {
    if (!paths[ruta]) {
      paths[ruta] = itemFront;
      continue;
    }
    for (const [metodo, opFront] of Object.entries(itemFront)) {
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

  resolverSchemasPendientes();

  const tagsUsados = new Set<string>();
  for (const item of Object.values(paths)) {
    for (const metodo of METODOS) {
      const tags = item?.[metodo]?.tags;
      if (Array.isArray(tags)) tags.forEach((t: string) => tagsUsados.add(t));
    }
  }

  const documento = {
    openapi: '3.1.0',
    info: {
      title: 'Riogas Gestión API',
      description:
        'Catálogo de APIs de GOYA (app 3). Backend NestJS (prefijo /api) + route handlers del front Next.\n' +
        'Generado por `pnpm docs:api` con un parser estático del código; no editar a mano — las ' +
        'descripciones y ejemplos van en docs/api/anotaciones.yaml.',
      version: '0.1.0',
    },
    tags: Array.from(tagsUsados)
      .sort()
      .map((name) =>
        DESCRIPCIONES_TAG[name] ? { name, description: DESCRIPCIONES_TAG[name] } : { name },
      ),
    servers: [],
    components: {
      securitySchemes: {
        bearer: { scheme: 'bearer', bearerFormat: 'JWT', type: 'http' },
      },
      schemas: ordenarPorClave(schemas),
    },
    paths: ordenarPorClave(paths),
    'x-goya-generador': 'backend/scripts/generate-openapi.ts',
  };

  let total = 0;
  let deFront = 0;
  let conSummary = 0;
  for (const item of Object.values(paths)) {
    for (const metodo of METODOS) {
      const op = item?.[metodo];
      if (!op) continue;
      total += 1;
      if (String(op['x-goya-origen'] ?? '').startsWith('front')) deFront += 1;
      if (typeof op.summary === 'string' && op.summary.trim()) conSummary += 1;
    }
  }

  fs.mkdirSync(DIR_SALIDA, { recursive: true });
  fs.writeFileSync(ARCHIVO_SALIDA, JSON.stringify(documento, null, 2) + '\n', 'utf8');

  console.log('openapi.json escrito en docs/api/openapi.json');
  console.log(`  rutas:        ${Object.keys(paths).length}`);
  console.log(`  operaciones:  ${total} (backend ${total - deFront} / front ${deFront})`);
  console.log(`  con summary:  ${conSummary}/${total}`);
  console.log(`  schemas:      ${Object.keys(schemas).length}`);
  console.log(`  handlers del front escaneados: ${front.length}`);
  if (EXCLUIDOS.length) console.log(`  EXCLUIDOS por --excluir: ${EXCLUIDOS.join(', ')}`);
}

try {
  main();
} catch (err) {
  console.error('Falló la generación del openapi.json:', err);
  process.exit(1);
}
