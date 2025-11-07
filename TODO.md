# Lista de Tareas Pendientes - Sistema de Alquileres

## 🔴 CRÍTICO - Para funcionamiento básico

### 1. Frontend - Módulo de Contratos (Completo)
- [ ] Formulario de creación/edición de contratos
- [ ] Gestión de responsabilidades de pago (agregar/editar/eliminar)
- [ ] Gestión de garantías (agregar/editar/eliminar)
- [ ] Gestión de gastos iniciales (agregar/editar/eliminar)
- [ ] Tabla/listado completo de contratos con filtros
- [ ] Detalle de contrato con todas sus relaciones
- [ ] Validaciones de fechas y montos

### 2. Frontend - Módulo de Liquidaciones (Completo)
- [ ] Formulario de creación manual de liquidaciones
- [ ] Generación automática de liquidaciones (usando endpoint `/generar`)
- [ ] Formulario de edición de items de liquidación
- [ ] Vista detallada de liquidación con items
- [ ] Botón para emitir liquidación (cambiar estado a "emitida")
- [ ] Filtros por período, contrato, estado
- [ ] Selector de período (formato YYYY-MM)
- [ ] Selector de contrato para generar

### 3. Frontend - Módulo de Cuentas Tributarias
- [ ] Página completa de cuentas tributarias
- [ ] Formulario de creación/edición
- [ ] Listado por unidad
- [ ] Asociación con unidades

## 🟡 IMPORTANTE - Mejoras funcionales

### 4. Dashboard Mejorado
- [ ] Resumen de contratos activos
- [ ] Próximos vencimientos
- [ ] Liquidaciones pendientes de emisión
- [ ] Gráficos o estadísticas básicas
- [ ] Alertas de contratos próximos a vencer

### 5. Validaciones y UX
- [ ] Validaciones de formularios en frontend (React Hook Form)
- [ ] Mensajes de error más descriptivos
- [ ] Loading states en todas las operaciones
- [ ] Confirmaciones antes de eliminar
- [ ] Búsqueda y filtros en todos los listados
- [ ] Paginación en tablas grandes

### 6. Selectores de Parámetros
- [ ] Componente reutilizable para seleccionar parámetros por categoría
- [ ] Usar en formularios de contratos, unidades, etc.
- [ ] Cargar parámetros desde API `/api/parametros`

## 🟢 NICE TO HAVE - Funcionalidades avanzadas

### 7. Importación desde Excel
- [ ] Backend: Endpoint para importar desde Excel
- [ ] Frontend: Página de importación
- [ ] Validación de datos antes de importar
- [ ] Reporte de errores y duplicados
- [ ] Modo dry-run (simulación)

### 8. Gestión de Pagos (Futuro según docs)
- [ ] Modelo de datos para pagos
- [ ] Registro de pagos parciales/totales
- [ ] Asociación de pagos con liquidaciones
- [ ] Estados de cobro

### 9. Reportes y Estadísticas
- [ ] Reporte de ingresos mensuales
- [ ] Reporte de impuestos por período
- [ ] Reporte de ocupación
- [ ] Exportación a PDF/Excel

## 🔧 MEJORAS TÉCNICAS

### 10. Backend
- [ ] Validación de datos más robusta
- [ ] Manejo de errores más específico
- [ ] Logging estructurado
- [ ] Tests unitarios básicos
- [ ] Documentación de API (Swagger/OpenAPI)

### 11. Frontend
- [ ] Componentes reutilizables (FormField, DataTable, etc.)
- [ ] Manejo de errores global
- [ ] Notificaciones/toast messages
- [ ] Loading skeletons
- [ ] Optimización de queries (React Query)

### 12. Configuración y Despliegue
- [ ] Scripts de deployment
- [ ] Configuración de variables de entorno para producción
- [ ] Docker Compose para desarrollo
- [ ] Guía de despliegue en VPS

## 📋 DATOS FALTANTES

### 13. Seed de Datos
- [ ] Verificar que todos los parámetros estén en el seed
- [ ] Agregar datos de ejemplo (opcional)

### 14. Documentación
- [ ] Guía de usuario
- [ ] Manual de instalación detallado
- [ ] Diagrama de base de datos
- [ ] Flujo de trabajo mensual documentado

## 🐛 BUGS POTENCIALES A REVISAR

- [ ] Validar que las relaciones onDelete funcionen correctamente
- [ ] Verificar que las liquidaciones no se puedan modificar después de emitidas
- [ ] Revisar cálculos de totales en liquidaciones
- [ ] Verificar formato de fechas en frontend (dayjs)
- [ ] Probar generación de PDF con diferentes datos

## 📝 NOTAS

**Prioridad Alta:**
1. Completar módulo de Contratos (frontend)
2. Completar módulo de Liquidaciones (frontend)
3. Módulo de Cuentas Tributarias

**Prioridad Media:**
4. Dashboard mejorado
5. Validaciones y UX
6. Selectores de parámetros

**Prioridad Baja:**
7. Importación Excel
8. Reportes
9. Pagos

