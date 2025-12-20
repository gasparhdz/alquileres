# Plan de Refactor - Cambios de Requisitos

## 📋 Cambios Identificados

### 1. ✅ Nuevos campos en Inquilinos y Propietarios
**Impacto:** Bajo - Solo requiere migración de base de datos
**Complejidad:** Baja

### 2. 🔄 Múltiples propietarios por unidad
**Impacto:** Medio-Alto - Cambio estructural en relación de datos
**Complejidad:** Media
- Cambiar de relación 1:1 a Many-to-Many
- Crear tabla intermedia `UnidadPropietario`
- Actualizar controladores y frontend

### 3. 🔄 Cuentas tributarias: credenciales por tipo de impuesto
**Impacto:** Alto - Cambio en modelo de datos
**Complejidad:** Media-Alta
- Crear nueva entidad `CredencialTributaria` (por tipo de impuesto)
- Remover `usuarioEmail`, `usuarioPortal`, `password` de `CuentaTributaria`
- Actualizar lógica de generación de liquidaciones

### 4. ✅ Nuevos campos en Unidad (Propiedad)
**Impacto:** Bajo - Solo requiere migración de base de datos
**Complejidad:** Baja

---

## 🎯 Estrategia de Refactor

### Fase 1: Preparación y Análisis (1-2 días)
1. Documentar todos los cambios requeridos
2. Diseñar nuevo esquema de base de datos
3. Crear plan de migración de datos
4. Identificar puntos de integración afectados

### Fase 2: Cambios Simples Primero (2-3 días)
1. ✅ Agregar nuevos campos a Inquilinos
2. ✅ Agregar nuevos campos a Propietarios
3. ✅ Agregar nuevos campos a Unidad
4. Actualizar controladores y frontend para nuevos campos

### Fase 3: Múltiples Propietarios (3-5 días)
1. Crear tabla `UnidadPropietario` (relación Many-to-Many)
2. Migrar datos existentes (un propietario → múltiples propietarios)
3. Actualizar controladores de Unidad
4. Actualizar frontend para manejar múltiples propietarios
5. Actualizar consultas en otros módulos (Contratos, Liquidaciones)

### Fase 4: Credenciales Tributarias (3-5 días)
1. Crear nueva entidad `CredencialTributaria`
2. Migrar datos existentes si es posible
3. Remover campos de `CuentaTributaria`
4. Actualizar lógica de generación de liquidaciones
5. Actualizar frontend de Cuentas Tributarias

### Fase 5: Testing y Ajustes (2-3 días)
1. Probar todas las funcionalidades
2. Ajustar bugs encontrados
3. Optimizar consultas si es necesario

---

## 📝 Plan de Implementación Detallado

### Cambio 1: Nuevos Campos en Inquilinos y Propietarios

#### Backend
```prisma
model Inquilino {
  // ... campos existentes
  // Agregar nuevos campos aquí
  campoNuevo1 String?
  campoNuevo2 String?
  // ...
}

model Propietario {
  // ... campos existentes
  // Agregar nuevos campos aquí
  campoNuevo1 String?
  campoNuevo2 String?
  // ...
}
```

#### Migración
- Crear migración con nuevos campos
- Actualizar controladores para aceptar nuevos campos
- Actualizar validaciones si es necesario

#### Frontend
- Actualizar formularios de Inquilinos y Propietarios
- Agregar campos nuevos en tablas/listados si es necesario

---

### Cambio 2: Múltiples Propietarios por Unidad

#### Backend - Nuevo Schema
```prisma
model Unidad {
  id            String              @id @default(uuid())
  // ... otros campos
  // REMOVER: propietarioId String?
  // REMOVER: propietario   Propietario?
  
  // AGREGAR: relación Many-to-Many
  propietarios  UnidadPropietario[]
  // ... otras relaciones
}

model Propietario {
  id            String      @id @default(uuid())
  // ... otros campos
  // CAMBIAR: unidades      Unidad[] -> UnidadPropietario[]
  unidades      UnidadPropietario[]
}

// NUEVA TABLA INTERMEDIA
model UnidadPropietario {
  id            String      @id @default(uuid())
  unidadId      String      @map("unidad_id")
  propietarioId String      @map("propietario_id")
  porcentaje    Decimal?    @db.Decimal(5, 2) // Porcentaje de propiedad (opcional)
  esPrincipal   Boolean     @default(false) @map("es_principal") // Propietario principal
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  unidad        Unidad      @relation(fields: [unidadId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  propietario   Propietario @relation(fields: [propietarioId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@unique([unidadId, propietarioId])
  @@map("unidad_propietario")
}
```

#### Migración de Datos
```sql
-- Crear tabla intermedia
CREATE TABLE "unidad_propietario" (...);

-- Migrar datos existentes
INSERT INTO "unidad_propietario" (id, unidad_id, propietario_id, es_principal, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  u.id,
  u.propietario_id,
  true, -- Todos los existentes son principales
  u.created_at,
  u.updated_at
FROM "unidades" u
WHERE u.propietario_id IS NOT NULL;

-- Remover columna propietario_id después de verificar migración
ALTER TABLE "unidades" DROP COLUMN "propietario_id";
```

#### Backend - Controladores
- Actualizar `getAllUnidades` para incluir múltiples propietarios
- Actualizar `createUnidad` para aceptar array de propietarios
- Actualizar `updateUnidad` para manejar cambios en propietarios
- Actualizar consultas en otros módulos que usen `propietario`

#### Frontend
- Actualizar formulario de Unidad para seleccionar múltiples propietarios
- Actualizar listado de Unidades para mostrar múltiples propietarios
- Actualizar vista de detalle de Unidad
- Actualizar filtros si es necesario

---

### Cambio 3: Credenciales Tributarias por Tipo de Impuesto

#### Backend - Nuevo Schema
```prisma
model CuentaTributaria {
  id            String      @id @default(uuid())
  unidadId      String      @map("unidad_id")
  tipoImpuesto  String      @map("tipo_impuesto")
  codigo1       String?     @map("codigo_1")
  codigo2       String?     @map("codigo_2")
  periodicidad  String?
  activo        Boolean     @default(true)
  observaciones String?
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  deletedAt     DateTime?   @map("deleted_at")
  isDeleted     Boolean     @default(false) @map("is_deleted")
  
  // REMOVER: usuarioEmail, usuarioPortal, password
  
  // AGREGAR: relación con credenciales
  credencialTributariaId String? @map("credencial_tributaria_id")
  credencialTributaria   CredencialTributaria? @relation(fields: [credencialTributariaId], references: [id], onDelete: SetNull, onUpdate: Cascade)

  unidad        Unidad      @relation(fields: [unidadId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  items         LiquidacionItem[]

  @@unique([unidadId, tipoImpuesto], name: "unique_cuenta_tributaria")
  @@index([activo])
  @@map("cuentas_tributarias")
}

// NUEVA ENTIDAD
model CredencialTributaria {
  id            String      @id @default(uuid())
  tipoImpuesto  String      @map("tipo_impuesto") // Parametro categoria: tipo_impuesto
  usuarioEmail  String?     @map("usuario_email")
  usuarioPortal String?     @map("usuario_portal")
  password      String?     // Contraseña de la oficina virtual (encriptar en el futuro)
  activo        Boolean     @default(true)
  observaciones String?
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  deletedAt     DateTime?   @map("deleted_at")
  isDeleted     Boolean     @default(false) @map("is_deleted")

  cuentas       CuentaTributaria[]

  @@unique([tipoImpuesto], name: "unique_credencial_tipo_impuesto")
  @@index([activo])
  @@map("credenciales_tributarias")
}
```

#### Migración de Datos
```sql
-- Crear tabla de credenciales
CREATE TABLE "credenciales_tributarias" (...);

-- Migrar datos existentes (agrupar por tipo de impuesto)
-- Nota: Esto requiere lógica para determinar qué credenciales son por tipo
INSERT INTO "credenciales_tributarias" (id, tipo_impuesto, usuario_email, usuario_portal, password, activo, created_at, updated_at)
SELECT DISTINCT ON (tipo_impuesto)
  gen_random_uuid(),
  tipo_impuesto,
  usuario_email,
  usuario_portal,
  password,
  true,
  MIN(created_at),
  MAX(updated_at)
FROM "cuentas_tributarias"
WHERE usuario_email IS NOT NULL OR usuario_portal IS NOT NULL
GROUP BY tipo_impuesto, usuario_email, usuario_portal, password;

-- Actualizar cuentas tributarias para referenciar credenciales
UPDATE "cuentas_tributarias" ct
SET credencial_tributaria_id = (
  SELECT id FROM "credenciales_tributarias" cred
  WHERE cred.tipo_impuesto = ct.tipo_impuesto
  LIMIT 1
)
WHERE ct.usuario_email IS NOT NULL OR ct.usuario_portal IS NOT NULL;

-- Remover columnas después de verificar migración
ALTER TABLE "cuentas_tributarias" DROP COLUMN "usuario_email";
ALTER TABLE "cuentas_tributarias" DROP COLUMN "usuario_portal";
ALTER TABLE "cuentas_tributarias" DROP COLUMN "password";
```

#### Backend - Controladores
- Crear controlador para `CredencialTributaria` (CRUD)
- Actualizar controlador de `CuentaTributaria` para usar credenciales
- Actualizar lógica de generación de liquidaciones para usar credenciales por tipo

#### Frontend
- Crear página/componente para gestionar Credenciales Tributarias
- Actualizar formulario de Cuenta Tributaria para seleccionar credencial
- Actualizar listado de Cuentas Tributarias

---

### Cambio 4: Nuevos Campos en Unidad

#### Backend
```prisma
model Unidad {
  id            String              @id @default(uuid())
  // ... campos existentes
  // Agregar nuevos campos aquí
  campoNuevo1 String?
  campoNuevo2 String?
  // ...
}
```

#### Migración
- Crear migración con nuevos campos
- Actualizar controladores
- Actualizar validaciones si es necesario

#### Frontend
- Actualizar formulario de Unidad
- Agregar campos nuevos en listados si es necesario

---

## 🚀 Orden de Implementación Recomendado

1. **Semana 1: Cambios Simples**
   - Nuevos campos en Inquilinos
   - Nuevos campos en Propietarios
   - Nuevos campos en Unidad
   - Testing básico

2. **Semana 2: Múltiples Propietarios**
   - Migración de base de datos
   - Actualización de controladores
   - Actualización de frontend
   - Testing completo

3. **Semana 3: Credenciales Tributarias**
   - Migración de base de datos
   - Actualización de controladores
   - Actualización de frontend
   - Testing completo

4. **Semana 4: Testing Final y Ajustes**
   - Testing end-to-end
   - Ajustes de bugs
   - Optimizaciones
   - Documentación

---

## ⚠️ Consideraciones Importantes

### Migración de Datos
- **Backup obligatorio** antes de cada migración
- Probar migraciones en entorno de desarrollo primero
- Verificar integridad de datos después de cada migración
- Plan de rollback si algo sale mal

### Compatibilidad
- Mantener compatibilidad con datos existentes durante la transición
- Usar campos opcionales donde sea posible
- Agregar validaciones gradualmente

### Testing
- Probar cada cambio de forma aislada
- Probar integración entre módulos
- Probar con datos reales si es posible

### Frontend
- Actualizar formularios gradualmente
- Mantener retrocompatibilidad si es posible
- Actualizar validaciones en frontend

---

## 📊 Estimación de Esfuerzo

| Cambio | Backend | Frontend | Testing | Total |
|--------|---------|----------|---------|-------|
| Nuevos campos (Inquilinos/Propietarios) | 2h | 3h | 1h | 6h |
| Nuevos campos (Unidad) | 1h | 2h | 1h | 4h |
| Múltiples propietarios | 8h | 6h | 4h | 18h |
| Credenciales tributarias | 8h | 6h | 4h | 18h |
| Testing final y ajustes | - | - | 8h | 8h |
| **TOTAL** | **19h** | **17h** | **18h** | **54h** |

**Estimación:** 1.5 - 2 semanas de trabajo a tiempo completo

---

## 🎯 Próximos Pasos

1. ✅ Revisar y aprobar este plan
2. ✅ Documentar TODOS los cambios requeridos (incluyendo los que mencionaste que tienes anotados)
3. ✅ Crear backup de base de datos
4. ✅ Empezar con Fase 2 (cambios simples)
5. ✅ Iterar y ajustar según sea necesario

---

## 📝 Notas

- Este plan es flexible y puede ajustarse según necesidades
- Se puede trabajar en paralelo en algunos cambios
- Priorizar cambios que bloquean otros desarrollos
- Comunicar cambios al equipo/cliente durante el proceso


