# Sistema de Alquileres

Sistema completo para administración de alquileres, contratos y liquidaciones mensuales.

## Tecnologías

- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL
- **Frontend**: React + Vite + Material UI
- **Autenticación**: JWT
- **PDF**: Puppeteer

## Estructura del Proyecto

```
alquileres/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   └── server.js
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── pages/
│   │   └── main.jsx
│   └── package.json
└── README.md
```

## Instalación

### Backend

1. Navegar a la carpeta backend:
```bash
cd backend
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales de PostgreSQL:
```
DATABASE_URL="postgresql://user:password@localhost:5432/alquileres"
JWT_SECRET="tu_clave_secreta"
PORT=4000
```

4. Generar cliente Prisma:
```bash
npm run prisma:generate
```

5. Ejecutar migraciones:
```bash
npm run prisma:migrate
```

6. Ejecutar seed (datos iniciales):
```bash
npm run prisma:seed
```

7. Iniciar servidor:
```bash
npm run dev
```

### Frontend

1. Navegar a la carpeta frontend:
```bash
cd frontend
```

2. Instalar dependencias:
```bash
npm install
```

3. Iniciar servidor de desarrollo:
```bash
npm run dev
```

## Credenciales por defecto

Después de ejecutar el seed:
- **Email**: admin@alquileres.com
- **Contraseña**: admin123

## Funcionalidades

### Módulos principales

- ✅ **Inquilinos**: CRUD completo
- ✅ **Propietarios**: CRUD completo
- ✅ **Unidades**: CRUD completo
- ✅ **Contratos**: Gestión de contratos
- ✅ **Liquidaciones**: Generación y emisión de liquidaciones mensuales
- ✅ **Autenticación**: Login con JWT

### Próximas funcionalidades

- Gestión completa de contratos (responsabilidades, garantías, gastos iniciales)
- Cuentas tributarias por unidad
- Generación automática de liquidaciones
- Registro de pagos
- Reportes y estadísticas

## Scripts disponibles

### Backend

- `npm run dev`: Inicia servidor en modo desarrollo
- `npm start`: Inicia servidor en producción
- `npm run prisma:generate`: Genera cliente Prisma
- `npm run prisma:migrate`: Ejecuta migraciones
- `npm run prisma:studio`: Abre Prisma Studio
- `npm run prisma:seed`: Ejecuta seed de datos iniciales

### Frontend

- `npm run dev`: Inicia servidor de desarrollo
- `npm run build`: Construye para producción
- `npm run preview`: Previsualiza build de producción

## Base de Datos

El sistema utiliza PostgreSQL. El modelo de datos incluye:

- Inquilinos y Propietarios
- Unidades
- Contratos
- Cuentas Tributarias
- Liquidaciones y Items
- Garantías y Gastos Iniciales
- Parámetros y Categorías
- Usuarios y Roles

## Despliegue

### Desarrollo Local

1. Instalar PostgreSQL localmente
2. Configurar `.env` con conexión local
3. Ejecutar migraciones y seed
4. Iniciar backend y frontend

### Producción (VPS)

1. Configurar PostgreSQL en servidor
2. Configurar variables de entorno de producción
3. Ejecutar migraciones
4. Usar PM2 o Docker para ejecutar backend
5. Configurar Nginx como proxy reverso
6. Construir frontend y servir archivos estáticos

## Notas

- Todas las eliminaciones son lógicas (soft delete)
- El sistema incluye validaciones de unicidad según especificaciones
- Las liquidaciones se pueden emitir y generar PDF
- El sistema está preparado para escalar a múltiples usuarios y roles

## Autor

Gaspar Hernández - Noviembre 2025

