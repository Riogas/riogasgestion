#!/bin/bash

##############################################
# Instalador de Monitoreo de Vulnerabilidades
# Configura cron job para verificación semanal
##############################################

set -e

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
echo "  Instalador de Monitoreo de Vulnerabilidades"
echo "================================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "pm2.config.js" ]; then
    error "Este script debe ejecutarse desde el directorio del proyecto"
    exit 1
fi

SCRIPT_DIR="$(pwd)/scripts"
SCRIPT_PATH="$SCRIPT_DIR/check-vulnerabilities.sh"

# Crear directorio de scripts si no existe
if [ ! -d "$SCRIPT_DIR" ]; then
    log "Creando directorio de scripts..."
    mkdir -p "$SCRIPT_DIR"
fi

# Copiar script de verificación
if [ ! -f "$SCRIPT_PATH" ]; then
    error "No se encontró check-vulnerabilities.sh"
    error "Asegúrate de tener el archivo en: $SCRIPT_PATH"
    exit 1
fi

# Dar permisos de ejecución
log "Configurando permisos..."
chmod +x "$SCRIPT_PATH"
success "Permisos configurados"

# Configurar email
echo ""
echo "Configuración de Email"
echo "----------------------"
read -p "Email para recibir reportes [jgomez@riogas.com.ar]: " EMAIL_TO
EMAIL_TO=${EMAIL_TO:-jgomez@riogas.com.ar}

read -p "Email de origen [notificaciones@riogas.com.ar]: " EMAIL_FROM
EMAIL_FROM=${EMAIL_FROM:-notificaciones@riogas.com.ar}

read -p "Usuario SMTP [notificaciones@riogas.com.ar]: " SMTP_USER
SMTP_USER=${SMTP_USER:-notificaciones@riogas.com.ar}

read -s -p "Contraseña SMTP: " SMTP_PASS
echo ""

# Actualizar script con configuración
log "Actualizando configuración en el script..."
sed -i "s|EMAIL_TO=\".*\"|EMAIL_TO=\"$EMAIL_TO\"|" "$SCRIPT_PATH"
sed -i "s|EMAIL_FROM=\".*\"|EMAIL_FROM=\"$EMAIL_FROM\"|" "$SCRIPT_PATH"
sed -i "s|SMTP_USER=\".*\"|SMTP_USER=\"$SMTP_USER\"|" "$SCRIPT_PATH"
sed -i "s|SMTP_PASS=\"\"|SMTP_PASS=\"$SMTP_PASS\"|" "$SCRIPT_PATH"

success "Configuración actualizada"

# Configurar cron job
echo ""
echo "Configuración de Cron Job"
echo "-------------------------"
echo "Opciones disponibles:"
echo "  1) Lunes a las 09:00"
echo "  2) Viernes a las 18:00"
echo "  3) Domingo a las 22:00"
echo "  4) Personalizado"
read -p "Selecciona una opción [1]: " CRON_OPTION
CRON_OPTION=${CRON_OPTION:-1}

case $CRON_OPTION in
    1)
        CRON_TIME="0 9 * * 1"
        CRON_DESC="Lunes a las 09:00"
        ;;
    2)
        CRON_TIME="0 18 * * 5"
        CRON_DESC="Viernes a las 18:00"
        ;;
    3)
        CRON_TIME="0 22 * * 0"
        CRON_DESC="Domingo a las 22:00"
        ;;
    4)
        read -p "Expresión cron (ej: 0 9 * * 1): " CRON_TIME
        CRON_DESC="Personalizado: $CRON_TIME"
        ;;
    *)
        error "Opción inválida"
        exit 1
        ;;
esac

# Crear entrada de cron
CRON_COMMAND="$CRON_TIME $SCRIPT_PATH >> /var/log/vulnerability-check.log 2>&1"

log "Agregando cron job..."

# Verificar si ya existe
if crontab -l 2>/dev/null | grep -q "check-vulnerabilities.sh"; then
    warning "Ya existe un cron job para este script"
    read -p "¿Reemplazar? (y/n) [y]: " REPLACE
    REPLACE=${REPLACE:-y}
    
    if [ "$REPLACE" = "y" ]; then
        # Remover entrada anterior
        crontab -l 2>/dev/null | grep -v "check-vulnerabilities.sh" | crontab -
        log "Cron job anterior removido"
    else
        warning "Instalación cancelada"
        exit 0
    fi
fi

# Agregar nueva entrada
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

success "Cron job configurado: $CRON_DESC"

# Instalar dependencias si es necesario
echo ""
log "Verificando dependencias..."

# Verificar jq (para parsear JSON)
if ! command -v jq &> /dev/null; then
    warning "jq no está instalado (necesario para parsear auditorías)"
    read -p "¿Instalar jq? (y/n) [y]: " INSTALL_JQ
    INSTALL_JQ=${INSTALL_JQ:-y}
    
    if [ "$INSTALL_JQ" = "y" ]; then
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        elif command -v yum &> /dev/null; then
            sudo yum install -y jq
        else
            error "No se pudo instalar jq automáticamente"
            echo "Instalar manualmente: https://stedolan.github.io/jq/download/"
        fi
    fi
fi

# Verificar mailx (para enviar emails)
if ! command -v mailx &> /dev/null; then
    warning "mailx no está instalado (necesario para enviar emails)"
    read -p "¿Instalar mailx? (y/n) [y]: " INSTALL_MAILX
    INSTALL_MAILX=${INSTALL_MAILX:-y}
    
    if [ "$INSTALL_MAILX" = "y" ]; then
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y mailutils
        elif command -v yum &> /dev/null; then
            sudo yum install -y mailx
        else
            error "No se pudo instalar mailx automáticamente"
        fi
    fi
fi

# Crear archivo de log
sudo touch /var/log/vulnerability-check.log
sudo chmod 644 /var/log/vulnerability-check.log

# Prueba de ejecución
echo ""
read -p "¿Ejecutar prueba ahora? (y/n) [y]: " RUN_TEST
RUN_TEST=${RUN_TEST:-y}

if [ "$RUN_TEST" = "y" ]; then
    log "Ejecutando prueba..."
    echo ""
    bash "$SCRIPT_PATH"
    echo ""
    success "Prueba completada"
fi

# Resumen
echo ""
echo "================================================"
echo "✅ Instalación Completada"
echo "================================================"
echo ""
echo "Configuración:"
echo "  - Script: $SCRIPT_PATH"
echo "  - Frecuencia: $CRON_DESC"
echo "  - Email: $EMAIL_TO"
echo "  - Log: /var/log/vulnerability-check.log"
echo ""
echo "Comandos útiles:"
echo "  - Ver cron jobs: crontab -l"
echo "  - Editar cron jobs: crontab -e"
echo "  - Ver log: tail -f /var/log/vulnerability-check.log"
echo "  - Ejecutar manualmente: bash $SCRIPT_PATH"
echo ""
echo "Para desinstalar:"
echo "  crontab -l | grep -v 'check-vulnerabilities.sh' | crontab -"
echo ""
