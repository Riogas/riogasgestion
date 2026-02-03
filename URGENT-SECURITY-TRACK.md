# 🚨 Alerta de Seguridad - Track

## Vulnerabilidades Críticas Detectadas

**Fecha**: 3 de Febrero, 2026  
**Proyecto**: track  
**Severidad**: 🔴 CRÍTICA + 🔴 HIGH

---

## 📊 Estado Actual

### Track (CRÍTICO)
- **Next.js**: 15.5.5 (VULNERABLE)
- **Requerido**: 15.5.10+ o 16.1.6
- **Vulnerabilidades**:
  - 1 Crítica
  - 2 High
  - 3 Moderate

### Goya (OK)
- **Next.js**: 16.1.6 ✅
- **Vulnerabilidades**: 0
- **Actualizaciones menores**: 45 paquetes (opcional)

---

## 🔥 Acción Inmediata Requerida

### Opción 1: Script Automático (RECOMENDADO)

```bash
cd /var/www/track
bash /var/www/goya/scripts/fix-track-urgent.sh
```

Este script:
- ✅ Crea backup automático
- ✅ Actualiza Next.js a versión segura
- ✅ Verifica vulnerabilidades
- ✅ Rebuild y restart PM2
- ✅ Rollback automático si falla

### Opción 2: Manual

```bash
cd /var/www/track

# 1. Backup
cp package.json package.json.backup
cp pnpm-lock.yaml pnpm-lock.yaml.backup

# 2. Actualizar Next.js
pnpm update next@latest

# 3. Verificar
pnpm audit --prod

# 4. Rebuild
pnpm build

# 5. Restart
pm2 restart track

# 6. Verificar logs
pm2 logs track --lines 50
```

---

## 📋 Detalles de Vulnerabilidades

### Next.js 15.5.5

#### Vulnerabilidad 1 (CRÍTICA)
- **CVE**: Pendiente
- **Versión vulnerable**: 15.5.0 - 15.5.6
- **Versión segura**: ≥15.5.7 o 16.1.6
- **Impacto**: Remote Code Execution (RCE)

#### Vulnerabilidad 2 (HIGH)
- **Versión vulnerable**: 15.5.1 - 15.5.7
- **Versión segura**: ≥15.5.8 o 16.1.6
- **Impacto**: Denial of Service (DoS)

#### Vulnerabilidad 3 (HIGH)
- **Versión vulnerable**: 15.5.1 - 15.5.9
- **Versión segura**: ≥15.5.10 o 16.1.6
- **Impacto**: Information Disclosure

#### Vulnerabilidades 4-6 (MODERATE)
- **Versión vulnerable**: 15.0.0 - 15.5.x
- **Versión segura**: ≥15.5.10 o 16.1.6
- **Impacto**: Cache poisoning, SSRF, Content injection

---

## 🔄 Plan de Actualización

### Track → Next.js 16.1.6

**Recomendación**: Actualizar a 16.1.6 (misma versión que goya)

**Ventajas**:
- ✅ Resuelve todas las 6 vulnerabilidades
- ✅ Misma versión que goya (consistencia)
- ✅ Versión estable y probada

**Compatibilidad con React 19**:
- Track usa React 19.1.0 ✅
- Next.js 16 soporta React 19 ✅
- No hay conflictos

**Otras actualizaciones en track**:
```
- axios: 1.13.2 → 1.13.4
- @supabase/supabase-js: 2.84.0 → 2.94.0
- react: 19.1.0 → 19.2.4
- react-dom: 19.1.0 → 19.2.4
- framer-motion: 12.23.24 → 12.31.0
```

---

## 🎯 Goya - Actualizaciones Opcionales

Goya tiene 45 actualizaciones menores disponibles (NO urgentes):

### Prioridad Media:
```bash
cd /var/www/goya

# Actualizar paquetes de seguridad (recomendado)
pnpm update axios@latest lodash@latest next@latest

# O actualizar todo
pnpm update
```

### Paquetes deprecated en goya:
- `nivo@0.31.0` → Migrar a `@nivo/core`
- `react-beautiful-dnd@13.1.1` → Migrar a `@dnd-kit` (ya instalado)
- `string-similarity@4.0.4` → Buscar alternativa

---

## 📞 Checklist Post-Actualización

### Track (Urgente)
- [ ] Backup creado
- [ ] Next.js actualizado a 16.1.6
- [ ] `pnpm audit --prod` = 0 vulnerabilidades
- [ ] `pnpm build` exitoso
- [ ] PM2 restart exitoso
- [ ] App funciona correctamente
- [ ] No hay errores en logs

### Goya (Opcional)
- [ ] Revisar paquetes deprecated
- [ ] Actualizar dependencias menores
- [ ] Testing de funcionalidad

---

## 🔍 Verificación

### Track
```bash
cd /var/www/track

# Ver versión instalada
grep '"next"' package.json

# Verificar vulnerabilidades
pnpm audit --prod

# Ver logs
pm2 logs track --lines 50

# Status
pm2 status track
```

### Ambos Proyectos
```bash
# Ejecutar verificación automática
cd /var/www/goya
bash scripts/check-vulnerabilities.sh
```

---

## 🛟 Rollback (Si algo sale mal)

### Track
```bash
cd /var/www/track

# Restaurar backup
cp package.json.backup package.json
cp pnpm-lock.yaml.backup pnpm-lock.yaml

# Reinstalar
pnpm install

# Rebuild
pnpm build

# Restart
pm2 restart track
```

---

## 📧 Reporte de Email

El script intentó enviar email pero falló porque:
- `mailx` instalado es la versión BSD (sin soporte SMTP)
- Necesita `sendmail` o `mailutils` (Heirloom mailx)

### Instalar sendmail:
```bash
sudo apt-get update
sudo apt-get install sendmail
```

### O usar mailutils:
```bash
sudo apt-get install mailutils
```

Después de instalar, el script enviará emails automáticamente.

---

## 📅 Próxima Verificación

El cron job ejecutará el próximo lunes a las 9:00 AM.

Para ejecutar manualmente:
```bash
cd /var/www/goya
bash scripts/check-vulnerabilities.sh
```

---

**⚠️ IMPORTANTE**: Las vulnerabilidades en track son CRÍTICAS. Actualizar lo antes posible.

**Prioridad**:
1. 🔴 **Track** - URGENTE (1 crítica, 2 high)
2. 🟢 **Goya** - OK (solo actualizaciones menores opcionales)
3. ⚪ **secapi** - Pendiente de verificar en `/var/www/secapi`

---

**Generado**: 3 de Febrero, 2026 16:29
