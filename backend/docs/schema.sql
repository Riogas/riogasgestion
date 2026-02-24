-- =============================================================================
-- RIOGAS GESTIÓN — Schema PostgreSQL
-- =============================================================================
-- Fecha:    2026-02-24
-- Base:     riogas_gestion
-- Encoding: UTF-8
--
-- MIGRACIÓN INCREMENTAL:
-- ----------------------
-- Este schema se construye por partes. Las tablas se van agregando a medida
-- que se migran desde la base GeneXus legacy (GXICAGEO / sgm.riogas).
--
-- PARTE 1 — Tablas base: escenarios, departamentos, localidades, calles
--
-- NOTAS:
-- • escenarios: tabla raíz (tenant/scope). Los IDs se asignan manualmente
--   (no son autoincrement) para compatibilidad con el sistema legacy.
-- • departamentos, localidades, calles: datos geográficos importados de
--   OpenStreetMap (OSM). NO llevan escenario_id — son datos de referencia
--   compartidos por todos los escenarios.
-- • Los IDs de departamentos y localidades son IDs de relación/nodo de OSM
--   (BIGINT), no secuenciales.
-- • La convención de estado legacy es 'S' = Activo, 'N' = Inactivo.
-- • Las tablas de usuarios y roles NO están aquí porque las gestiona el
--   módulo SecuritySuite existente (sgm.riogas / GeneXus).
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";    -- Para datos geográficos (opcional pero recomendado)

-- =============================================================================
-- FUNCIÓN: trigger para updated_at automático
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- #############################################################################
-- ##  PARTE 1 — Tablas base
-- #############################################################################

-- =============================================================================
-- TABLA: escenarios
-- =============================================================================
-- Tabla maestra de escenarios (≈ departamento operativo de Riogas).
-- Cada escenario agrupa toda la operación de un departamento: puestos,
-- móviles, pedidos, zonas, clientes, etc.
--
-- Equivalencia legacy:  GXICAGEO.ESCENARIO
-- Columnas legacy:      ESCENARIOID, ESCENARIONOM, ESCENARIOHABILITADO
-- =============================================================================
CREATE TABLE escenarios (
    id              INTEGER         PRIMARY KEY,        -- ID manual (legacy: ESCENARIOID)
    nombre          VARCHAR(100)    NOT NULL UNIQUE,     -- legacy: ESCENARIONOM
    habilitado      CHAR(1)         NOT NULL DEFAULT 'S' -- legacy: ESCENARIOHABILITADO
                    CHECK (habilitado IN ('S', 'N')),    -- S = Sí (activo), N = No
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escenarios_habilitado ON escenarios (habilitado);

COMMENT ON TABLE  escenarios     IS 'Escenarios operativos — raíz de partición de todo el modelo';
COMMENT ON COLUMN escenarios.id  IS 'ID manual del escenario (no autoincrement, viene del legacy)';

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON escenarios
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Datos iniciales (extraídos de la base legacy)
INSERT INTO escenarios (id, nombre, habilitado) VALUES
    (1,     'RIOGAS (PRUEBAS)',             'N'),
    (2,     'MALDONADO',                    'S'),
    (3,     'ESCENARIO TEST 3',             'N'),
    (4,     'SALTO',                        'S'),
    (5,     'TACUAREMBO',                   'S'),
    (12,    'RIO BRANCO',                   'N'),
    (16,    'RIVERA',                       'S'),
    (25,    'COLONIA',                      'S'),
    (1000,  'MONTEVIDEO',                   'S'),
    (9999,  'NO HABILITADO SISTEMA FWL',    'S');


-- =============================================================================
-- TABLA: departamentos
-- =============================================================================
-- Departamentos geográficos de Uruguay, importados de OpenStreetMap.
-- Se usan para la normalización de direcciones.
-- NO dependen de escenario — son datos de referencia compartidos.
--
-- Equivalencia legacy:  GXICAGEO.OSMDEPARTAMENTO
-- Columnas legacy:      OSMDEPARTAMENTOID, OSMDEPARTAMENTONOMBRE,
--                        OSMDEPARTAMENTOESTADO
-- =============================================================================
CREATE TABLE departamentos (
    id              BIGINT          PRIMARY KEY,        -- OSM relation ID (ej: 1634207 = Montevideo)
    nombre          VARCHAR(60)     NOT NULL,            -- legacy: OSMDEPARTAMENTONOMBRE
    estado          CHAR(1)         NOT NULL DEFAULT 'S' -- legacy: OSMDEPARTAMENTOESTADO
                    CHECK (estado IN ('S', 'N')),        -- S = Activo, N = Inactivo
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departamentos_nombre ON departamentos (nombre);
CREATE INDEX idx_departamentos_estado ON departamentos (estado);

COMMENT ON TABLE  departamentos    IS 'Departamentos geográficos de Uruguay (datos OSM, sin escenario)';
COMMENT ON COLUMN departamentos.id IS 'ID de relación OpenStreetMap del departamento';

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON departamentos
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Datos iniciales (los 19 departamentos de Uruguay, IDs de OSM)
INSERT INTO departamentos (id, nombre, estado) VALUES
    (1614733, 'Salto',           'S'),
    (1617618, 'Artigas',         'S'),
    (1625171, 'Canelones',       'S'),
    (1627812, 'Rivera',          'S'),
    (1634207, 'Montevideo',      'S'),
    (1635117, 'Maldonado',       'S'),
    (1635124, 'Lavalleja',       'S'),
    (1635164, 'Florida',         'S'),
    (1635189, 'San José',        'S'),
    (1640982, 'Treinta y Tres',  'S'),
    (1645684, 'Flores',          'S'),
    (1646018, 'Durazno',         'S'),
    (1646600, 'Soriano',         'S'),
    (1650769, 'Colonia',         'S'),
    (1653142, 'Rocha',           'S'),
    (1656175, 'Cerro Largo',     'S'),
    (1662265, 'Tacuarembó',      'S'),
    (1662387, 'Paysandú',        'S'),
    (1662476, 'Río Negro',       'S');


-- =============================================================================
-- TABLA: localidades
-- =============================================================================
-- Localidades (ciudades, pueblos, villas) dentro de cada departamento.
-- Importadas de OpenStreetMap. NO dependen de escenario.
--
-- Equivalencia legacy:  GXICAGEO.OSMLOCALIDAD
-- Columnas legacy:      OSMDEPARTAMENTOID, OSMLOCALIDADID, OSMLOCALIDADNOMBRE,
--                        OSMLOCALIDADESTADO, OSMLOCALIDADLATITUD,
--                        OSMLOCALIDADLONGITUD, OSMLOCALIDADREFERENCIA,
--                        OSMLOCALIDADTIPO, OSMLOCALIDADTYPE,
--                        OSMLOCALIDADADDRESSTYPE, OSMLOCALIDADPOBLACION,
--                        OSMLOCALIDADCANTCALLES
-- =============================================================================
CREATE TABLE localidades (
    id              BIGINT          PRIMARY KEY,        -- OSM node/relation ID (OSMLOCALIDADID)
    departamento_id BIGINT          NOT NULL             -- legacy: OSMDEPARTAMENTOID
                    REFERENCES departamentos(id) ON DELETE CASCADE,
    nombre          VARCHAR(60)     NOT NULL,            -- legacy: OSMLOCALIDADNOMBRE
    estado          CHAR(1)         NOT NULL DEFAULT 'S' -- legacy: OSMLOCALIDADESTADO
                    CHECK (estado IN ('S', 'N')),
    latitud         DECIMAL(10, 5),                      -- legacy: OSMLOCALIDADLATITUD
    longitud        DECIMAL(10, 5),                      -- legacy: OSMLOCALIDADLONGITUD
    referencia      VARCHAR(60),                         -- legacy: OSMLOCALIDADREFERENCIA (alt_name)
    tipo            VARCHAR(60),                         -- legacy: OSMLOCALIDADTIPO (city, town, village...)
    osm_type        VARCHAR(60),                         -- legacy: OSMLOCALIDADTYPE (node, relation, way)
    address_type    VARCHAR(60),                         -- legacy: OSMLOCALIDADADDRESSTYPE
    poblacion       BIGINT          DEFAULT 0,           -- legacy: OSMLOCALIDADPOBLACION
    cant_calles     INTEGER         DEFAULT 0,           -- legacy: OSMLOCALIDADCANTCALLES
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_localidades_depto     ON localidades (departamento_id);
CREATE INDEX idx_localidades_nombre    ON localidades (nombre);
CREATE INDEX idx_localidades_estado    ON localidades (estado);
CREATE INDEX idx_localidades_depto_nom ON localidades (departamento_id, nombre);

COMMENT ON TABLE  localidades             IS 'Localidades geográficas de Uruguay (datos OSM, sin escenario)';
COMMENT ON COLUMN localidades.id          IS 'ID de nodo/relación OpenStreetMap de la localidad';
COMMENT ON COLUMN localidades.tipo        IS 'Tipo de asentamiento OSM: city, town, village, hamlet, etc.';
COMMENT ON COLUMN localidades.osm_type    IS 'Tipo de elemento OSM: node, relation, way';
COMMENT ON COLUMN localidades.cant_calles IS 'Cantidad de calles cargadas para esta localidad';

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON localidades
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================================
-- TABLA: calles
-- =============================================================================
-- Calles dentro de cada localidad/departamento.
-- Importadas de OpenStreetMap. NO dependen de escenario.
--
-- En el legacy no hay un ID único de calle; la clave natural es
-- (departamento_id, localidad_id, nombre). Se agrega un BIGSERIAL
-- como PK surrogada para PostgreSQL.
--
-- Equivalencia legacy:  GXICAGEO.OSMCALLE
-- Columnas legacy:      OSMDEPARTAMENTOID, OSMLOCALIDADID, OSMCALLENOMBRE,
--                        OSMCALLELATITUD, OSMCALLELONGITUD, OSMCALLEESTADO,
--                        OSMCALLEREFERENCIA, OSMCALLENOMBRELARGO,
--                        OSMCALLETIPO, OSMCALLESUPERFICIE
-- =============================================================================
CREATE TABLE calles (
    id              BIGSERIAL       PRIMARY KEY,        -- PK surrogada (no existe en legacy)
    departamento_id BIGINT          NOT NULL             -- legacy: OSMDEPARTAMENTOID
                    REFERENCES departamentos(id) ON DELETE CASCADE,
    localidad_id    BIGINT          NOT NULL             -- legacy: OSMLOCALIDADID
                    REFERENCES localidades(id) ON DELETE CASCADE,
    nombre          VARCHAR(80)     NOT NULL,            -- legacy: OSMCALLENOMBRE
    latitud         DECIMAL(10, 5),                      -- legacy: OSMCALLELATITUD
    longitud        DECIMAL(10, 5),                      -- legacy: OSMCALLELONGITUD
    estado          CHAR(1)         NOT NULL DEFAULT 'S' -- legacy: OSMCALLEESTADO
                    CHECK (estado IN ('S', 'N')),
    referencia      VARCHAR(80),                         -- legacy: OSMCALLEREFERENCIA
    nombre_largo    VARCHAR(200),                        -- legacy: OSMCALLENOMBRELARGO
    tipo            VARCHAR(60),                         -- legacy: OSMCALLETIPO (residential, primary, etc.)
    superficie      VARCHAR(60),                         -- legacy: OSMCALLESUPERFICIE
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Clave natural del legacy: una calle no se repite dentro de la misma localidad
    UNIQUE (departamento_id, localidad_id, nombre)
);

CREATE INDEX idx_calles_depto        ON calles (departamento_id);
CREATE INDEX idx_calles_localidad    ON calles (localidad_id);
CREATE INDEX idx_calles_depto_loc    ON calles (departamento_id, localidad_id);
CREATE INDEX idx_calles_nombre       ON calles (nombre);
CREATE INDEX idx_calles_estado       ON calles (estado);
CREATE INDEX idx_calles_nombre_trgm  ON calles USING gin (nombre gin_trgm_ops);
    -- ^ Requiere: CREATE EXTENSION IF NOT EXISTS pg_trgm;
    --   Habilita búsqueda fuzzy por nombre de calle (LIKE '%keyword%', similarity())

COMMENT ON TABLE  calles              IS 'Calles por localidad (datos OSM, sin escenario)';
COMMENT ON COLUMN calles.id           IS 'PK surrogada — en el legacy la clave es (depto, localidad, nombre)';
COMMENT ON COLUMN calles.nombre       IS 'Nombre corto de la calle (max 80 chars)';
COMMENT ON COLUMN calles.nombre_largo IS 'Nombre largo/completo de la calle (max 200 chars)';
COMMENT ON COLUMN calles.tipo         IS 'Tipo de vía OSM: residential, primary, secondary, tertiary, etc.';

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON calles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- =============================================================================
-- RESUMEN PARTE 1
-- =============================================================================
-- | Tabla          | PK           | escenario_id | Fuente legacy            |
-- |----------------|--------------|:------------:|--------------------------|
-- | escenarios     | INTEGER (m)  |     ES PK    | GXICAGEO.ESCENARIO       |
-- | departamentos  | BIGINT (osm) |     NO       | GXICAGEO.OSMDEPARTAMENTO |
-- | localidades    | BIGINT (osm) |     NO       | GXICAGEO.OSMLOCALIDAD    |
-- | calles         | BIGSERIAL    |     NO       | GXICAGEO.OSMCALLE        |
-- =============================================================================
-- (m)  = ID asignado manualmente (legacy)
-- (osm) = ID de OpenStreetMap
--
-- PRÓXIMAS PARTES (pendientes):
-- • Parte 2: puestos, tipos_capa, capas, zonas
-- • Parte 3: fleteras, moviles
-- • Parte 4: clientes, telefonos, direcciones
-- • Parte 5: pedidos, servicios, asignaciones
-- • Parte 6: audit_log
-- =============================================================================
