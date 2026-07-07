# Implementación: Módulo Clientes sobre modelo unificado

## Estado
✅ Completa (ambos builds verdes; golden-path en browser pendiente del usuario)

## Tareas completadas
- Fase A: A1 (DTOs), A2 (service ClienteUni transaccional), A3 (sub-recursos tel/dir 1-principal), A4 (catálogos), A5 (AuthGuard — no-op, ya validaba), A6 (build verde).
- Fase B: B1 (tipos espejo + zod), B2 (services + geocode), B3 (lista), B4 (header+datos), B5 (mapa+editor), B6 (tabs), B7 (alta master-detail), B8 (build verde + push).

## Verificaciones
- backend `npm run build`: ✅ 0 errores.
- raíz `npm run build`: ✅ Compiled successfully.
- zod tests (`npx tsx src/lib/types/cliente.test.ts`): ✅ 7/7.

## Desviaciones del plan
1. **axios baseURL**: el plan pedía baseURL `NEXT_PUBLIC_NEST_URL`. El repo ya enruta a NestJS vía el proxy `src/app/api/[...path]/route.ts` usando `NEXT_PUBLIC_API_BACKEND=nestjs` + `NEXT_PUBLIC_NESTJS_API_URL`. No se tocó axios; se documentó `NEXT_PUBLIC_NOMINATIM_URL` en `.env.local` y `.env.production.example`. Var efectiva: `NEXT_PUBLIC_NESTJS_API_URL` (no `NEXT_PUBLIC_NEST_URL`).
2. **A5 AuthGuard**: el guard ya verifica firma HS256 (si hay `JWT_SECRET`), exp y deja `req.user`. No se reescribió. El controller lee `req.user.username` para `operadorAlta/operadorModificacion`.
3. **Columna Localidad** de la lista muestra `localidadId` (el backend de la lista incluye sólo la dir principal sin resolver el nombre de localidad). Resolver nombre requiere join extra; se dejó el id.
4. **Catálogos zonas/puestos**: creados en backend+service, no cableados en UI (no los pide ninguna pantalla del alcance actual).
5. Se borraron `AltaWizard.tsx`, `AltaSlideOver.tsx`, `AddressPicker.tsx` (reemplazados por el workspace master-detail; el "+ Nuevo" navega a `/dashboard/clientes/nuevo`).

## Pendiente / revisión humana
- URL real del NestJS en prod + CORS; `JWT_SECRET` compartido con secapi para verificación de firma (si no, modo degradado por exp).
- Golden-path manual en browser (geocode/reverse contra nominatim.riogas.uy, alta con N dir/tel).
- `npx tsc --noEmit` desde la raíz reporta errores de `backend/**` por decoradores: es esperado (root tsconfig incluye `**/*.ts`); el gate real es `npm run build` de cada proyecto, ambos verdes.
