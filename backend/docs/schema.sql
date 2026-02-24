-- =============================================================================
-- RIOGAS GESTIÓN — Schema PostgreSQL
-- =============================================================================
-- Fecha:    2026-02-24
-- Base:     riogas_gestion
-- Encoding: UTF-8
--
-- IMPORTANTE:
-- -----------
-- TODAS las tablas (a excepción de "usuarios" y "roles", que son manejadas
-- por el sistema de seguridad externo SecuritySuite/GeneXus) llevan como
-- campo clave de partición el campo "escenario_id".
--
-- "escenario_id" representa un DEPARTAMENTO de Uruguay (ej: Montevideo,
-- Corrientes, Goya, etc.) y actúa como tenant/scope de datos. Toda la
-- información (clientes, pedidos, móviles, zonas, etc.) está separada
-- por escenario, permitiendo que la misma aplicación sirva a múltiples
-- departamentos de forma aislada.
--
-- Las tablas de usuarios y roles NO están aquí porque las gestiona el
-- módulo SecuritySuite existente (sgm.riogas / GeneXus). Este backend
-- solo consume tokens/permisos de ese sistema.
-- =============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";    -- Para datos geográficos (opcional pero recomendado)

-- =============================================================================
-- TABLA: escenarios
-- Tabla maestra de departamentos/escenarios. Es la raíz de todo el modelo.
-- =============================================================================
CREATE TABLE escenarios (
    id              SERIAL          PRIMARY KEY,
    nombre          VARCHAR(100)    NOT NULL UNIQUE,
    estado          CHAR(1)         NOT NULL DEFAULT 'A'  CHECK (estado IN ('A', 'I')),
    -- A = Activo, I = Inactivo
    latitud         DECIMAL(10, 6),
    longitud        DECIMAL(10, 6),
    zoom_default    SMALLINT        DEFAULT 13,
    timezone        VARCHAR(50)     DEFAULT 'America/Argentina/Buenos_Aires',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escenarios_estado ON escenarios (estado);

COMMENT ON TABLE escenarios IS 'Departamentos/escenarios — raíz de partición de todo el modelo';
COMMENT ON COLUMN escenarios.id IS 'Identificador único del escenario (= departamento)';

-- =============================================================================
-- TABLA: departamentos
-- Departamentos geográficos importados de OSM (uso normalización de direcciones)
-- =============================================================================
CREATE TABLE departamentos (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    nombre          VARCHAR(150)    NOT NULL,
    estado          CHAR(1)         NOT NULL DEFAULT 'S'  CHECK (estado IN ('S', 'N')),
    -- S = Activo, N = Pasivo (convención legacy GeneXus)
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (escenario_id, nombre)
);

CREATE INDEX idx_departamentos_escenario ON departamentos (escenario_id);
CREATE INDEX idx_departamentos_estado ON departamentos (escenario_id, estado);

-- =============================================================================
-- TABLA: localidades
-- Localidades dentro de cada departamento
-- =============================================================================
CREATE TABLE localidades (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    departamento_id INTEGER         NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
    nombre          VARCHAR(200)    NOT NULL,
    referencia      VARCHAR(200),           -- alt_name
    tipo            VARCHAR(50),            -- city, village, town, etc.
    address_type    VARCHAR(50),
    latitud         DECIMAL(10, 6),
    longitud        DECIMAL(10, 6),
    poblacion       VARCHAR(20),
    estado          CHAR(1)         NOT NULL DEFAULT 'S'  CHECK (estado IN ('S', 'N')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (escenario_id, departamento_id, nombre)
);

CREATE INDEX idx_localidades_escenario ON localidades (escenario_id);
CREATE INDEX idx_localidades_depto ON localidades (escenario_id, departamento_id);
CREATE INDEX idx_localidades_estado ON localidades (escenario_id, estado);

-- =============================================================================
-- TABLA: calles
-- Calles por localidad/departamento
-- =============================================================================
CREATE TABLE calles (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    departamento_id INTEGER         NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
    localidad_id    INTEGER         REFERENCES localidades(id) ON DELETE SET NULL,
    nombre          VARCHAR(300)    NOT NULL,
    nombre_largo    VARCHAR(500),
    referencia      VARCHAR(300),
    tipo            VARCHAR(50),            -- residential, primary, secondary, etc.
    superficie      VARCHAR(50),
    latitud         DECIMAL(10, 6),
    longitud        DECIMAL(10, 6),
    estado          CHAR(1)         NOT NULL DEFAULT 'S'  CHECK (estado IN ('S', 'N')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calles_escenario ON calles (escenario_id);
CREATE INDEX idx_calles_depto_loc ON calles (escenario_id, departamento_id, localidad_id);
CREATE INDEX idx_calles_nombre ON calles (escenario_id, nombre);
CREATE INDEX idx_calles_estado ON calles (escenario_id, estado);

-- =============================================================================
-- TABLA: puestos
-- Puntos de distribución / estaciones
-- =============================================================================
CREATE TABLE puestos (
    id                      SERIAL          PRIMARY KEY,
    escenario_id            INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    descripcion             VARCHAR(200)    NOT NULL,
    direccion               VARCHAR(300),
    telefono_ult_linea      VARCHAR(30),
    estado                  CHAR(1)         NOT NULL DEFAULT 'A'  CHECK (estado IN ('A', 'I')),
    coord_x                 DECIMAL(10, 6),         -- latitud
    coord_y                 DECIMAL(10, 6),         -- longitud
    ubicacion               VARCHAR(200),
    flete_cobra              BOOLEAN        DEFAULT FALSE,
    flete_cantidad           DECIMAL(10, 2) DEFAULT 0,
    gps_fletera              VARCHAR(100),
    atraso                   VARCHAR(50),
    auto_pedido              BOOLEAN        DEFAULT FALSE,
    fuerza_autopedido        BOOLEAN        DEFAULT FALSE,
    palabra_autopedido       VARCHAR(100),
    wapp_activo              BOOLEAN        DEFAULT FALSE,
    acepta_agendar           BOOLEAN        DEFAULT FALSE,
    horarios                 TEXT,
    gci_nro                  VARCHAR(50),
    pruebas                  BOOLEAN        DEFAULT FALSE,
    calendario_id            VARCHAR(50),
    calendario_nombre        VARCHAR(100),
    zonificacion_id          VARCHAR(50),
    zonificacion_desc        VARCHAR(200),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_puestos_escenario ON puestos (escenario_id);
CREATE INDEX idx_puestos_estado ON puestos (escenario_id, estado);

-- =============================================================================
-- TABLA: tipos_capa
-- Tipos de capa geográfica (Zonificación, Cobertura, etc.)
-- =============================================================================
CREATE TABLE tipos_capa (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    nombre          VARCHAR(100)    NOT NULL,
    estado          CHAR(1)         NOT NULL DEFAULT 'A'  CHECK (estado IN ('A', 'I')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (escenario_id, nombre)
);

CREATE INDEX idx_tipos_capa_escenario ON tipos_capa (escenario_id);

-- =============================================================================
-- TABLA: capas
-- Capas geográficas que agrupan zonas
-- =============================================================================
CREATE TABLE capas (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    puesto_id       INTEGER         NOT NULL REFERENCES puestos(id) ON DELETE CASCADE,
    tipo_capa_id    INTEGER         NOT NULL REFERENCES tipos_capa(id) ON DELETE CASCADE,
    nombre          VARCHAR(200)    NOT NULL,
    estado          CHAR(1)         NOT NULL DEFAULT 'A'  CHECK (estado IN ('A', 'I')),
    fecha_inicio    DATE,
    fecha_fin       DATE,
    geojson         JSONB,                  -- FeatureCollection completo
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_capas_escenario ON capas (escenario_id);
CREATE INDEX idx_capas_puesto ON capas (escenario_id, puesto_id);
CREATE INDEX idx_capas_tipo ON capas (escenario_id, tipo_capa_id);

-- =============================================================================
-- TABLA: zonas
-- Zonas geográficas (polígonos en el mapa)
-- =============================================================================
CREATE TABLE zonas (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    puesto_id       INTEGER         NOT NULL REFERENCES puestos(id) ON DELETE CASCADE,
    tipo_capa_id    INTEGER         NOT NULL REFERENCES tipos_capa(id) ON DELETE CASCADE,
    capa_id         INTEGER         NOT NULL REFERENCES capas(id) ON DELETE CASCADE,
    nombre          VARCHAR(100)    NOT NULL,
    color           VARCHAR(7),             -- hex color (#RRGGBB)
    estado          CHAR(1)         NOT NULL DEFAULT 'A'  CHECK (estado IN ('A', 'I')),
    geojson         JSONB,                  -- Polygon / MultiPolygon
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zonas_escenario ON zonas (escenario_id);
CREATE INDEX idx_zonas_capa ON zonas (escenario_id, capa_id);
CREATE INDEX idx_zonas_puesto ON zonas (escenario_id, puesto_id);
CREATE INDEX idx_zonas_estado ON zonas (escenario_id, estado);

-- =============================================================================
-- TABLA: fleteras
-- Empresas de flete / transporte
-- =============================================================================
CREATE TABLE fleteras (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    nombre          VARCHAR(200)    NOT NULL,
    estado          CHAR(1)         NOT NULL DEFAULT 'A'  CHECK (estado IN ('A', 'I')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (escenario_id, nombre)
);

CREATE INDEX idx_fleteras_escenario ON fleteras (escenario_id);

-- =============================================================================
-- TABLA: moviles
-- Vehículos / móviles de reparto
-- =============================================================================
CREATE TABLE moviles (
    id                  SERIAL          PRIMARY KEY,
    escenario_id        INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    codigo              VARCHAR(20)     NOT NULL,       -- ej: "M-101"
    estado              VARCHAR(20)     NOT NULL DEFAULT 'Activo'
                        CHECK (estado IN ('Activo', 'Inactivo', 'Mantenimiento')),
    lote_max            SMALLINT        DEFAULT 10,     -- max pedidos simultáneos
    servicio            VARCHAR(20)     DEFAULT 'Normal'
                        CHECK (servicio IN ('Normal', 'Urgente', 'Especial')),
    telefono            VARCHAR(30),
    baja_momentanea     BOOLEAN         DEFAULT FALSE,
    observaciones       TEXT,
    fletera_id          INTEGER         REFERENCES fleteras(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (escenario_id, codigo)
);

CREATE INDEX idx_moviles_escenario ON moviles (escenario_id);
CREATE INDEX idx_moviles_estado ON moviles (escenario_id, estado);
CREATE INDEX idx_moviles_fletera ON moviles (escenario_id, fletera_id);

-- =============================================================================
-- TABLA: clientes
-- Clientes finales
-- =============================================================================
CREATE TABLE clientes (
    id                  SERIAL          PRIMARY KEY,
    escenario_id        INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    nro_cliente         VARCHAR(30)     NOT NULL,       -- código cliente legacy
    nombre              VARCHAR(200)    NOT NULL,
    ruc                 VARCHAR(30),
    mail                VARCHAR(200),
    tipo                VARCHAR(30)     DEFAULT 'Residencial'
                        CHECK (tipo IN ('Residencial', 'Comercial')),
    gci                 VARCHAR(5)      DEFAULT 'No'
                        CHECK (gci IN ('Sí', 'No')),
    estado              VARCHAR(20)     NOT NULL DEFAULT 'Activo'
                        CHECK (estado IN ('Activo', 'Pendiente', 'Inactivo')),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (escenario_id, nro_cliente)
);

CREATE INDEX idx_clientes_escenario ON clientes (escenario_id);
CREATE INDEX idx_clientes_nombre ON clientes (escenario_id, nombre);
CREATE INDEX idx_clientes_estado ON clientes (escenario_id, estado);
CREATE INDEX idx_clientes_ruc ON clientes (escenario_id, ruc) WHERE ruc IS NOT NULL;

-- =============================================================================
-- TABLA: telefonos
-- Teléfonos de clientes
-- =============================================================================
CREATE TABLE telefonos (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    cliente_id      INTEGER         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    numero          VARCHAR(30)     NOT NULL,
    alias           VARCHAR(50),
    tipo            VARCHAR(20)     DEFAULT 'Movil'
                    CHECK (tipo IN ('Movil', 'Fijo', 'Whatsapp')),
    estado          VARCHAR(20)     NOT NULL DEFAULT 'Activo'
                    CHECK (estado IN ('Activo', 'Inactivo')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telefonos_escenario ON telefonos (escenario_id);
CREATE INDEX idx_telefonos_cliente ON telefonos (escenario_id, cliente_id);

-- =============================================================================
-- TABLA: direcciones
-- Direcciones de clientes
-- =============================================================================
CREATE TABLE direcciones (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    cliente_id      INTEGER         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    departamento    VARCHAR(100),
    localidad       VARCHAR(200),
    calle           VARCHAR(300),
    nro_puerta      VARCHAR(20),
    esquina1        VARCHAR(200),
    esquina2        VARCHAR(200),
    block           VARCHAR(20),
    nivel           VARCHAR(20),
    local_apto      VARCHAR(20),
    manzana         VARCHAR(20),
    zona_id         INTEGER         REFERENCES zonas(id) ON DELETE SET NULL,
    latitud         DECIMAL(10, 6),
    longitud        DECIMAL(10, 6),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_direcciones_escenario ON direcciones (escenario_id);
CREATE INDEX idx_direcciones_cliente ON direcciones (escenario_id, cliente_id);
CREATE INDEX idx_direcciones_zona ON direcciones (escenario_id, zona_id) WHERE zona_id IS NOT NULL;

-- =============================================================================
-- TABLA: pedidos
-- Pedidos de gas
-- =============================================================================
CREATE TABLE pedidos (
    id                  SERIAL          PRIMARY KEY,
    escenario_id        INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    nro_pedido          VARCHAR(30)     NOT NULL,
    cliente_id          INTEGER         REFERENCES clientes(id) ON DELETE SET NULL,
    movil_id            INTEGER         REFERENCES moviles(id) ON DELETE SET NULL,
    zona_id             INTEGER         REFERENCES zonas(id) ON DELETE SET NULL,
    fecha_para          TIMESTAMPTZ,
    telefono            VARCHAR(30),
    producto            VARCHAR(50)     NOT NULL,       -- "13kg", "45kg", etc.
    cantidad            SMALLINT        NOT NULL DEFAULT 1,
    estado              VARCHAR(20)     NOT NULL DEFAULT 'Pendiente'
                        CHECK (estado IN ('Activo', 'Pendiente', 'Entregado', 'Cancelado')),
    sub_estado          VARCHAR(30)
                        CHECK (sub_estado IS NULL OR sub_estado IN ('En Ruta', 'Pendiente', 'Asignado')),
    servicio            VARCHAR(20)     DEFAULT 'Normal'
                        CHECK (servicio IN ('Normal', 'Urgente', 'Especial')),
    canal               VARCHAR(20)
                        CHECK (canal IS NULL OR canal IN ('Web', 'Tel', 'Whatsapp', 'App')),
    forma_pago          VARCHAR(30)
                        CHECK (forma_pago IS NULL OR forma_pago IN ('Efectivo', 'Tarjeta', 'Transferencia')),
    prioridad           SMALLINT        DEFAULT 0,
    atraso              INTEGER         DEFAULT 0,      -- minutos de atraso
    demora_zona         INTEGER         DEFAULT 0,      -- demora estimada zona en minutos
    campania            VARCHAR(50),                     -- nombre de campaña/promo
    importe             DECIMAL(12, 2),
    observaciones       TEXT,
    -- Dirección del pedido (desnormalizada para performance)
    departamento        VARCHAR(100),
    localidad           VARCHAR(200),
    calle               VARCHAR(300),
    nro_puerta          VARCHAR(20),
    esquina1            VARCHAR(200),
    esquina2            VARCHAR(200),
    block               VARCHAR(20),
    apto                VARCHAR(20),
    direccion_completa  VARCHAR(500),
    latitud             DECIMAL(10, 6),
    longitud            DECIMAL(10, 6),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (escenario_id, nro_pedido)
);

CREATE INDEX idx_pedidos_escenario ON pedidos (escenario_id);
CREATE INDEX idx_pedidos_estado ON pedidos (escenario_id, estado);
CREATE INDEX idx_pedidos_fecha ON pedidos (escenario_id, fecha_para);
CREATE INDEX idx_pedidos_movil ON pedidos (escenario_id, movil_id) WHERE movil_id IS NOT NULL;
CREATE INDEX idx_pedidos_zona ON pedidos (escenario_id, zona_id) WHERE zona_id IS NOT NULL;
CREATE INDEX idx_pedidos_cliente ON pedidos (escenario_id, cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX idx_pedidos_sub_estado ON pedidos (escenario_id, sub_estado) WHERE sub_estado IS NOT NULL;

-- =============================================================================
-- TABLA: servicios
-- Servicios técnicos (mantenimiento, reparación)
-- =============================================================================
CREATE TABLE servicios (
    id                  SERIAL          PRIMARY KEY,
    escenario_id        INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    nro_servicio        VARCHAR(30)     NOT NULL,
    cliente_id          INTEGER         REFERENCES clientes(id) ON DELETE SET NULL,
    movil_id            INTEGER         REFERENCES moviles(id) ON DELETE SET NULL,
    zona_id             INTEGER         REFERENCES zonas(id) ON DELETE SET NULL,
    fecha_para          TIMESTAMPTZ,
    telefono            VARCHAR(30),
    producto            VARCHAR(50)     NOT NULL,       -- "Mantenimiento", "Reparación"
    estado              VARCHAR(20)     NOT NULL DEFAULT 'Pendiente'
                        CHECK (estado IN ('Pendiente', 'En curso', 'Cerrado', 'Cancelado')),
    defecto             VARCHAR(200),                   -- "Pérdida en flexible", "No enciende", etc.
    atraso              INTEGER         DEFAULT 0,
    observaciones       TEXT,
    -- Dirección (desnormalizada)
    departamento        VARCHAR(100),
    localidad           VARCHAR(200),
    calle               VARCHAR(300),
    nro_puerta          VARCHAR(20),
    esquina1            VARCHAR(200),
    esquina2            VARCHAR(200),
    block               VARCHAR(20),
    apto                VARCHAR(20),
    direccion_completa  VARCHAR(500),
    latitud             DECIMAL(10, 6),
    longitud            DECIMAL(10, 6),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (escenario_id, nro_servicio)
);

CREATE INDEX idx_servicios_escenario ON servicios (escenario_id);
CREATE INDEX idx_servicios_estado ON servicios (escenario_id, estado);
CREATE INDEX idx_servicios_fecha ON servicios (escenario_id, fecha_para);
CREATE INDEX idx_servicios_movil ON servicios (escenario_id, movil_id) WHERE movil_id IS NOT NULL;

-- =============================================================================
-- TABLA: asignaciones
-- Asignación de móviles a zonas (con categoría prioridad/tránsito)
-- =============================================================================
CREATE TABLE asignaciones (
    id              SERIAL          PRIMARY KEY,
    escenario_id    INTEGER         NOT NULL REFERENCES escenarios(id) ON DELETE CASCADE,
    movil_id        INTEGER         NOT NULL REFERENCES moviles(id) ON DELETE CASCADE,
    zona_id         INTEGER         NOT NULL REFERENCES zonas(id) ON DELETE CASCADE,
    tipo_servicio   VARCHAR(20)     DEFAULT 'Normal'
                    CHECK (tipo_servicio IN ('Normal', 'Urgente', 'Especial')),
    turno           VARCHAR(20),
    categoria       VARCHAR(20)     NOT NULL DEFAULT 'prioridad'
                    CHECK (categoria IN ('prioridad', 'transito')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Un móvil no puede estar asignado dos veces a la misma zona con la misma categoría
    UNIQUE (escenario_id, movil_id, zona_id, categoria)
);

CREATE INDEX idx_asignaciones_escenario ON asignaciones (escenario_id);
CREATE INDEX idx_asignaciones_movil ON asignaciones (escenario_id, movil_id);
CREATE INDEX idx_asignaciones_zona ON asignaciones (escenario_id, zona_id);

-- =============================================================================
-- TABLA: audit_log
-- Log de auditoría para operaciones importantes
-- =============================================================================
CREATE TABLE audit_log (
    id              BIGSERIAL       PRIMARY KEY,
    escenario_id    INTEGER         REFERENCES escenarios(id) ON DELETE SET NULL,
    tabla           VARCHAR(50)     NOT NULL,           -- nombre de la tabla afectada
    registro_id     INTEGER,                            -- id del registro afectado
    accion          VARCHAR(10)     NOT NULL             -- 'INSERT', 'UPDATE', 'DELETE'
                    CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
    usuario         VARCHAR(100),                       -- username del operador
    datos_antes     JSONB,                              -- snapshot antes del cambio
    datos_despues   JSONB,                              -- snapshot después del cambio
    ip              VARCHAR(45),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_escenario ON audit_log (escenario_id);
CREATE INDEX idx_audit_tabla ON audit_log (tabla, created_at);
CREATE INDEX idx_audit_fecha ON audit_log (created_at);

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

-- Aplicar trigger a todas las tablas que tienen updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'updated_at'
          AND table_name != 'audit_log'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
            t
        );
    END LOOP;
END;
$$;

-- =============================================================================
-- DATOS INICIALES: Escenario de ejemplo
-- =============================================================================
INSERT INTO escenarios (nombre, latitud, longitud, zoom_default, timezone)
VALUES
    ('Goya',        -29.1408,  -59.2636, 13, 'America/Argentina/Buenos_Aires'),
    ('Montevideo',  -34.9011,  -56.1645, 12, 'America/Montevideo');

-- =============================================================================
-- RESUMEN DE TABLAS
-- =============================================================================
-- | Tabla          | escenario_id | Descripción                              |
-- |----------------|:------------:|------------------------------------------|
-- | escenarios     |     PK       | Departamentos (raíz de partición)        |
-- | departamentos  |     FK       | Departamentos geográficos (OSM)          |
-- | localidades    |     FK       | Localidades dentro de departamentos      |
-- | calles         |     FK       | Calles por localidad                     |
-- | puestos        |     FK       | Puntos de distribución                   |
-- | tipos_capa     |     FK       | Tipos de capa geográfica                 |
-- | capas          |     FK       | Capas (agrupan zonas)                    |
-- | zonas          |     FK       | Zonas geográficas (polígonos)            |
-- | fleteras       |     FK       | Empresas de flete                        |
-- | moviles        |     FK       | Vehículos de reparto                     |
-- | clientes       |     FK       | Clientes finales                         |
-- | telefonos      |     FK       | Teléfonos de clientes                    |
-- | direcciones    |     FK       | Direcciones de clientes                  |
-- | pedidos        |     FK       | Pedidos de gas                           |
-- | servicios      |     FK       | Servicios técnicos                       |
-- | asignaciones   |     FK       | Móvil ↔ Zona (prioridad/tránsito)       |
-- | audit_log      |     FK       | Log de auditoría                         |
-- =============================================================================
