#!/bin/bash

##############################################
# Test de Envío de Email
# Prueba la configuración SMTP de Riogas
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
echo "  Test de Configuración SMTP - Riogas"
echo "================================================"
echo ""

# Configuración SMTP de Riogas
SMTP_SERVER="mail.riogas.com.uy"
SMTP_PORT="25"
SMTP_USER="notificacionesautomaticas@riogas.com.uy"
SMTP_PASS="1710"
EMAIL_FROM="notificacionesautomaticas@riogas.com.uy"

# Pedir email de destino
read -p "Email de destino para la prueba: " EMAIL_TO

if [ -z "$EMAIL_TO" ]; then
    error "Debe proporcionar un email de destino"
    exit 1
fi

log "Configuración:"
echo "  - Servidor: $SMTP_SERVER"
echo "  - Puerto: $SMTP_PORT"
echo "  - Usuario: $SMTP_USER"
echo "  - De: $EMAIL_FROM"
echo "  - Para: $EMAIL_TO"
echo ""

# Crear mensaje de prueba
SUBJECT="[TEST] Configuración SMTP - Riogas"
BODY="Este es un email de prueba para verificar la configuración SMTP de Riogas.

Configuración utilizada:
- Servidor: $SMTP_SERVER
- Puerto: $SMTP_PORT
- Usuario: $SMTP_USER

Si recibes este email, la configuración está funcionando correctamente.

Fecha: $(date)
"

# Método 1: Python (más confiable)
if command -v python3 &> /dev/null; then
    log "Probando con Python SMTP..."
    
    python3 << PYTHON_SCRIPT
import smtplib
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

try:
    # Crear mensaje
    msg = MIMEMultipart()
    msg['From'] = "$EMAIL_FROM"
    msg['To'] = "$EMAIL_TO"
    msg['Subject'] = "$SUBJECT"
    
    body = """$BODY"""
    msg.attach(MIMEText(body, 'plain', 'utf-8'))
    
    # Conectar y enviar
    print("Conectando a $SMTP_SERVER:$SMTP_PORT...", file=sys.stderr)
    server = smtplib.SMTP("$SMTP_SERVER", $SMTP_PORT, timeout=10)
    server.set_debuglevel(0)
    server.ehlo()
    
    # Intentar autenticación
    try:
        print("Autenticando...", file=sys.stderr)
        server.login("$SMTP_USER", "$SMTP_PASS")
        print("Autenticación exitosa", file=sys.stderr)
    except Exception as e:
        print(f"Nota: Autenticación no requerida o falló: {e}", file=sys.stderr)
        # Continuar sin autenticación
    
    # Enviar
    print("Enviando email...", file=sys.stderr)
    server.send_message(msg)
    server.quit()
    
    print("✓ Email enviado exitosamente", file=sys.stderr)
    sys.exit(0)
    
except Exception as e:
    print(f"✗ Error: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYTHON_SCRIPT
    
    if [ $? -eq 0 ]; then
        echo ""
        success "Email enviado correctamente con Python"
        echo ""
        echo "Revisa tu bandeja de entrada (y spam) en: $EMAIL_TO"
        exit 0
    else
        echo ""
        error "Falló el envío con Python"
    fi
fi

# Método 2: swaks
if command -v swaks &> /dev/null; then
    log "Probando con swaks..."
    
    swaks --to "$EMAIL_TO" \
          --from "$EMAIL_FROM" \
          --server "$SMTP_SERVER" \
          --port "$SMTP_PORT" \
          --auth LOGIN \
          --auth-user "$SMTP_USER" \
          --auth-password "$SMTP_PASS" \
          --header "Subject: $SUBJECT" \
          --body "$BODY"
    
    if [ $? -eq 0 ]; then
        echo ""
        success "Email enviado correctamente con swaks"
        echo ""
        echo "Revisa tu bandeja de entrada (y spam) en: $EMAIL_TO"
        exit 0
    else
        echo ""
        error "Falló el envío con swaks"
    fi
fi

# Método 3: telnet manual
if command -v telnet &> /dev/null; then
    warning "Probando conexión básica con telnet..."
    
    timeout 5 telnet "$SMTP_SERVER" "$SMTP_PORT" << EOF
EHLO test
QUIT
EOF
    
    if [ $? -eq 0 ]; then
        success "Conexión SMTP exitosa"
        echo ""
        echo "El servidor responde, pero se necesita Python o swaks para enviar emails"
    else
        error "No se pudo conectar al servidor SMTP"
    fi
fi

# Método 4: nc (netcat)
if command -v nc &> /dev/null; then
    log "Verificando puerto con nc..."
    
    if nc -zv "$SMTP_SERVER" "$SMTP_PORT" 2>&1 | grep -q "succeeded\|open"; then
        success "Puerto $SMTP_PORT está abierto en $SMTP_SERVER"
    else
        error "No se pudo conectar al puerto $SMTP_PORT"
        echo ""
        echo "Posibles problemas:"
        echo "  - Firewall bloqueando conexiones"
        echo "  - Servidor SMTP no accesible desde esta red"
        echo "  - Puerto incorrecto"
    fi
fi

echo ""
echo "================================================"
echo "Resumen de Prueba"
echo "================================================"
echo ""

if ! command -v python3 &> /dev/null && ! command -v swaks &> /dev/null; then
    error "No se encontró Python3 ni swaks"
    echo ""
    echo "Para enviar emails, instalar uno de estos:"
    echo ""
    echo "  Opción 1 (Recomendado): Python3"
    echo "    sudo apt-get install python3"
    echo ""
    echo "  Opción 2: swaks"
    echo "    sudo apt-get install swaks"
    echo ""
    exit 1
fi

echo "Verifica tu email: $EMAIL_TO"
echo ""
echo "Si no recibiste el email, revisa:"
echo "  1. Carpeta de spam/correo no deseado"
echo "  2. Firewall del servidor"
echo "  3. Logs del servidor SMTP"
echo ""
