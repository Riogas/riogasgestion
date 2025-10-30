#!/bin/bash

# ============================================
# HELPER SCRIPT - COMANDOS ÚTILES
# ============================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

show_help() {
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   RIOGASGESTION - HELPER COMMANDS     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Uso:${NC} ./helper.sh [comando]"
    echo ""
    echo -e "${YELLOW}Comandos disponibles:${NC}"
    echo ""
    echo "  ${GREEN}deploy${NC}         - Deploy completo (rebuild + restart)"
    echo "  ${GREEN}start${NC}          - Iniciar contenedores"
    echo "  ${GREEN}stop${NC}           - Detener contenedores"
    echo "  ${GREEN}restart${NC}        - Reiniciar contenedores"
    echo "  ${GREEN}logs${NC}           - Ver logs en tiempo real"
    echo "  ${GREEN}status${NC}         - Ver estado de contenedores"
    echo "  ${GREEN}shell${NC}          - Entrar al contenedor"
    echo "  ${GREEN}health${NC}         - Verificar healthcheck"
    echo "  ${GREEN}clean${NC}          - Limpiar imágenes antiguas"
    echo "  ${GREEN}rebuild${NC}        - Rebuild sin caché"
    echo "  ${GREEN}backup${NC}         - Backup del código y configs"
    echo "  ${GREEN}restore${NC}        - Restaurar desde backup"
    echo "  ${GREEN}update${NC}         - Pull + Deploy"
    echo ""
}

case "$1" in
    deploy)
        echo -e "${BLUE}Ejecutando deploy...${NC}"
        ./deploy.sh
        ;;
    start)
        echo -e "${BLUE}Iniciando contenedores...${NC}"
        docker-compose up -d
        ;;
    stop)
        echo -e "${BLUE}Deteniendo contenedores...${NC}"
        docker-compose down
        ;;
    restart)
        echo -e "${BLUE}Reiniciando contenedores...${NC}"
        docker-compose restart
        ;;
    logs)
        echo -e "${BLUE}Mostrando logs (Ctrl+C para salir)...${NC}"
        docker-compose logs -f
        ;;
    status)
        echo -e "${BLUE}Estado de contenedores:${NC}"
        docker-compose ps
        echo ""
        echo -e "${BLUE}Uso de recursos:${NC}"
        docker stats --no-stream riogasgestion-app
        ;;
    shell)
        echo -e "${BLUE}Entrando al contenedor...${NC}"
        docker exec -it riogasgestion-app sh
        ;;
    health)
        echo -e "${BLUE}Verificando healthcheck...${NC}"
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' riogasgestion-app 2>/dev/null)
        if [ "$HEALTH" = "healthy" ]; then
            echo -e "${GREEN}✓ Aplicación saludable${NC}"
        else
            echo -e "${YELLOW}⚠ Estado: $HEALTH${NC}"
        fi
        echo ""
        curl -s http://localhost:3000/api/health | jq '.' || echo "No se pudo conectar"
        ;;
    clean)
        echo -e "${BLUE}Limpiando imágenes antiguas...${NC}"
        docker image prune -f
        echo -e "${GREEN}✓ Limpieza completada${NC}"
        ;;
    rebuild)
        echo -e "${BLUE}Rebuild sin caché...${NC}"
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    backup)
        echo -e "${BLUE}Creando backup...${NC}"
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        tar -czf "$BACKUP_FILE" \
            --exclude='node_modules' \
            --exclude='.next' \
            --exclude='logs' \
            .
        echo -e "${GREEN}✓ Backup creado: $BACKUP_FILE${NC}"
        ;;
    restore)
        echo -e "${YELLOW}Restaurar desde backup${NC}"
        ls -lh backup_*.tar.gz 2>/dev/null || echo "No hay backups disponibles"
        ;;
    update)
        echo -e "${BLUE}Actualizando desde Git y deployando...${NC}"
        git pull origin dev
        ./deploy.sh
        ;;
    *)
        show_help
        ;;
esac
