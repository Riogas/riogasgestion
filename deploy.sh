#!/bin/bash

# ============================================
# SCRIPT DE DEPLOY PARA RIOGASGESTION
# ============================================
# Este script maneja el rebuild y deploy completo
# de la aplicación Next.js con Docker
# ============================================

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
PROJECT_NAME="riogasgestion"
CONTAINER_NAME="${PROJECT_NAME}-app"
IMAGE_NAME="${PROJECT_NAME}:latest"
BACKUP_IMAGE="${PROJECT_NAME}:backup"
LOG_FILE="./logs/deploy_$(date +%Y%m%d_%H%M%S).log"

# Crear directorio de logs si no existe
mkdir -p logs

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

# Banner
echo -e "${GREEN}"
echo "╔════════════════════════════════════════╗"
echo "║   DEPLOY SCRIPT - RIOGASGESTION        ║"
echo "║   Automated Docker Deploy & Rebuild    ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    error "No se encuentra package.json. Ejecuta este script desde el directorio raíz del proyecto."
    exit 1
fi

# Verificar que Docker está instalado y corriendo
if ! command -v docker &> /dev/null; then
    error "Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi

if ! docker info &> /dev/null; then
    error "Docker no está corriendo. Por favor inicia el servicio de Docker."
    exit 1
fi

# Verificar que docker-compose está instalado
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error "docker-compose no está instalado."
    exit 1
fi

log "✓ Verificaciones iniciales completadas"

# ============================================
# PASO 1: Backup de la imagen actual
# ============================================
info "Paso 1/7: Haciendo backup de la imagen actual..."

if docker image inspect "$IMAGE_NAME" &> /dev/null; then
    docker tag "$IMAGE_NAME" "$BACKUP_IMAGE"
    log "✓ Backup de imagen creado: $BACKUP_IMAGE"
else
    warning "No hay imagen anterior para hacer backup"
fi

# ============================================
# PASO 2: Detener contenedores actuales
# ============================================
info "Paso 2/7: Deteniendo contenedores actuales..."

if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
    docker-compose down
    log "✓ Contenedores detenidos correctamente"
else
    warning "No hay contenedores corriendo"
fi

# ============================================
# PASO 3: Limpiar imágenes antiguas (opcional)
# ============================================
info "Paso 3/7: Limpiando imágenes antiguas..."

# Eliminar imágenes dangling (opcional)
docker image prune -f &> /dev/null || true
log "✓ Limpieza completada"

# ============================================
# PASO 4: Build de nueva imagen
# ============================================
info "Paso 4/7: Construyendo nueva imagen Docker..."

if docker-compose build --no-cache; then
    log "✓ Imagen construida exitosamente"
else
    error "Error al construir la imagen"
    
    # Rollback al backup si existe
    if docker image inspect "$BACKUP_IMAGE" &> /dev/null; then
        warning "Restaurando imagen anterior..."
        docker tag "$BACKUP_IMAGE" "$IMAGE_NAME"
        docker-compose up -d
        error "Deploy fallido. Sistema restaurado a versión anterior."
    fi
    
    exit 1
fi

# ============================================
# PASO 5: Verificar variables de entorno
# ============================================
info "Paso 5/7: Verificando variables de entorno..."

if [ ! -f ".env.production" ]; then
    warning "Archivo .env.production no encontrado. Usando valores por defecto."
    warning "Crea un archivo .env.production basado en .env.production.example"
fi

# ============================================
# PASO 6: Iniciar contenedores
# ============================================
info "Paso 6/7: Iniciando contenedores..."

if docker-compose up -d; then
    log "✓ Contenedores iniciados correctamente"
else
    error "Error al iniciar contenedores"
    
    # Rollback
    if docker image inspect "$BACKUP_IMAGE" &> /dev/null; then
        warning "Restaurando versión anterior..."
        docker tag "$BACKUP_IMAGE" "$IMAGE_NAME"
        docker-compose up -d
        error "Deploy fallido. Sistema restaurado a versión anterior."
    fi
    
    exit 1
fi

# ============================================
# PASO 7: Healthcheck
# ============================================
info "Paso 7/7: Verificando estado de la aplicación..."

# Esperar a que el contenedor esté saludable
MAX_ATTEMPTS=30
ATTEMPT=0
HEALTHY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
    
    if [ "$HEALTH_STATUS" = "healthy" ]; then
        HEALTHY=true
        break
    fi
    
    echo -n "."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

echo ""

if [ "$HEALTHY" = true ]; then
    log "✓ Aplicación saludable y corriendo correctamente"
else
    warning "La aplicación está corriendo pero el healthcheck no respondió"
    warning "Verifica manualmente con: docker logs $CONTAINER_NAME"
fi

# ============================================
# Información final
# ============================================
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}     ✓ DEPLOY COMPLETADO EXITOSAMENTE${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

info "Estado de contenedores:"
docker-compose ps

echo ""
info "Ver logs en tiempo real:"
echo "  docker-compose logs -f"
echo ""
info "Ver logs guardados:"
echo "  cat $LOG_FILE"
echo ""
info "Acceder al contenedor:"
echo "  docker exec -it $CONTAINER_NAME sh"
echo ""

# Limpiar imagen de backup si todo salió bien
if [ "$HEALTHY" = true ]; then
    docker rmi "$BACKUP_IMAGE" &> /dev/null || true
fi

log "Deploy completado en: $(date)"
exit 0
