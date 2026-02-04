#!/bin/bash

##############################################
# Script Mejorado de Verificación de Vulnerabilidades
# Genera comandos específicos para resolver cada vulnerabilidad
##############################################

set -e

# Configuración
PROJECTS_DIR="/var/www"
PROJECTS=("goya" "track" "secapi")
EMAIL_TO="julio.gomez@riogas.com.uy"
EMAIL_FROM="notificacionesautomaticas@riogas.com.uy"
SMTP_SERVER="mail.riogas.com.uy"
SMTP_PORT="25"
SMTP_USER="notificacionesautomaticas@riogas.com.uy"
SMTP_PASS="1710"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Archivos temporales
REPORT_FILE="/tmp/vulnerability-report-$(date +%Y%m%d).txt"
HTML_REPORT="/tmp/vulnerability-report-$(date +%Y%m%d).html"
COMMANDS_FILE="/tmp/fix-commands-$(date +%Y%m%d).sh"

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

# Función para extraer paquetes vulnerables de pnpm audit
extract_vulnerable_packages() {
    local audit_output="$1"
    local project_name="$2"
    local packages=()
    
    # Parsear JSON de pnpm audit
    if command -v jq &> /dev/null; then
        # Intentar parsear como JSON
        local vulns=$(echo "$audit_output" | jq -r '.vulnerabilities | to_entries[] | "\(.key):\(.value.via[0].name):\(.value.range)"' 2>/dev/null || true)
        
        if [ -n "$vulns" ]; then
            while IFS=: read -r pkg name range; do
                # Determinar versión a instalar
                if [[ "$name" == "next" ]]; then
                    echo "next@16.1.6"
                elif [[ "$name" == "axios" ]]; then
                    echo "axios@latest"
                elif [[ "$name" == "lodash" ]] || [[ "$name" == "lodash-es" ]]; then
                    echo "lodash@latest"
                else
                    echo "${name}@latest"
                fi
            done <<< "$vulns" | sort -u
        fi
    fi
}

# Función para generar comandos de resolución específicos
generate_fix_commands() {
    local project="$1"
    local audit_output="$2"
    local project_path="$PROJECTS_DIR/$project"
    
    echo "" >> "$COMMANDS_FILE"
    echo "# ========================================" >> "$COMMANDS_FILE"
    echo "# Comandos para $project" >> "$COMMANDS_FILE"
    echo "# ========================================" >> "$COMMANDS_FILE"
    echo "" >> "$COMMANDS_FILE"
    echo "cd $project_path" >> "$COMMANDS_FILE"
    echo "" >> "$COMMANDS_FILE"
    
    # Analizar vulnerabilidades y generar comandos específicos
    local has_next_vuln=false
    local has_axios_vuln=false
    local has_lodash_vuln=false
    local has_other_vulns=false
    
    # Detectar qué paquetes tienen vulnerabilidades
    if echo "$audit_output" | grep -q "Package.*next"; then
        has_next_vuln=true
    fi
    
    if echo "$audit_output" | grep -q "Package.*axios"; then
        has_axios_vuln=true
    fi
    
    if echo "$audit_output" | grep -q "Package.*lodash"; then
        has_lodash_vuln=true
    fi
    
    if echo "$audit_output" | grep -q "Package.*d3-color\|node-fetch\|qs"; then
        has_other_vulns=true
    fi
    
    # Generar comandos específicos
    echo "# 1. Backup del package.json" >> "$COMMANDS_FILE"
    echo "cp package.json package.json.backup-\$(date +%Y%m%d)" >> "$COMMANDS_FILE"
    echo "" >> "$COMMANDS_FILE"
    
    echo "# 2. Actualizar paquetes vulnerables específicamente" >> "$COMMANDS_FILE"
    
    if [ "$has_next_vuln" = true ]; then
        echo "echo '→ Actualizando Next.js a versión segura...'" >> "$COMMANDS_FILE"
        echo "pnpm add next@16.1.6" >> "$COMMANDS_FILE"
    fi
    
    if [ "$has_axios_vuln" = true ]; then
        echo "echo '→ Actualizando Axios...'" >> "$COMMANDS_FILE"
        echo "pnpm update axios@latest" >> "$COMMANDS_FILE"
    fi
    
    if [ "$has_lodash_vuln" = true ]; then
        echo "echo '→ Actualizando Lodash...'" >> "$COMMANDS_FILE"
        echo "pnpm update lodash@latest" >> "$COMMANDS_FILE"
    fi
    
    if [ "$has_other_vulns" = true ]; then
        echo "" >> "$COMMANDS_FILE"
        echo "# 3. Agregar overrides para dependencias transitivas" >> "$COMMANDS_FILE"
        echo "# Editar package.json y agregar:" >> "$COMMANDS_FILE"
        echo "# \"pnpm\": {" >> "$COMMANDS_FILE"
        echo "#   \"overrides\": {" >> "$COMMANDS_FILE"
        echo "#     \"d3-color\": \">=3.1.0\"," >> "$COMMANDS_FILE"
        echo "#     \"node-fetch\": \">=2.6.7\"," >> "$COMMANDS_FILE"
        echo "#     \"qs\": \">=6.14.1\"," >> "$COMMANDS_FILE"
        echo "#     \"lodash-es\": \">=4.17.23\"" >> "$COMMANDS_FILE"
        echo "#   }" >> "$COMMANDS_FILE"
        echo "# }" >> "$COMMANDS_FILE"
        echo "" >> "$COMMANDS_FILE"
        echo "# Luego ejecutar:" >> "$COMMANDS_FILE"
        echo "# pnpm install" >> "$COMMANDS_FILE"
    fi
    
    echo "" >> "$COMMANDS_FILE"
    echo "# 4. Verificar que se resolvieron las vulnerabilidades" >> "$COMMANDS_FILE"
    echo "pnpm audit --prod" >> "$COMMANDS_FILE"
    echo "" >> "$COMMANDS_FILE"
    
    echo "# 5. Rebuild del proyecto" >> "$COMMANDS_FILE"
    echo "pnpm build" >> "$COMMANDS_FILE"
    echo "" >> "$COMMANDS_FILE"
    
    echo "# 6. Si el build es exitoso, reiniciar PM2" >> "$COMMANDS_FILE"
    echo "if [ \$? -eq 0 ]; then" >> "$COMMANDS_FILE"
    echo "  pm2 restart $project" >> "$COMMANDS_FILE"
    echo "  echo '✅ $project actualizado y reiniciado'" >> "$COMMANDS_FILE"
    echo "else" >> "$COMMANDS_FILE"
    echo "  echo '❌ Build falló. Restaurar backup:'" >> "$COMMANDS_FILE"
    echo "  echo '  cp package.json.backup-\$(date +%Y%m%d) package.json'" >> "$COMMANDS_FILE"
    echo "  echo '  pnpm install'" >> "$COMMANDS_FILE"
    echo "fi" >> "$COMMANDS_FILE"
    echo "" >> "$COMMANDS_FILE"
}

# Iniciar reporte
echo "================================================" > "$REPORT_FILE"
echo "REPORTE DE VULNERABILIDADES - $(date +'%d/%m/%Y %H:%M')" >> "$REPORT_FILE"
echo "================================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Iniciar archivo de comandos
echo "#!/bin/bash" > "$COMMANDS_FILE"
echo "# Comandos de resolución generados automáticamente" >> "$COMMANDS_FILE"
echo "# Fecha: $(date +'%d/%m/%Y %H:%M')" >> "$COMMANDS_FILE"
echo "" >> "$COMMANDS_FILE"
echo "set -e" >> "$COMMANDS_FILE"

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
        AUDIT_OUTPUT=$(pnpm audit --prod 2>&1 || true)
        
        if echo "$AUDIT_OUTPUT" | grep -q "No known vulnerabilities found"; then
            success "$PROJECT: Sin vulnerabilidades ✅"
            echo "  ✅ Sin vulnerabilidades conocidas" >> "$REPORT_FILE"
        else
            # Parsear JSON para contar vulnerabilidades
            CRITICAL=$(echo "$AUDIT_OUTPUT" | grep -o "│ critical" | wc -l || echo 0)
            HIGH=$(echo "$AUDIT_OUTPUT" | grep -o "│ high" | wc -l || echo 0)
            MODERATE=$(echo "$AUDIT_OUTPUT" | grep -o "│ moderate" | wc -l || echo 0)
            LOW=$(echo "$AUDIT_OUTPUT" | grep -o "│ low" | wc -l || echo 0)
            
            TOTAL_CRITICAL=$((TOTAL_CRITICAL + CRITICAL))
            TOTAL_HIGH=$((TOTAL_HIGH + HIGH))
            TOTAL_MODERATE=$((TOTAL_MODERATE + MODERATE))
            TOTAL_LOW=$((TOTAL_LOW + LOW))
            
            if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
                error "$PROJECT: Vulnerabilidades CRÍTICAS encontradas!"
                PROJECTS_WITH_ISSUES=$((PROJECTS_WITH_ISSUES + 1))
                
                # Generar comandos de resolución
                generate_fix_commands "$PROJECT" "$AUDIT_OUTPUT"
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

# Agregar instrucciones al archivo de comandos
echo "" >> "$COMMANDS_FILE"
echo "# ========================================" >> "$COMMANDS_FILE"
echo "# FIN DE COMANDOS DE RESOLUCIÓN" >> "$COMMANDS_FILE"
echo "# ========================================" >> "$COMMANDS_FILE"
echo "" >> "$COMMANDS_FILE"
echo "echo ''" >> "$COMMANDS_FILE"
echo "echo '✅ Todas las actualizaciones completadas'" >> "$COMMANDS_FILE"
echo "echo ''" >> "$COMMANDS_FILE"
echo "echo 'Ejecutar verificación final:'" >> "$COMMANDS_FILE"
echo "echo '  cd /var/www/goya && bash scripts/check-vulnerabilities.sh'" >> "$COMMANDS_FILE"

# Hacer ejecutable el archivo de comandos
chmod +x "$COMMANDS_FILE"

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

# Recomendaciones específicas
if [ $TOTAL_CRITICAL -gt 0 ] || [ $TOTAL_HIGH -gt 0 ]; then
    echo "⚠️  ACCIÓN REQUERIDA:" >> "$REPORT_FILE"
    echo "Se encontraron vulnerabilidades críticas o high." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "📋 COMANDOS ESPECÍFICOS DE RESOLUCIÓN:" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "Se ha generado un script con comandos específicos:" >> "$REPORT_FILE"
    echo "  $COMMANDS_FILE" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "Para ejecutar todas las correcciones automáticamente:" >> "$REPORT_FILE"
    echo "  bash $COMMANDS_FILE" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "O ejecutar proyecto por proyecto (recomendado):" >> "$REPORT_FILE"
    
    # Agregar comandos específicos al reporte
    if [ -f "$COMMANDS_FILE" ]; then
        echo "" >> "$REPORT_FILE"
        echo "--- COMANDOS GENERADOS ---" >> "$REPORT_FILE"
        cat "$COMMANDS_FILE" >> "$REPORT_FILE"
    fi
else
    echo "✅ No se requiere acción inmediata." >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "Reporte generado: $(date +'%d/%m/%Y %H:%M:%S')" >> "$REPORT_FILE"

# Mostrar reporte en consola
cat "$REPORT_FILE"

# Generar HTML para email (similar al anterior pero agregando comandos)
cat > "$HTML_REPORT" << EOF
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .critical { color: #e74c3c; font-weight: bold; }
        .high { color: #e67e22; font-weight: bold; }
        .moderate { color: #f39c12; }
        .success { color: #27ae60; font-weight: bold; }
        .summary { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .project { background: #f8f9fa; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; }
        .commands { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: 'Courier New', monospace; white-space: pre-wrap; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #3498db; color: white; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #ecf0f1; font-size: 0.9em; color: #7f8c8d; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 0.85em; font-weight: bold; }
        .badge-critical { background: #e74c3c; color: white; }
        .badge-high { background: #e67e22; color: white; }
        .badge-moderate { background: #f39c12; color: white; }
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

# Agregar sección de comandos si hay vulnerabilidades
if [ $TOTAL_CRITICAL -gt 0 ] || [ $TOTAL_HIGH -gt 0 ]; then
    cat >> "$HTML_REPORT" << EOF
    <div class="project">
        <h2>🔧 Comandos de Resolución Específicos</h2>
        <p>Se ha generado un script con comandos específicos para resolver las vulnerabilidades.</p>
        <p><strong>Archivo generado:</strong> <code>$COMMANDS_FILE</code></p>
        
        <h3>Ejecución Automática (Todos los proyectos):</h3>
        <div class="commands">bash $COMMANDS_FILE</div>
        
        <h3>O proyecto por proyecto (Recomendado):</h3>
        <p>Ver el archivo adjunto con los comandos detallados.</p>
    </div>
EOF
fi

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
        <p>Para más detalles, consultar los archivos adjuntos:</p>
        <ul>
            <li><strong>vulnerability-report-$(date +%Y%m%d).txt</strong> - Reporte detallado</li>
            <li><strong>fix-commands-$(date +%Y%m%d).sh</strong> - Script de resolución</li>
        </ul>
    </div>
</body>
</html>
EOF

# Enviar email con ambos archivos adjuntos
if [ -n "$SMTP_PASS" ]; then
    log "Enviando reporte por email..."
    
    SUBJECT="[Riogas] Reporte de Vulnerabilidades - $(date +'%d/%m/%Y')"
    
    if [ $TOTAL_CRITICAL -gt 0 ] || [ $TOTAL_HIGH -gt 0 ]; then
        SUBJECT="⚠️ [URGENTE] $SUBJECT"
    fi
    
    # Intentar envío con Python (mejor para múltiples attachments)
    if command -v python3 &> /dev/null; then
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
    
    # Soportar múltiples destinatarios separados por ; o ,
    recipients = "$EMAIL_TO".replace(';', ',')
    msg['To'] = recipients
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
        part.add_header('Content-Disposition', 'attachment; filename="vulnerability-report-$(date +%Y%m%d).txt"')
        msg.attach(part)
    
    # Adjuntar script de comandos
    with open("$COMMANDS_FILE", 'rb') as f:
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment; filename="fix-commands-$(date +%Y%m%d).sh"')
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
            success "Email enviado correctamente con 2 adjuntos"
        else
            error "Falló el envío de email"
        fi
    else
        warning "Python3 no disponible. Instalar para envío de email."
    fi
else
    warning "No se configuró contraseña SMTP"
fi

log "Reporte guardado en: $REPORT_FILE"
log "Comandos de resolución en: $COMMANDS_FILE"
log "Reporte HTML en: $HTML_REPORT"

# Retornar código de salida
if [ $TOTAL_CRITICAL -gt 0 ] || [ $TOTAL_HIGH -gt 0 ]; then
    exit 1
else
    exit 0
fi
