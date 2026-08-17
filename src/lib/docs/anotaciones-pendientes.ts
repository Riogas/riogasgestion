// Endpoints que TODAVÍA no tienen entrada en docs/api/anotaciones.yaml.
//
// Es la lista de excepciones del test antienvejecimiento
// (src/lib/docs/cobertura-anotaciones.test.ts): existe para que el test arranque
// verde con la deuda de hoy y falle SÓLO con los endpoints nuevos.
//
// Reglas de uso:
//
//   · Endpoint nuevo → se anota en docs/api/anotaciones.yaml. NO se agrega acá.
//     Esta lista no crece: es deuda vieja congelada, no un buzón de excusas.
//   · Endpoint que se anota → se saca de esta lista. El test también falla si
//     una excepción sobra, así que la lista no se pudre.
//   · Endpoint que se borra del código → se saca de esta lista.
//
// Todos los que quedan acá son CRUD interno del panel (móviles, puestos,
// fleteras, catálogos, workbench, admin de sorteos): sin consumidor externo y
// con el contrato ya descripto por el generador a partir de los DTOs.
//
// Generada el 2026-08-17 con la deuda de ese día: 73 endpoints de 108.

export const ENDPOINTS_SIN_ANOTAR: readonly string[] = [
  "DELETE /api/clientes/{id}",
  "DELETE /api/clientes/{id}/direcciones/{dirId}",
  "DELETE /api/clientes/{id}/telefonos/{telId}",
  "DELETE /api/moviles/{id}/escenarios/{subId}",
  "DELETE /api/moviles/{id}/productos/{subId}",
  "DELETE /api/moviles/{id}/puntos/{subId}",
  "DELETE /api/moviles/{id}/servicios/{subId}",
  "DELETE /api/zonas/{id}",
  "GET /api/calles/matches/{id}/mapa",
  "GET /api/calles/osm/{id}",
  "GET /api/catalogos/categorias-precio",
  "GET /api/catalogos/departamentos",
  "GET /api/catalogos/localidades",
  "GET /api/catalogos/puestos",
  "GET /api/catalogos/tipos-cliente",
  "GET /api/catalogos/zonas",
  "GET /api/fleteras",
  "GET /api/fleteras/filtros",
  "GET /api/fleteras/kpis",
  "GET /api/fleteras/{id}",
  "GET /api/moviles",
  "GET /api/moviles/catalogos",
  "GET /api/moviles/filtros",
  "GET /api/moviles/kpis",
  "GET /api/moviles/{id}",
  "GET /api/personas/{id}",
  "GET /api/puestos",
  "GET /api/puestos/filtros",
  "GET /api/puestos/kpis",
  "GET /api/puestos/{id}",
  "GET /api/sorteos",
  "GET /api/sorteos/{id}",
  "GET /api/sorteos/{id}/lotes",
  "GET /api/sorteos/{id}/lotes/{loteId}/zip",
  "GET /api/sorteos/{id}/participaciones",
  "GET /api/sorteos/{id}/participaciones/export",
  "GET /api/workbench/sugerencias",
  "GET /api/zonas",
  "GET /api/zonas/puestos",
  "PATCH /api/clientes/{id}",
  "PATCH /api/clientes/{id}/direcciones/{dirId}",
  "PATCH /api/clientes/{id}/telefonos/{telId}",
  "PATCH /api/moviles/{id}",
  "PATCH /api/moviles/{id}/escenarios/{subId}",
  "PATCH /api/moviles/{id}/productos/{subId}",
  "PATCH /api/moviles/{id}/puntos/{subId}",
  "PATCH /api/moviles/{id}/servicios/{subId}",
  "PATCH /api/personas/{id}/canonical",
  "PATCH /api/puestos/{id}",
  "PATCH /api/sorteos/{id}",
  "PATCH /api/zonas/{id}",
  "POST /api/calles/recargar",
  "POST /api/clientes/{id}/direcciones",
  "POST /api/clientes/{id}/telefonos",
  "POST /api/moviles/{id}/duplicar",
  "POST /api/moviles/{id}/escenarios",
  "POST /api/moviles/{id}/productos",
  "POST /api/moviles/{id}/puntos",
  "POST /api/moviles/{id}/servicios",
  "POST /api/personas/split",
  "POST /api/personas/unify",
  "POST /api/puestos",
  "POST /api/sorteos",
  "POST /api/sorteos/participaciones/{id}/entregar",
  "POST /api/sorteos/{id}/activar",
  "POST /api/sorteos/{id}/cancelar",
  "POST /api/sorteos/{id}/finalizar",
  "POST /api/sorteos/{id}/lotes",
  "POST /api/workbench/sugerencias/{id}/aceptar",
  "POST /api/workbench/sugerencias/{id}/deshacer",
  "POST /api/workbench/sugerencias/{id}/rechazar",
  "POST /api/zonas",
  "POST /api/zonas/{id}/duplicar",
];
