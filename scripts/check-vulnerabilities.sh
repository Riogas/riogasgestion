#!/bin/bash

##############################################
# Script de Verificación de Vulnerabilidades
# Verifica todos los proyectos y envía reporte por email
##############################################

set -e

# Configuración
PROJECTS_DIR="/var/www"
PROJECTS=("goya" "track" "secapi")  # Proyectos de Riogas
EMAIL_TO="jgomez@riogas.com.ar"
EMAIL_FROM="notificacionesautomaticas@riogas.com.uy"
SMTP_SERVER="mail.riogas.com.uy"
SMTP_PORT="25"
SMTP_USER="notificacionesautomaticas@riogas.com.uy"
SMTP_PASS="1710"  # Configurado para servidor SMTP de Riogas

# Autodetectar proyectos si el array está vacío
if [ ${#PROJECTS[@]} -eq 0 ]; then
    log "Autodetectando proyectos en $PROJECTS_DIR..."
    PROJECTS=()
    for dir in "$PROJECTS_DIR"/*; do
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            PROJECTS+=("$(basename "$dir")")
        fi
    done
fi

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Archivo temporal para el reporte
REPORT_FILE="/tmp/vulnerability-report-$(date +%Y%m%d).txt"
HTML_REPORT="/tmp/vulnerability-report-$(date +%Y%m%d).html"

# Función para log
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

# Iniciar reporte
echo "================================================" > "$REPORT_FILE"
echo "REPORTE DE VULNERABILIDADES - $(date +'%d/%m/%Y %H:%M')" >> "$REPORT_FILE"
echo "================================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Contadores globales
TOTAL_CRITICAL=0
TOTAL_HIGH=0
TOTAL_MODERATE=0
TOTAL_LOW=0
PROJECTS_WITH_ISSUES=0

# Verificar cada proyecto
for PROJECT in "${PROJECTS[@]}"; do
    PROJECT_PATH="$PROJECTS_DIR/$PROJECT"
    
    log "Verificando proyecto: $PROJECT"
    echo "" >> "$REPORT_FILE"
    echo "----------------------------------------" >> "$REPORT_FILE"
    echo "PROYECTO: $PROJECT" >> "$REPORT_FILE"
    echo "----------------------------------------" >> "$REPORT_FILE"
    
    if [ ! -d "$PROJECT_PATH" ]; then
        error "El proyecto $PROJECT no existe en $PROJECT_PATH"
        echo "ERROR: Directorio no encontrado" >> "$REPORT_FILE"
        continue
    fi
    
    cd "$PROJECT_PATH"
    
    # Verificar que tenga package.json
    if [ ! -f "package.json" ]; then
        warning "No se encontró package.json en $PROJECT"
        echo "WARNING: No es un proyecto Node.js" >> "$REPORT_FILE"
        continue
    fi
    
    # Obtener versiones actuales
    echo "" >> "$REPORT_FILE"
    echo "Versiones instaladas:" >> "$REPORT_FILE"
    
    if [ -f "package.json" ]; then
        NEXT_VERSION=$(grep -o '"next": "[^"]*"' package.json | cut -d'"' -f4 || echo "N/A")
        REACT_VERSION=$(grep -o '"react": "[^"]*"' package.json | cut -d'"' -f4 || echo "N/A")
        echo "  - Next.js: $NEXT_VERSION" >> "$REPORT_FILE"
        echo "  - React: $REACT_VERSION" >> "$REPORT_FILE"
    fi
    
    # Ejecutar pnpm audit (solo producción)
    echo "" >> "$REPORT_FILE"
    echo "Análisis de vulnerabilidades (producción):" >> "$REPORT_FILE"
    
    if command -v pnpm &> /dev/null; then
        # Capturar salida de pnpm audit
        AUDIT_OUTPUT=$(pnpm audit --prod --json 2>&1 || true)
        
        if echo "$AUDIT_OUTPUT" | grep -q "No known vulnerabilities found"; then
            success "$PROJECT: Sin vulnerabilidades ✅"
            echo "  ✅ Sin vulnerabilidades conocidas" >> "$REPORT_FILE"
        else
            # Parsear JSON para contar vulnerabilidades
            CRITICAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo 0)
            HIGH=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo 0)
            MODERATE=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.moderate // 0' 2>/dev/null || echo 0)
            LOW=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.low // 0' 2>/dev/null || echo 0)
            
            TOTAL_CRITICAL=$((TOTAL_CRITICAL + CRITICAL))
            TOTAL_HIGH=$((TOTAL_HIGH + HIGH))
            TOTAL_MODERATE=$((TOTAL_MODERATE + MODERATE))
            TOTAL_LOW=$((TOTAL_LOW + LOW))
            
            if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
                error "$PROJECT: Vulnerabilidades CRÍTICAS encontradas!"
                PROJECTS_WITH_ISSUES=$((PROJECTS_WITH_ISSUES + 1))
            else
                warning "$PROJECT: Vulnerabilidades menores encontradas"
            fi
            
            echo "  ⚠️  Vulnerabilidades encontradas:" >> "$REPORT_FILE"
            echo "     - Críticas: $CRITICAL" >> "$REPORT_FILE"
            echo "     - High: $HIGH" >> "$REPORT_FILE"
            echo "     - Moderate: $MODERATE" >> "$REPORT_FILE"
            echo "     - Low: $LOW" >> "$REPORT_FILE"
            
            # Agregar detalles de vulnerabilidades
            echo "" >> "$REPORT_FILE"
            echo "  Detalles:" >> "$REPORT_FILE"
            pnpm audit --prod 2>&1 | grep -A 5 "Package" >> "$REPORT_FILE" || true
        fi
    else
        error "pnpm no está instalado"
        echo "  ❌ ERROR: pnpm no disponible" >> "$REPORT_FILE"
    fi
    
    # Verificar actualizaciones disponibles
    echo "" >> "$REPORT_FILE"
    echo "Actualizaciones disponibles:" >> "$REPORT_FILE"
    
    if command -v pnpm &> /dev/null; then
        OUTDATED=$(pnpm outdated --prod 2>&1 || true)
        
        if echo "$OUTDATED" | grep -q "All dependencies up-to-date"; then
            echo "  ✅ Todas las dependencias están actualizadas" >> "$REPORT_FILE"
        else
            echo "$OUTDATED" >> "$REPORT_FILE"
        fi
    fi
    
    echo "" >> "$REPORT_FILE"
done

# Resumen final
echo "" >> "$REPORT_FILE"
echo "================================================" >> "$REPORT_FILE"
echo "RESUMEN GENERAL" >> "$REPORT_FILE"
echo "================================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Total de vulnerabilidades encontradas:" >> "$REPORT_FILE"
echo "  - Críticas: $TOTAL_CRITICAL" >> "$REPORT_FILE"
echo "  - High: $TOTAL_HIGH" >> "$REPORT_FILE"
echo "  - Moderate: $TOTAL_MODERATE" >> "$REPORT_FILE"
echo "  - Low: $TOTAL_LOW" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Proyectos con vulnerabilidades críticas/high: $PROJECTS_WITH_ISSUES de ${#PROJECTS[@]}" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Recomendaciones
if [ $TOTAL_CRITICAL -gt 0 ] || [ $TOTAL_HIGH -gt 0 ]; then
    echo "⚠️  ACCIÓN REQUERIDA:" >> "$REPORT_FILE"
    echo "Se encontraron vulnerabilidades críticas o high." >> "$REPORT_FILE"
    echo "Ejecutar en cada proyecto:" >> "$REPORT_FILE"
    echo "  cd /var/www/<proyecto>" >> "$REPORT_FILE"
    echo "  pnpm update" >> "$REPORT_FILE"
    echo "  pnpm audit --prod" >> "$REPORT_FILE"
    echo "  pnpm build" >> "$REPORT_FILE"
    echo "  pm2 restart <proyecto>" >> "$REPORT_FILE"
else
    echo "✅ No se requiere acción inmediata." >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "Reporte generado: $(date +'%d/%m/%Y %H:%M:%S')" >> "$REPORT_FILE"

# Mostrar reporte en consola
cat "$REPORT_FILE"

# Generar HTML para email
cat > "$HTML_REPORT" << EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .critical { color: #e74c3c; font-weight: bold; }
        .high { color: #e67e22; font-weight: bold; }
        .moderate { color: #f39c12; }
        .success { color: #27ae60; font-weight: bold; }
        .summary { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .project { background: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #3498db; color: white; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #ecf0f1; font-size: 0.9em; color: #7f8c8d; }
    </style>
</head>
<body>
    <h1>🔒 Reporte de Vulnerabilidades - Riogas</h1>
    <p><strong>Fecha:</strong> $(date +'%d/%m/%Y %H:%M:%S')</p>
    
    <div class="summary">
        <h2>📊 Resumen General</h2>
        <table>
            <tr>
                <th>Nivel</th>
                <th>Cantidad</th>
            </tr>
            <tr>
                <td class="critical">Críticas</td>
                <td class="critical">$TOTAL_CRITICAL</td>
            </tr>
            <tr>
                <td class="high">High</td>
                <td class="high">$TOTAL_HIGH</td>
            </tr>
            <tr>
                <td class="moderate">Moderate</td>
                <td>$TOTAL_MODERATE</td>
            </tr>
            <tr>
                <td>Low</td>
                <td>$TOTAL_LOW</td>
            </tr>
        </table>
        <p><strong>Proyectos con issues críticos:</strong> $PROJECTS_WITH_ISSUES de ${#PROJECTS[@]}</p>
    </div>
EOF

# Agregar detalles por proyecto
for PROJECT in "${PROJECTS[@]}"; do
    cat >> "$HTML_REPORT" << EOF
    <div class="project">
        <h2>📦 Proyecto: $PROJECT</h2>
        <p><em>Ver detalles en el reporte de texto adjunto</em></p>
    </div>
EOF
done

# Cerrar HTML
cat >> "$HTML_REPORT" << EOF
    <div class="footer">
        <p>Este es un reporte automático generado por el servidor de Riogas.</p>
        <p>Para más detalles, consultar el archivo adjunto o acceder al servidor.</p>
    </div>
</body>
</html>
EOF

# Enviar email si está configurado
if [ -n "$SMTP_PASS" ]; then
    log "Enviando reporte por email..."
    
    SUBJECT="[Riogas] Reporte de Vulnerabilidades - $(date +'%d/%m/%Y')"
    
    if [ $TOTAL_CRITICAL -gt 0 ] || [ $TOTAL_HIGH -gt 0 ]; then
        SUBJECT="⚠️ [URGENTE] $SUBJECT"
    fi
    
    # Intentar diferentes métodos de envío
    EMAIL_SENT=false
    
    # Método 1: swaks (Swiss Army Knife for SMTP)
    if command -v swaks &> /dev/null && [ "$EMAIL_SENT" = false ]; then
        log "Usando swaks (SMTP directo)..."
        
        # Crear archivo temporal con HTML
        TEMP_EMAIL="/tmp/email-body-$$.html"
        cat "$HTML_REPORT" > "$TEMP_EMAIL"
        
        swaks --to "$EMAIL_TO" \
              --from "$EMAIL_FROM" \
              --server "$SMTP_SERVER" \
              --port "$SMTP_PORT" \
              --auth LOGIN \
              --auth-user "$SMTP_USER" \
              --auth-password "$SMTP_PASS" \
              --header "Subject: $SUBJECT" \
              --header "Content-Type: text/html; charset=UTF-8" \
              --body "$TEMP_EMAIL" \
              --attach "$REPORT_FILE" 2>&1
        
        if [ $? -eq 0 ]; then
            EMAIL_SENT=true
            success "Email enviado correctamente (swaks)"
        fi
        
        rm -f "$TEMP_EMAIL"
    fi
    
    # Método 2: Python con smtplib (más confiable para SMTP con autenticación)
    if command -v python3 &> /dev/null && [ "$EMAIL_SENT" = false ]; then
        log "Usando Python SMTP..."
        
        python3 << PYTHON_SCRIPT
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

try:
    # Crear mensaje
    msg = MIMEMultipart()
    msg['From'] = "$EMAIL_FROM"
    msg['To'] = "$EMAIL_TO"
    msg['Subject'] = "$SUBJECT"
    
    # Leer HTML
    with open("$HTML_REPORT", 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Agregar cuerpo HTML
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))
    
    # Adjuntar reporte TXT
    with open("$REPORT_FILE", 'rb') as f:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment; filename="reporte.txt"')
        msg.attach(part)
    
    # Conectar y enviar
    server = smtplib.SMTP("$SMTP_SERVER", $SMTP_PORT)
    server.ehlo()
    
    # Autenticación si es necesaria
    try:
        server.login("$SMTP_USER", "$SMTP_PASS")
    except:
        pass  # Puerto 25 puede no requerir autenticación
    
    server.send_message(msg)
    server.quit()
    
    print("SUCCESS")
    sys.exit(0)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT
        
        if [ $? -eq 0 ]; then
            EMAIL_SENT=true
            success "Email enviado correctamente (Python SMTP)"
        fi
    fi
    
    # Método 3: sendmail con configuración SMTP
    if command -v sendmail &> /dev/null && [ "$EMAIL_SENT" = false ]; then
        log "Usando sendmail..."
        (
            echo "To: $EMAIL_TO"
            echo "From: $EMAIL_FROM"
            echo "Subject: $SUBJECT"
            echo "Content-Type: text/html; charset=UTF-8"
            echo ""
            cat "$HTML_REPORT"
        ) | sendmail -t
        EMAIL_SENT=true
        success "Email enviado correctamente (sendmail)"
    fi
    
    # Método 4: mail (simple)
    if command -v mail &> /dev/null && [ "$EMAIL_SENT" = false ]; then
        log "Usando mail..."
        cat "$HTML_REPORT" | mail -s "$SUBJECT" "$EMAIL_TO"
        EMAIL_SENT=true
        success "Email enviado correctamente (mail)"
    fi
    
    if [ "$EMAIL_SENT" = false ]; then
        warning "No se pudo enviar email con ningún método"
        warning "Instalar: sudo apt-get install swaks"
        warning "O usar Python (ya instalado en la mayoría de sistemas)"
    fi
else
    warning "No se configuró contraseña SMTP"
fi

log "Reporte guardado en: $REPORT_FILE"
log "Reporte HTML en: $HTML_REPORT"

# Retornar código de salida
if [ $TOTAL_CRITICAL -gt 0 ] || [ $TOTAL_HIGH -gt 0 ]; then
    exit 1
else
    exit 0
fi
