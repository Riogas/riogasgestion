#!/bin/bash

##############################################
# Script de Actualización de Vulnerabilidades
# Actualiza automáticamente todos los proyectos
##############################################

set -e

# Configuración
PROJECTS_DIR="/var/www"
PROJECTS=("goya" "track")  # Ajustar según tus proyectos

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo "================================================"
echo "  Actualización Automática de Vulnerabilidades"
echo "================================================"
echo ""

# Verificar que estamos como usuario correcto
if [ "$USER" != "riogas" ] && [ "$USER" != "root" ]; then
    warning "Se recomienda ejecutar como usuario riogas o root"
fi

# Autodetectar proyectos si el array está vacío
if [ ${#PROJECTS[@]} -eq 0 ]; then
    log "Autodetectando proyectos en $PROJECTS_DIR..."
    PROJECTS=()
    for dir in "$PROJECTS_DIR"/*; do
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            PROJECTS+=("$(basename "$dir")")
        fi
    done
    log "Proyectos detectados: ${PROJECTS[*]}"
fi

UPDATED_COUNT=0
FAILED_COUNT=0

# Función para hacer backup
backup_project() {
    local PROJECT=$1
    local PROJECT_PATH="$PROJECTS_DIR/$PROJECT"
    local BACKUP_DIR="/tmp/backups"
    local BACKUP_NAME="${PROJECT}-$(date +%Y%m%d-%H%M%S)"
    
    log "Creando backup de $PROJECT..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup de node_modules y package-lock
    if [ -d "$PROJECT_PATH/node_modules" ]; then
        tar -czf "$BACKUP_DIR/${BACKUP_NAME}-modules.tar.gz" \
            -C "$PROJECT_PATH" \
            node_modules package.json pnpm-lock.yaml 2>/dev/null || true
        success "Backup creado: $BACKUP_DIR/${BACKUP_NAME}-modules.tar.gz"
    fi
}

# Función para actualizar un proyecto
update_project() {
    local PROJECT=$1
    local PROJECT_PATH="$PROJECTS_DIR/$PROJECT"
    
    log "Actualizando proyecto: $PROJECT"
    echo "----------------------------------------"
    
    if [ ! -d "$PROJECT_PATH" ]; then
        error "El proyecto $PROJECT no existe en $PROJECT_PATH"
        return 1
    fi
    
    cd "$PROJECT_PATH"
    
    # Verificar que tenga package.json
    if [ ! -f "package.json" ]; then
        warning "No se encontró package.json en $PROJECT"
        return 1
    fi
    
    # Backup antes de actualizar
    backup_project "$PROJECT"
    
    # Git: guardar cambios si hay
    if [ -d ".git" ]; then
        log "Verificando git..."
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            warning "Hay cambios sin commitear"
            read -p "¿Hacer commit automático? (y/n) [n]: " DO_COMMIT
            if [ "$DO_COMMIT" = "y" ]; then
                git add -A
                git commit -m "chore: backup antes de actualización automática de seguridad"
            fi
        fi
    fi
    
    # Actualizar dependencias
    log "Actualizando dependencias..."
    
    if command -v pnpm &> /dev/null; then
        # Actualizar pnpm primero
        log "Actualizando pnpm..."
        npm install -g pnpm@latest || true
        
        # Limpiar caché
        pnpm store prune
        
        # Actualizar dependencias de producción
        log "Actualizando dependencias de producción..."
        pnpm update --prod
        
        # Verificar vulnerabilidades
        log "Verificando vulnerabilidades..."
        AUDIT_OUTPUT=$(pnpm audit --prod 2>&1 || true)
        
        if echo "$AUDIT_OUTPUT" | grep -q "No known vulnerabilities found"; then
            success "$PROJECT: Actualización exitosa ✅"
            UPDATED_COUNT=$((UPDATED_COUNT + 1))
        else
            warning "$PROJECT: Aún hay vulnerabilidades"
            echo "$AUDIT_OUTPUT"
            
            # Intentar fix automático
            log "Intentando fix automático..."
            pnpm update --latest || true
            
            # Verificar de nuevo
            AUDIT_OUTPUT=$(pnpm audit --prod 2>&1 || true)
            if echo "$AUDIT_OUTPUT" | grep -q "No known vulnerabilities found"; then
                success "$PROJECT: Fix exitoso ✅"
                UPDATED_COUNT=$((UPDATED_COUNT + 1))
            else
                error "$PROJECT: Requiere intervención manual"
                FAILED_COUNT=$((FAILED_COUNT + 1))
            fi
        fi
        
        # Rebuild
        log "Rebuilding proyecto..."
        if pnpm build; then
            success "Build exitoso"
        else
            error "Build falló - revisar logs"
            FAILED_COUNT=$((FAILED_COUNT + 1))
            return 1
        fi
        
        # Restart PM2
        if command -v pm2 &> /dev/null; then
            log "Reiniciando con PM2..."
            pm2 restart "$PROJECT" || pm2 start "pm2.config.js" --only "$PROJECT" || true
            success "PM2 reiniciado"
        fi
        
    else
        error "pnpm no está instalado"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        return 1
    fi
    
    echo ""
    return 0
}

# Preguntar confirmación
echo "Se actualizarán los siguientes proyectos:"
for PROJECT in "${PROJECTS[@]}"; do
    echo "  - $PROJECT"
done
echo ""
read -p "¿Continuar? (y/n) [n]: " CONFIRM
CONFIRM=${CONFIRM:-n}

if [ "$CONFIRM" != "y" ]; then
    warning "Actualización cancelada"
    exit 0
fi

# Actualizar cada proyecto
for PROJECT in "${PROJECTS[@]}"; do
    update_project "$PROJECT" || true
    echo ""
done

# Resumen
echo "================================================"
echo "RESUMEN"
echo "================================================"
echo ""
echo "Proyectos actualizados: $UPDATED_COUNT"
echo "Proyectos con errores: $FAILED_COUNT"
echo ""

if [ $FAILED_COUNT -eq 0 ]; then
    success "Todas las actualizaciones completadas exitosamente ✅"
    
    # Verificación final
    log "Ejecutando verificación final..."
    cd "$PROJECTS_DIR/${PROJECTS[0]}"
    bash scripts/check-vulnerabilities.sh
    
    exit 0
else
    warning "Algunas actualizaciones fallaron. Revisar logs."
    exit 1
fi
