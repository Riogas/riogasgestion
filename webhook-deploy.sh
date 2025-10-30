#!/bin/bash

# ============================================
# WEBHOOK DEPLOY PARA GITHUB
# ============================================
# Este script se ejecuta cuando GitHub envía
# un webhook después de un push
# ============================================

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variables
PROJECT_DIR="/home/riogas/goya"  # Ruta del proyecto
BRANCH="dev"  # Rama a deployar
LOG_FILE="$PROJECT_DIR/logs/webhook_$(date +%Y%m%d_%H%M%S).log"
LOCK_FILE="/tmp/riogasgestion-deploy.lock"

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Verificar lock (evitar deploys simultáneos)
if [ -f "$LOCK_FILE" ]; then
    error "Ya hay un deploy en proceso. Abortando."
    exit 1
fi

# Crear lock
touch "$LOCK_FILE"

# Asegurar que el lock se elimine al salir
trap "rm -f $LOCK_FILE" EXIT

log "╔════════════════════════════════════════╗"
log "║   WEBHOOK DEPLOY - AUTODEPLOY          ║"
log "╚════════════════════════════════════════╝"

# Cambiar al directorio del proyecto
cd "$PROJECT_DIR" || {
    error "No se pudo acceder al directorio $PROJECT_DIR"
    exit 1
}

# ============================================
# PASO 1: Git Pull
# ============================================
info "Paso 1/4: Obteniendo últimos cambios de GitHub..."

# Guardar cambios locales si existen (stash)
if ! git diff-index --quiet HEAD --; then
    warning "Hay cambios locales no commiteados. Guardando en stash..."
    git stash
fi

# Fetch y pull
git fetch origin "$BRANCH"

BEFORE_COMMIT=$(git rev-parse HEAD)
git pull origin "$BRANCH"
AFTER_COMMIT=$(git rev-parse HEAD)

if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
    info "No hay cambios nuevos. Deploy cancelado."
    exit 0
fi

log "✓ Cambios obtenidos: $BEFORE_COMMIT -> $AFTER_COMMIT"

# ============================================
# PASO 2: Verificar cambios importantes
# ============================================
info "Paso 2/4: Analizando cambios..."

# Ver qué archivos cambiaron
CHANGED_FILES=$(git diff --name-only "$BEFORE_COMMIT" "$AFTER_COMMIT")
log "Archivos modificados:"
echo "$CHANGED_FILES" | tee -a "$LOG_FILE"

# Verificar si hay cambios en dependencias
if echo "$CHANGED_FILES" | grep -q "package.json\|pnpm-lock.yaml"; then
    warning "Se detectaron cambios en dependencias. Se reinstalarán."
    REBUILD_DEPS=true
else
    REBUILD_DEPS=false
fi

# ============================================
# PASO 3: Ejecutar deploy
# ============================================
info "Paso 3/4: Ejecutando script de deploy..."

# Dar permisos de ejecución si no los tiene
chmod +x "$PROJECT_DIR/deploy.sh"

# Ejecutar deploy
if bash "$PROJECT_DIR/deploy.sh"; then
    log "✓ Deploy ejecutado exitosamente"
else
    error "Error en el deploy"
    
    # Rollback en caso de error
    warning "Realizando rollback..."
    git reset --hard "$BEFORE_COMMIT"
    bash "$PROJECT_DIR/deploy.sh"
    
    error "Deploy fallido. Sistema restaurado a commit anterior."
    exit 1
fi

# ============================================
# PASO 4: Notificación (opcional)
# ============================================
info "Paso 4/4: Enviando notificaciones..."

# Aquí puedes agregar notificaciones (Slack, Discord, email, etc.)
# Ejemplo con curl a Slack:
# curl -X POST -H 'Content-type: application/json' \
#   --data "{\"text\":\"✓ Deploy exitoso: $AFTER_COMMIT\"}" \
#   YOUR_SLACK_WEBHOOK_URL

# ============================================
# Resumen final
# ============================================
echo ""
log "════════════════════════════════════════"
log "     ✓ AUTODEPLOY COMPLETADO"
log "════════════════════════════════════════"
log "Commit anterior: $BEFORE_COMMIT"
log "Nuevo commit: $AFTER_COMMIT"
log "Log guardado en: $LOG_FILE"
log "════════════════════════════════════════"
echo ""

exit 0
