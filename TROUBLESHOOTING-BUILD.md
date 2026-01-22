# 🔧 Solución de Problemas de Build en Servidor

## 🚨 Problema Detectado

Al ejecutar `pnpm build` aparecen errores de módulos no encontrados:
- `Can't resolve '@/components/clientes/ClienteForm'`
- `Can't resolve '@/components/dashboard/clientes/Clientes'`
- `Can't resolve '@/components/ui/card'`
- `Can't resolve '@/components/configuracion/Calles'`

---

## ✅ Solución Rápida (Recomendado)

### Ejecuta el script automático:

```bash
cd /var/www/goya

# Hacer pull de los nuevos scripts
git pull origin dev

# Dar permisos de ejecución
chmod +x fix-build.sh check-files.sh

# Ejecutar script de solución
./fix-build.sh
```

Este script hará:
1. ✓ Verificar rama actual
2. ✓ Limpiar archivos en conflicto
3. ✓ Resetear a origin/dev
4. ✓ Verificar archivos críticos
5. ✓ Limpiar node_modules y .next
6. ✓ Reinstalar dependencias
7. ✓ Compilar la aplicación

---

## 🔍 Diagnóstico Manual (Si prefieres revisar primero)

### 1. Verificar archivos faltantes:

```bash
cd /var/www/goya
chmod +x check-files.sh
./check-files.sh
```

### 2. Ver qué archivos tiene Git trackeados:

```bash
git ls-files src/components/ | head -20
```

### 3. Verificar rama actual:

```bash
git branch --show-current
# Debe mostrar: dev
```

---

## 🛠️ Solución Manual Paso a Paso

Si el script automático no funciona, sigue estos pasos:

### Paso 1: Verificar y cambiar a rama dev

```bash
cd /var/www/goya
git branch --show-current

# Si no estás en dev:
git checkout dev
```

### Paso 2: Limpiar y resetear el repositorio

```bash
# Guardar trabajo actual (si hay cambios importantes)
git stash

# Limpiar archivos no trackeados
git clean -fd

# Resetear a HEAD
git reset --hard HEAD

# Actualizar desde origin
git fetch origin dev
git reset --hard origin/dev
```

### Paso 3: Verificar que los archivos existan

```bash
# Verificar archivos críticos
ls -la src/components/clientes/ClienteForm.tsx
ls -la src/components/dashboard/clientes/Clientes.tsx
ls -la src/components/ui/card.tsx
ls -la src/components/configuracion/Calles.tsx
ls -la pm2.config.js

# Ver estructura completa
find src/components -type f -name "*.tsx" | head -20
```

### Paso 4: Si faltan archivos, clonar de nuevo

```bash
cd /var/www/

# Hacer backup del directorio actual
mv goya goya_backup_$(date +%Y%m%d_%H%M%S)

# Clonar de nuevo
git clone -b dev git@github.com:Riogas/riogasgestion.git goya
cd goya
```

### Paso 5: Limpiar dependencias y cache

```bash
# Eliminar directorios
rm -rf node_modules
rm -rf .next
rm -rf .pnpm-store

# Limpiar cache de pnpm
pnpm store prune
```

### Paso 6: Reinstalar dependencias

```bash
# Instalar con lockfile
pnpm install --frozen-lockfile

# O si falla, sin lockfile
pnpm install
```

### Paso 7: Compilar

```bash
pnpm build
```

---

## 🚀 Iniciar la Aplicación

Una vez que el build sea exitoso:

### Con PM2 (Recomendado):

```bash
# Si es primera vez
pm2 start pm2.config.js

# Si ya existe
pm2 restart goya

# Ver logs
pm2 logs goya

# Ver estado
pm2 status
```

### Con pnpm:

```bash
pnpm start
```

---

## 🔍 Verificaciones Post-Build

### 1. Verificar que la aplicación inicie:

```bash
pm2 logs goya --lines 50
```

### 2. Probar el health endpoint:

```bash
curl http://localhost:3003/api/health
```

Debe responder:
```json
{"status":"ok","timestamp":"...","uptime":123}
```

### 3. Ver en el navegador:

```
http://tu-servidor-ip:3003
```

---

## 🆘 Si Persiste el Problema

### Verificar permisos:

```bash
ls -la /var/www/goya/src/components/
chown -R riogas:riogas /var/www/goya
chmod -R 755 /var/www/goya
```

### Verificar versión de Node:

```bash
node --version
# Debe ser >= 18.17.0

# Si no:
nvm install 20
nvm use 20
```

### Verificar versión de pnpm:

```bash
pnpm --version
# Debe ser >= 8.0.0

# Si no:
npm install -g pnpm@latest
```

### Ver logs completos del error:

```bash
pnpm build 2>&1 | tee build-error.log
```

---

## 📝 Comandos Útiles de Diagnóstico

```bash
# Ver último commit
git log -1 --oneline

# Ver archivos modificados
git status

# Ver diferencias con origin
git fetch origin dev
git diff origin/dev

# Listar todos los archivos de Git en src/components
git ls-tree -r dev --name-only | grep "src/components"

# Ver tamaño del repositorio
du -sh .git

# Verificar integridad del repositorio
git fsck
```

---

## ✅ Checklist de Verificación

Antes de intentar el build, asegúrate de:

- [ ] Estar en la rama `dev`
- [ ] Tener los últimos cambios de origin (`git pull`)
- [ ] No tener archivos modificados localmente (`git status`)
- [ ] Tener los archivos de componentes en `src/components/`
- [ ] Tener `node_modules/` limpio (eliminado y reinstalado)
- [ ] Tener `.next/` eliminado
- [ ] Node.js >= 18.17.0
- [ ] pnpm >= 8.0.0
- [ ] Archivo `.env.production` configurado

---

## 📞 Contacto

Si ninguna solución funciona, contacta al equipo de desarrollo con:

1. Output del comando: `./check-files.sh`
2. Output del comando: `git log -5 --oneline`
3. Output del comando: `pnpm build 2>&1 | head -100`
4. Versión de Node: `node --version`
5. Versión de pnpm: `pnpm --version`

---

**Última actualización:** 2026-01-22
