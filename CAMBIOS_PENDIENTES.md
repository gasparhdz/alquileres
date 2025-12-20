# Cambios Pendientes - Documentación Completa

## 📋 Cambios Identificados

### ✅ 1. Nuevos Campos en Inquilinos
<!-- Especifica aquí qué campos nuevos necesitas -->
- [ ] Campo 1: ________________ (tipo: String/Number/Date/etc.)
- [ ] Campo 2: ________________ (tipo: String/Number/Date/etc.)
- [ ] Campo 3: ________________ (tipo: String/Number/Date/etc.)
- [ ] ...

**Notas:**
- ¿Alguno es obligatorio?
- ¿Alguno tiene valores predefinidos?
- ¿Alguno requiere validación especial?

---

### ✅ 2. Nuevos Campos en Propietarios
<!-- Especifica aquí qué campos nuevos necesitas -->
- [ ] Campo 1: ________________ (tipo: String/Number/Date/etc.)
- [ ] Campo 2: ________________ (tipo: String/Number/Date/etc.)
- [ ] Campo 3: ________________ (tipo: String/Number/Date/etc.)
- [ ] ...

**Notas:**
- ¿Alguno es obligatorio?
- ¿Alguno tiene valores predefinidos?
- ¿Alguno requiere validación especial?

---

### 🔄 3. Múltiples Propietarios por Unidad
**Estado:** Planificado en `PLAN_REFACTOR.md`

**Cambios requeridos:**
- [x] Crear tabla intermedia `UnidadPropietario`
- [ ] Agregar campo `porcentaje` (opcional) para distribución de propiedad
- [ ] Agregar campo `esPrincipal` para marcar propietario principal
- [ ] Actualizar controladores de Unidad
- [ ] Actualizar frontend de Unidad
- [ ] Actualizar consultas en otros módulos (Contratos, Liquidaciones)

**Preguntas:**
- ¿Necesitas porcentaje de propiedad por propietario?
- ¿Siempre debe haber un propietario principal?
- ¿Qué pasa con las unidades que ya tienen un propietario asignado?

---

### 🔄 4. Credenciales Tributarias por Tipo de Impuesto
**Estado:** Planificado en `PLAN_REFACTOR.md`

**Cambios requeridos:**
- [x] Crear nueva entidad `CredencialTributaria`
- [x] Remover campos `usuarioEmail`, `usuarioPortal`, `password` de `CuentaTributaria`
- [ ] Agregar relación `CuentaTributaria` -> `CredencialTributaria`
- [ ] Actualizar lógica de generación de liquidaciones
- [ ] Crear CRUD para Credenciales Tributarias
- [ ] Actualizar frontend de Cuentas Tributarias

**Preguntas:**
- ¿Las credenciales son globales por tipo de impuesto o pueden variar?
- ¿Necesitas múltiples credenciales por tipo de impuesto?
- ¿Cómo se determina qué credencial usar para cada unidad?

---

### ✅ 5. Nuevos Campos en Unidad (Propiedad)
<!-- Especifica aquí qué campos nuevos necesitas -->
- [ ] Campo 1: ________________ (tipo: String/Number/Date/etc.)
- [ ] Campo 2: ________________ (tipo: String/Number/Date/etc.)
- [ ] Campo 3: ________________ (tipo: String/Number/Date/etc.)
- [ ] ...

**Notas:**
- ¿Alguno es obligatorio?
- ¿Alguno tiene valores predefinidos?
- ¿Alguno requiere validación especial?

---

### 📝 6. Otros Cambios Mencionados
<!-- Documenta aquí todos los demás cambios que tienes anotados -->

#### Cambio 1: ________________
- Descripción: ________________
- Impacto: ________________
- Prioridad: Alta/Media/Baja

#### Cambio 2: ________________
- Descripción: ________________
- Impacto: ________________
- Prioridad: Alta/Media/Baja

#### Cambio 3: ________________
- Descripción: ________________
- Impacto: ________________
- Prioridad: Alta/Media/Baja

---

## 🎯 Priorización

### Alta Prioridad (Crítico para funcionamiento)
1. ________________
2. ________________
3. ________________

### Media Prioridad (Importante pero no bloquea)
1. ________________
2. ________________
3. ________________

### Baja Prioridad (Nice to have)
1. ________________
2. ________________
3. ________________

---

## 📝 Notas Adicionales

<!-- Agrega aquí cualquier otra información relevante -->
- ¿Hay datos en producción que deben migrarse?
- ¿Hay funcionalidades que ya no se necesitan?
- ¿Hay cambios en flujos de trabajo?
- ¿Hay cambios en validaciones o reglas de negocio?

---

## ✅ Checklist de Implementación

### Fase 1: Preparación
- [ ] Documentar todos los cambios pendientes
- [ ] Revisar y aprobar plan de refactor
- [ ] Crear backup de base de datos
- [ ] Preparar entorno de desarrollo

### Fase 2: Cambios Simples
- [ ] Nuevos campos en Inquilinos
- [ ] Nuevos campos en Propietarios
- [ ] Nuevos campos en Unidad
- [ ] Testing básico

### Fase 3: Múltiples Propietarios
- [ ] Migración de base de datos
- [ ] Actualización de controladores
- [ ] Actualización de frontend
- [ ] Testing completo

### Fase 4: Credenciales Tributarias
- [ ] Migración de base de datos
- [ ] Actualización de controladores
- [ ] Actualización de frontend
- [ ] Testing completo

### Fase 5: Otros Cambios
- [ ] Implementar cambio 1
- [ ] Implementar cambio 2
- [ ] Implementar cambio 3
- [ ] ...

### Fase 6: Testing Final
- [ ] Testing end-to-end
- [ ] Ajustes de bugs
- [ ] Optimizaciones
- [ ] Documentación

---

## 📊 Estimación de Esfuerzo

| Cambio | Backend | Frontend | Testing | Total |
|--------|---------|----------|---------|-------|
| Nuevos campos (Inquilinos/Propietarios) | ___h | ___h | ___h | ___h |
| Nuevos campos (Unidad) | ___h | ___h | ___h | ___h |
| Múltiples propietarios | 8h | 6h | 4h | 18h |
| Credenciales tributarias | 8h | 6h | 4h | 18h |
| Otros cambios | ___h | ___h | ___h | ___h |
| Testing final y ajustes | - | - | 8h | 8h |
| **TOTAL** | **___h** | **___h** | **___h** | **___h** |

---

## 🚀 Próximos Pasos

1. [ ] Completar este documento con todos los cambios pendientes
2. [ ] Revisar y aprobar plan de refactor
3. [ ] Priorizar cambios según necesidades
4. [ ] Empezar implementación por fases
5. [ ] Testing continuo durante desarrollo

---

## 📞 Contacto

Si tienes preguntas o necesitas aclaraciones sobre algún cambio, documenta aquí:

- Pregunta 1: ________________
- Pregunta 2: ________________
- Pregunta 3: ________________


