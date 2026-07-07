-- Cédula única SOLO cuando no es null (Prisma no expresa índices parciales).
CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_cedula
  ON persona (cedula) WHERE cedula IS NOT NULL;
