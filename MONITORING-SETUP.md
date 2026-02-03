# 🔍 Sistema de Monitoreo de Vulnerabilidades

Guía completa para configurar monitoreo automático de vulnerabilidades en múltiples proyectos.

---

## 📋 Tabla de Contenidos

1. [Solución 1: GitHub Dependabot (Recomendada)](#solución-1-github-dependabot)
2. [Solución 2: Script Automático en Servidor](#solución-2-script-automático-en-servidor)
3. [Solución 3: Monorepo con pnpm](#solución-3-monorepo-con-pnpm)
4. [Comparación de Soluciones](#comparación-de-soluciones)

---

## Solución 1: GitHub Dependabot

### ✅ Ventajas

- **Gratis** en GitHub (público y privado)
- Crea PRs automáticos con actualizaciones
- Detecta vulnerabilidades de seguridad
- Agrupa actualizaciones menores
- Integrado con GitHub Security Advisories

### 📦 Configuración

#### Paso 1: Habilitar Dependabot

Ya está configurado en `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
```

#### Paso 2: Habilitar en GitHub

1. Ve a tu repositorio en GitHub
2. **Settings** → **Code security and analysis**
3. Habilita:
   - ✅ **Dependabot alerts**
   - ✅ **Dependabot security updates**
   - ✅ **Dependabot version updates**

#### Paso 3: Configurar Notificaciones por Email

1. **Settings** → **Notifications**
2. En "Watching":
   - ✅ **Security alerts**
   - ✅ **Pull requests**

O editar `.github/dependabot.yml`:

```yaml
updates:
  - package-ecosystem: "npm"
    # ... otras configuraciones
    
    # Asignar a ti para revisión
    reviewers:
      - "jgomez"  # Tu usuario de GitHub
    
    # Asignarte automáticamente
    assignees:
      - "jgomez"
```

#### Paso 4: Recibir Solo Alertas de Seguridad

Si solo quieres notificaciones de seguridad (no todas las actualizaciones):

```yaml
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 0  # No crear PRs automáticos
```

Dependabot seguirá alertando sobre vulnerabilidades, pero no creará PRs para actualizaciones normales.

---

## Solución 2: Script Automático en Servidor

### ✅ Ventajas

- Control total sobre la verificación
- Funciona para proyectos privados sin GitHub
- Reporte personalizado con múltiples proyectos
- Email HTML con resumen

### 📦 Configuración

#### Paso 1: Copiar Scripts al Servidor

```bash
cd /var/www/goya

# Crear directorio de scripts
mkdir -p scripts

# Copiar scripts (desde tu máquina local)
scp check-vulnerabilities.sh riogas@servidor:/var/www/goya/scripts/
scp install-monitoring.sh riogas@servidor:/var/www/goya/scripts/
```

#### Paso 2: Instalar en el Servidor

```bash
ssh riogas@servidor
cd /var/www/goya

# Dar permisos
chmod +x scripts/*.sh

# Ejecutar instalador interactivo
./scripts/install-monitoring.sh
```

El instalador te pedirá:
- Email para recibir reportes
- Configuración SMTP
- Horario de ejecución (lunes 9am por defecto)

#### Paso 3: Configurar SMTP (Gmail ejemplo)

**Opción A: Gmail con App Password**

1. Ve a https://myaccount.google.com/apppasswords
2. Crea una contraseña de aplicación
3. Usa esa contraseña en el script

**Configuración en el script:**
```bash
SMTP_SERVER="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="tu-email@gmail.com"
SMTP_PASS="tu-app-password"
```

**Opción B: Servidor SMTP Propio**

Si Riogas tiene servidor de email:
```bash
SMTP_SERVER="smtp.riogas.com.ar"
SMTP_PORT="587"
SMTP_USER="notificaciones@riogas.com.ar"
SMTP_PASS="password-del-servidor"
```

#### Paso 4: Probar Manualmente

```bash
cd /var/www/goya
./scripts/check-vulnerabilities.sh
```

Deberías recibir un email con el reporte.

#### Paso 5: Verificar Cron Job

```bash
# Ver cron jobs configurados
crontab -l

# Debería mostrar algo como:
# 0 9 * * 1 /var/www/goya/scripts/check-vulnerabilities.sh >> /var/log/vulnerability-check.log 2>&1

# Ver últimos logs
tail -f /var/log/vulnerability-check.log
```

### 📧 Formato del Email

El email incluirá:

**Sujeto:**
- Normal: `[Riogas] Reporte de Vulnerabilidades - 03/02/2026`
- Urgente: `⚠️ [URGENTE] [Riogas] Reporte de Vulnerabilidades - 03/02/2026`

**Contenido HTML:**
- Resumen general con contadores
- Detalles por proyecto
- Lista de vulnerabilidades
- Actualizaciones disponibles
- Comandos para resolver

**Adjunto:**
- Archivo TXT con reporte completo

---

## Solución 3: Monorepo con pnpm

### ✅ Ventajas

- Actualizaciones centralizadas
- Deduplica dependencias automáticamente
- Un solo `pnpm-lock.yaml`
- Menor uso de espacio en disco

### ⚠️ Desventajas

- Requiere reestructurar proyectos
- Todos los proyectos deben ser compatibles con las mismas versiones

### 📦 Configuración

#### Estructura Recomendada

```
/var/www/
├── pnpm-workspace.yaml
├── package.json (root)
├── pnpm-lock.yaml (compartido)
└── apps/
    ├── goya/
    │   ├── package.json
    │   ├── next.config.ts
    │   └── src/
    ├── track/
    │   ├── package.json
    │   ├── next.config.ts
    │   └── src/
    └── secapi/
        ├── package.json
        ├── next.config.ts
        └── src/
```

#### Paso 1: Crear Workspace

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'apps/*'
```

**package.json (root):**
```json
{
  "name": "riogas-monorepo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "update:all": "pnpm update -r",
    "audit:all": "pnpm audit --audit-level moderate",
    "build:all": "pnpm -r build",
    "dev:goya": "pnpm --filter goya dev",
    "dev:track": "pnpm --filter track dev",
    "dev:secapi": "pnpm --filter secapi dev"
  },
  "devDependencies": {
    "next": "16.1.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

#### Paso 2: Mover Proyectos

```bash
cd /var/www

# Crear estructura
mkdir -p apps
mv goya apps/
mv track apps/
mv secapi apps/

# Crear workspace
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
EOF

# Reinstalar dependencias
pnpm install
```

#### Paso 3: Actualizar Todos los Proyectos

```bash
# Actualizar todas las dependencias
pnpm update -r

# Auditar todo el monorepo
pnpm audit

# Build todos los proyectos
pnpm -r build

# Restart PM2 apps
pm2 restart all
```

---

## Comparación de Soluciones

| Característica | Dependabot | Script Servidor | Monorepo |
|---|---|---|---|
| **Costo** | Gratis | Gratis | Gratis |
| **Complejidad** | Baja | Media | Alta |
| **Email Automático** | ✅ Sí | ✅ Sí | ⚠️ Requiere script |
| **PRs Automáticos** | ✅ Sí | ❌ No | ⚠️ Con script |
| **Múltiples Proyectos** | ⚠️ Uno por repo | ✅ Sí | ✅ Sí |
| **Actualizaciones Centralizadas** | ❌ No | ❌ No | ✅ Sí |
| **Reportes Personalizados** | ❌ No | ✅ Sí | ⚠️ Con script |
| **Requiere GitHub** | ✅ Sí | ❌ No | ❌ No |
| **Reestructuración** | ❌ No | ❌ No | ✅ Sí |

---

## 🎯 Recomendación Final

### Para tu caso (3 proyectos separados):

**Opción 1: Dependabot + Script Servidor** (RECOMENDADO)

1. **GitHub Dependabot** para cada repositorio:
   - Alertas de seguridad automáticas
   - PRs con actualizaciones
   - Gratis y cero mantenimiento

2. **Script en Servidor** para reporte consolidado:
   - Email semanal con estado de los 3 proyectos
   - Reporte centralizado para gerencia
   - Control total sobre el contenido

### Implementación:

```bash
# En cada proyecto (goya, track, secapi)
cd /var/www/goya
mkdir -p .github
# Copiar dependabot.yml

cd /var/www/track
mkdir -p .github
# Copiar dependabot.yml

cd /var/www/secapi
mkdir -p .github
# Copiar dependabot.yml

# En un proyecto (ejecutar script para todos)
cd /var/www/goya
./scripts/install-monitoring.sh
```

---

## 📝 Ejemplo de Flujo de Trabajo

### Lunes 09:00 AM

**GitHub Dependabot:**
- Escanea los 3 repositorios
- Crea PRs si encuentra actualizaciones
- Te envía notificación por email

**Script de Servidor:**
- Ejecuta `check-vulnerabilities.sh`
- Genera reporte de los 3 proyectos
- Envía email con resumen HTML

### Tu Acción

1. **Revisar email del script**
   - Ver resumen general
   - Identificar proyectos con issues

2. **Revisar PRs de Dependabot**
   - Revisar cambios propuestos
   - Hacer merge si es seguro
   - O actualizar manualmente

3. **Actualizar en servidor si es necesario**
   ```bash
   cd /var/www/<proyecto>
   git pull
   pnpm install
   pnpm build
   pm2 restart <proyecto>
   ```

---

## 🔧 Comandos Útiles

### Ver Cron Jobs
```bash
crontab -l
```

### Editar Cron Jobs
```bash
crontab -e
```

### Ver Log del Script
```bash
tail -f /var/log/vulnerability-check.log
```

### Ejecutar Manualmente
```bash
cd /var/www/goya
./scripts/check-vulnerabilities.sh
```

### Desinstalar
```bash
crontab -l | grep -v 'check-vulnerabilities.sh' | crontab -
```

### Probar Email
```bash
echo "Test" | mailx -s "Test Subject" tu-email@example.com
```

---

## ❓ FAQ

### ¿Debo usar monorepo?

**NO**, si:
- Los proyectos son independientes
- Tienen diferentes equipos/clientes
- Pueden requerir versiones diferentes de Next.js

**SÍ**, si:
- Compartes mucho código entre proyectos
- Siempre actualizas todos juntos
- Quieres gestión centralizada

### ¿Dependabot o Script?

**Ambos:**
- Dependabot: Para detectar y sugerir actualizaciones
- Script: Para monitoreo y reportes personalizados

### ¿Cada cuánto actualizar?

- **Seguridad crítica**: Inmediatamente
- **Seguridad high**: Dentro de 1 semana
- **Seguridad moderate**: Dentro de 1 mes
- **Actualizaciones normales**: Mensualmente

### ¿Qué pasa si no configuro email?

El script seguirá ejecutándose y guardando reportes en:
```
/tmp/vulnerability-report-YYYYMMDD.txt
/var/log/vulnerability-check.log
```

---

## 📞 Soporte

Si tienes problemas:

1. **Verificar logs:**
   ```bash
   tail -f /var/log/vulnerability-check.log
   ```

2. **Verificar cron:**
   ```bash
   systemctl status cron  # Ubuntu/Debian
   systemctl status crond # CentOS/RHEL
   ```

3. **Probar manualmente:**
   ```bash
   bash -x ./scripts/check-vulnerabilities.sh
   ```

4. **Verificar permisos:**
   ```bash
   ls -la scripts/
   # Debe mostrar: -rwxr-xr-x
   ```

---

**Última actualización**: 3 de Febrero, 2026
