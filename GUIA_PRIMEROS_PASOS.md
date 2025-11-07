# Guía de Primeros Pasos - Sistema de Alquileres

¡Bienvenido! Esta guía te ayudará a dar tus primeros pasos en el sistema.

## ✅ Estado Actual del Sistema

### Funcionalidades Completas (100%)
- ✅ Login y autenticación
- ✅ ABM Inquilinos
- ✅ ABM Propietarios  
- ✅ ABM Unidades
- ✅ Dashboard básico

### Funcionalidades Parciales (Backend listo, Frontend básico)
- ⚠️ Contratos (backend completo, frontend solo listado)
- ⚠️ Liquidaciones (backend completo, frontend solo listado y PDF)
- ⚠️ Cuentas Tributarias (backend completo, frontend faltante)

## 🚀 Flujo de Trabajo Recomendado

### Paso 1: Crear un Propietario

1. Ve a **"Propietarios"** en el menú lateral
2. Click en **"Nuevo Propietario"**
3. Completa los datos:
   - Nombre y Apellido (o Razón Social)
   - **DNI o CUIT** (al menos uno es obligatorio)
   - Email, teléfono, dirección (opcionales)
   - Condición IVA (opcional)
4. Click en **"Crear"**

**Ejemplo:**
```
Nombre: Juan
Apellido: Pérez
DNI: 12345678
Email: juan.perez@email.com
```

### Paso 2: Crear un Inquilino

1. Ve a **"Inquilinos"** en el menú lateral
2. Click en **"Nuevo Inquilino"**
3. Completa los datos similares al propietario
4. Click en **"Crear"**

**Ejemplo:**
```
Nombre: María
Apellido: González
DNI: 87654321
Email: maria.gonzalez@email.com
```

### Paso 3: Crear una Unidad

1. Ve a **"Unidades"** en el menú lateral
2. Click en **"Nueva Unidad"**
3. Completa:
   - **Propietario** (selecciona el que creaste)
   - **Dirección** (obligatorio)
   - **Localidad** (obligatorio)
   - Tipo, Estado, Código Interno (opcionales)
4. Click en **"Crear"**

**Ejemplo:**
```
Propietario: Juan Pérez
Dirección: Av. Libertador 1234
Localidad: CABA
Tipo: Departamento
Estado: Disponible
```

### Paso 4: Crear Cuentas Tributarias (IMPORTANTE)

**⚠️ Nota:** El frontend para esto aún no está completo, pero puedes hacerlo desde Prisma Studio o esperar a que se complete.

**Opción A: Usar Prisma Studio (recomendado por ahora)**
```bash
cd backend
npm run prisma:studio
```
Esto abre un navegador donde puedes crear cuentas tributarias visualmente.

**Opción B: Usar API directamente (para desarrolladores)**
Puedes usar Postman o curl para crear cuentas tributarias.

**¿Qué es una Cuenta Tributaria?**
Es la asociación de códigos de impuestos/servicios (TGI, API, Agua, Gas, Luz, etc.) a una unidad.

### Paso 5: Crear un Contrato

**⚠️ Estado Actual:** El backend está completo, pero el frontend solo muestra un listado básico. El formulario completo está pendiente.

**Por ahora, puedes:**
- Ver contratos existentes (si hay)
- O esperar a que se complete el módulo completo

**Lo que necesitarás cuando esté completo:**
- Unidad
- Inquilino
- Fechas de inicio/fin
- Monto inicial
- Responsabilidades (quién paga cada concepto)
- Garantías (opcional)
- Gastos iniciales (opcional)

### Paso 6: Generar Liquidaciones

**⚠️ Estado Actual:** El backend está completo, pero el frontend solo muestra listado y descarga de PDF.

**Cuando esté completo el frontend, podrás:**
- Generar liquidaciones automáticamente desde contratos
- Editar items de liquidación
- Cambiar estado (borrador → emitida)
- Descargar PDF (esto ya funciona)

## 📋 Tareas Recomendadas Ahora

### Inmediato (5 minutos)
1. ✅ Crear al menos 1 propietario de prueba
2. ✅ Crear al menos 1 inquilino de prueba
3. ✅ Crear al menos 1 unidad de prueba

### Corto Plazo (10-15 minutos)
4. Crear cuentas tributarias para las unidades (usando Prisma Studio)
5. Explorar el Dashboard
6. Revisar los listados y filtros

### Próximos Pasos de Desarrollo
7. Completar módulo de Contratos (frontend)
8. Completar módulo de Liquidaciones (frontend)
9. Agregar módulo de Cuentas Tributarias (frontend)

## 🛠️ Herramientas Útiles

### Prisma Studio (Base de Datos Visual)
```bash
cd backend
npm run prisma:studio
```
Abre en: http://localhost:5555

Útil para:
- Ver todos los datos
- Crear/editar registros directamente
- Explorar relaciones entre tablas

### Health Check del Backend
Abre en el navegador: http://localhost:4000/api/health

Deberías ver: `{"status":"ok","message":"Sistema de Alquileres API"}`

## 💡 Tips

1. **Validaciones:** El sistema valida que no haya duplicados (DNI/CUIT, unidad única por propietario+dirección)

2. **Baja Lógica:** Cuando eliminas algo, no se borra realmente, solo se marca como eliminado (soft delete)

3. **Búsqueda:** Puedes buscar en los listados escribiendo en la barra de búsqueda

4. **Relaciones:** 
   - Unidad necesita un Propietario
   - Contrato necesita Unidad + Inquilino
   - Liquidación necesita Contrato

## 🐛 Si algo no funciona

1. **Verifica que ambos servidores estén corriendo:**
   - Backend: http://localhost:4000/api/health
   - Frontend: http://localhost:5173

2. **Revisa la consola del navegador** (F12) para errores

3. **Revisa la terminal del backend** para errores de servidor

## 📞 Próximos Desarrollos

Según el TODO.md, las siguientes tareas prioritarias son:
1. Completar frontend de Contratos
2. Completar frontend de Liquidaciones  
3. Agregar frontend de Cuentas Tributarias

¿Quieres que te ayude a completar alguno de estos módulos ahora?

