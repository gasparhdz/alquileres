# Análisis de Cambios de Requisitos

## 📋 Requisitos Iniciales vs. Requisitos Actuales

### Requisitos Iniciales (Lo que se diseñó)
- **Inquilinos/Propietarios**: Campos básicos (nombre, apellido, DNI, CUIT, email, teléfono, dirección, localidad, condición IVA)
- **Unidad-Propietario**: Relación 1:1 (una unidad tiene un solo propietario)
- **Cuentas Tributarias**: Credenciales (usuario/contraseña) por unidad y tipo de impuesto
- **Unidad (Propiedad)**: Campos básicos (dirección, localidad, tipo, estado, código interno, ambientes, descripción)

### Requisitos Actuales (Lo que se necesita ahora)
- **Inquilinos/Propietarios**: ✅ Requieren nuevos campos (especificar cuáles)
- **Unidad-Propietario**: 🔄 Relación Many-to-Many (una unidad puede tener múltiples propietarios)
- **Cuentas Tributarias**: 🔄 Credenciales por tipo de impuesto (no por unidad)
- **Unidad (Propiedad)**: ✅ Requiere nuevos campos (especificar cuáles)
- **Otros cambios**: 📝 Mencionados pero no especificados aún

---

## 🔍 Análisis de Impacto

### 1. Cambios en Modelo de Datos
- [x] Nuevas entidades requeridas
  - `UnidadPropietario` (tabla intermedia para relación Many-to-Many)
  - `CredencialTributaria` (credenciales por tipo de impuesto)
- [ ] Entidades existentes que ya no se necesitan
- [x] Campos nuevos requeridos
  - Nuevos campos en `Inquilino` (especificar)
  - Nuevos campos en `Propietario` (especificar)
  - Nuevos campos en `Unidad` (especificar)
- [ ] Campos existentes que cambiaron de significado
- [x] Relaciones que cambiaron
  - `Unidad` - `Propietario`: De 1:1 a Many-to-Many
  - `CuentaTributaria` - Credenciales: De campos directos a relación con `CredencialTributaria`

### 2. Cambios en Lógica de Negocio
- [ ] Flujos de trabajo que cambiaron
- [ ] Validaciones nuevas/eliminadas
- [ ] Cálculos que cambiaron
- [ ] Reglas de negocio nuevas

### 3. Cambios en Funcionalidades
- [ ] Funcionalidades que ya no se necesitan
- [ ] Funcionalidades nuevas requeridas
- [ ] Funcionalidades que cambiaron significativamente

---

## 💡 Evaluación

### ¿Qué se puede reutilizar?
- [ ] Base de datos: ¿La estructura actual sirve?
- [ ] Backend: ¿Los endpoints actuales sirven?
- [ ] Frontend: ¿Los componentes actuales sirven?
- [ ] Autenticación: ¿El sistema de usuarios sirve?
- [ ] Lógica de negocio: ¿Qué porcentaje se puede reutilizar?

### ¿Qué necesita cambios?
- [ ] Migraciones de base de datos necesarias
- [ ] Refactorización de controladores
- [ ] Nuevos endpoints requeridos
- [ ] Nuevos componentes de frontend
- [ ] Cambios en la lógica de negocio

---

## 🎯 Recomendación: **REFACTOR INCREMENTAL** ✅

### Justificación
Los cambios identificados son **refactorables** y no requieren empezar de cero:
- ✅ Nuevos campos: Fácil de agregar con migraciones
- ✅ Múltiples propietarios: Cambio estructural pero manejable
- ✅ Credenciales tributarias: Requiere nueva entidad pero no afecta lógica core
- ✅ Base de datos bien estructurada: Facilita migraciones

### Ventajas del Refactor
- ✅ Mantiene el trabajo ya realizado (backend completo, autenticación, etc.)
- ✅ Permite migración gradual sin perder funcionalidad
- ✅ Menor riesgo: se puede probar cada cambio de forma aislada
- ✅ Tiempo estimado: 1.5-2 semanas vs 4-6 semanas empezar de cero

### Plan de Acción
Ver archivo `PLAN_REFACTOR.md` para detalles completos del plan de implementación.

---

## 📝 Plan de Acción

### Si se decide Refactor:
1. Identificar módulos que no necesitan cambios
2. Planificar migraciones de datos
3. Refactorizar módulos uno por uno
4. Mantener sistema funcionando durante la transición

### Si se decide Empezar de Cero:
1. Documentar requisitos nuevos claramente
2. Diseñar nuevo modelo de datos
3. Definir nueva arquitectura
4. Planificar migración de datos existentes (si hay)
5. Implementar funcionalidades críticas primero

---

## ⚠️ Consideraciones Importantes

- **Datos existentes:** ¿Hay datos de producción que deben migrarse?
- **Tiempo disponible:** ¿Cuánto tiempo hay para implementar?
- **Equipo:** ¿Hay recursos suficientes para empezar de cero?
- **Riesgo:** ¿Cuál es el riesgo de cada opción?

