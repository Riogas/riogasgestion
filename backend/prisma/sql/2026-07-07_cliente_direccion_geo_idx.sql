-- Soporte para el self-join PROXIMIDAD_GEO de etl_sugerencias.py (tipo
-- hogar): agrupa por localidadId y filtra por lat/lng no nulos antes del
-- cross join geográfico. Sin este índice, ese self-join hace un scan
-- completo de cliente_direccion por cada fila. Aplicar ANTES de correr
-- `etl_sugerencias.py --tipo hogar` (o `--tipo all`).
CREATE INDEX IF NOT EXISTS idx_cliente_direccion_loc_geo
  ON cliente_direccion ("localidadId", lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
