/**
 * Script CLI para importar el padrón de clientes desde un archivo dump.
 *
 * Uso:
 *   pnpm import:padron --file=padron.json
 *
 * El archivo debe ser un JSON array de PadronRow.
 * CSV: TODO (implementar parser simple cuando se confirme el formato de extracción AS400).
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ImportPadronService } from './import-padron.service';
import { PadronRow } from './padron-row';

async function main() {
  // ─── Parsear argumentos ───────────────────────────────────────────────────
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='));

  if (!fileArg) {
    console.error('ERROR: Argumento --file=<ruta> requerido.');
    console.error('  Ejemplo: pnpm import:padron --file=padron.json');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg.replace('--file=', ''));

  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  // ─── Leer y parsear el archivo ────────────────────────────────────────────
  const ext = path.extname(filePath).toLowerCase();

  if (ext !== '.json') {
    console.error(`ERROR: Solo se soporta formato JSON por ahora. TODO: soporte CSV.`);
    console.error(`Archivo recibido: ${filePath}`);
    process.exit(1);
  }

  let rows: PadronRow[];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error('ERROR: El archivo JSON debe ser un array de objetos.');
      process.exit(1);
    }
    rows = parsed as PadronRow[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ERROR al parsear el archivo: ${msg}`);
    process.exit(1);
  }

  console.log(`Importando ${rows.length} filas desde ${filePath} ...`);

  // ─── Bootstrapear contexto Nest standalone ────────────────────────────────
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const importService = app.get(ImportPadronService);
    const result = await importService.importPadron(rows);

    console.log('\n=== RESULTADO DE IMPORTACIÓN ===');
    console.log(`  Creados:     ${result.creados}`);
    console.log(`  Actualizados: ${result.actualizados}`);
    console.log(`  Errores:     ${result.errores.length}`);

    if (result.errores.length > 0) {
      console.log('\n--- ERRORES ---');
      result.errores.forEach((e, i) => {
        const nro = (e.row as any).nroCliente ?? '(sin nroCliente)';
        console.error(`  [${i + 1}] nroCliente=${nro}: ${e.error}`);
      });
    }

    process.exitCode = result.errores.length > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('ERROR fatal:', err);
  process.exit(1);
});
