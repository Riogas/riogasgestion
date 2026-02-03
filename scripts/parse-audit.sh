#!/bin/bash

##############################################
# Parser de pnpm audit JSON
# Extrae vulnerabilidades y genera comandos específicos
##############################################

PROJECT_PATH="$1"
OUTPUT_FILE="$2"

if [ -z "$PROJECT_PATH" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Uso: $0 <project_path> <output_file>"
    exit 1
fi

cd "$PROJECT_PATH" || exit 1

# Ejecutar pnpm audit en formato JSON
AUDIT_JSON=$(pnpm audit --prod --json 2>&1 || true)

# Arrays para almacenar paquetes por tipo
DIRECT_DEPS=()
TRANSITIVE_DEPS=()

# Analizar vulnerabilidades críticas y high
if echo "$AUDIT_JSON" | grep -q "vulnerabilities"; then
    
    # Parsear con jq si está disponible
    if command -v jq &> /dev/null; then
        # Extraer nombres de paquetes vulnerables
        VULNS=$(echo "$AUDIT_JSON" | jq -r '
            .vulnerabilities | 
            to_entries[] | 
            select(.value.severity == "critical" or .value.severity == "high") |
            .key
        ' 2>/dev/null || true)
        
        while IFS= read -r package; do
            if [ -n "$package" ]; then
                # Determinar si es dependencia directa o transitiva
                if grep -q "\"$package\"" "$PROJECT_PATH/package.json"; then
                    DIRECT_DEPS+=("$package")
                else
                    TRANSITIVE_DEPS+=("$package")
                fi
            fi
        done <<< "$VULNS"
    else
        # Fallback: parsear texto plano
        VULNS=$(echo "$AUDIT_JSON" | grep -A 2 "│ high\|│ critical" | grep "Package" | awk '{print $2}' || true)
        
        while IFS= read -r package; do
            if [ -n "$package" ]; then
                if grep -q "\"$package\"" "$PROJECT_PATH/package.json"; then
                    DIRECT_DEPS+=("$package")
                else
                    TRANSITIVE_DEPS+=("$package")
                fi
            fi
        done <<< "$VULNS"
    fi
fi

# Generar comandos al archivo de salida
echo "# Comandos generados para $(basename $PROJECT_PATH)" > "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ ${#DIRECT_DEPS[@]} -gt 0 ]; then
    echo "# Actualizar dependencias directas:" >> "$OUTPUT_FILE"
    
    for pkg in "${DIRECT_DEPS[@]}"; do
        case "$pkg" in
            "next")
                echo "pnpm add next@16.1.6" >> "$OUTPUT_FILE"
                ;;
            "axios")
                echo "pnpm add axios@latest" >> "$OUTPUT_FILE"
                ;;
            "lodash"|"lodash-es")
                echo "pnpm add lodash@latest" >> "$OUTPUT_FILE"
                ;;
            *)
                echo "pnpm add ${pkg}@latest" >> "$OUTPUT_FILE"
                ;;
        esac
    done
    echo "" >> "$OUTPUT_FILE"
fi

if [ ${#TRANSITIVE_DEPS[@]} -gt 0 ]; then
    echo "# Agregar overrides para dependencias transitivas:" >> "$OUTPUT_FILE"
    echo "# Editar package.json y agregar en la sección 'pnpm':" >> "$OUTPUT_FILE"
    echo "# \"overrides\": {" >> "$OUTPUT_FILE"
    
    for pkg in "${TRANSITIVE_DEPS[@]}"; do
        case "$pkg" in
            "d3-color")
                echo "#   \"d3-color\": \">=3.1.0\"," >> "$OUTPUT_FILE"
                ;;
            "node-fetch")
                echo "#   \"node-fetch\": \">=2.6.7\"," >> "$OUTPUT_FILE"
                ;;
            "qs")
                echo "#   \"qs\": \">=6.14.1\"," >> "$OUTPUT_FILE"
                ;;
            "lodash-es")
                echo "#   \"lodash-es\": \">=4.17.23\"," >> "$OUTPUT_FILE"
                ;;
            *)
                echo "#   \"${pkg}\": \"latest\"," >> "$OUTPUT_FILE"
                ;;
        esac
    done
    
    echo "# }" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "# Luego ejecutar: pnpm install" >> "$OUTPUT_FILE"
fi

echo "Análisis completado para $(basename $PROJECT_PATH)"
