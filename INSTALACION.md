# Guía de Instalación - Sistema de Alquileres

## Requisitos Previos

- Node.js 22.x o superior
- PostgreSQL 15+ instalado y corriendo
- npm o yarn

## Paso 1: Configurar Base de Datos PostgreSQL

### Opción A: PostgreSQL Local (Windows)

1. Si no tienes PostgreSQL instalado:
   - Descarga desde: https://www.postgresql.org/download/windows/
   - O usa el instalador: https://www.postgresql.org/download/windows/installers/

2. Crea la base de datos:
   ```sql
   -- Abre pgAdmin o psql
   CREATE DATABASE alquileres;
   ```

### Opción B: Docker (Recomendado para desarrollo)

```bash
docker run --name postgres-alquileres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=alquileres \
  -p 5432:5432 \
  -d postgres:15
```

## Paso 2: Configurar Backend

1. Navega a la carpeta backend:
```bash
cd backend
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea el archivo `.env`:
```bash
# En Windows PowerShell
copy .env.example .env

# O crea manualmente el archivo .env con este contenido:
```

Edita el archivo `.env` con tus credenciales:
```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/alquileres"
JWT_SECRET="clave_super_segura_cambiar_en_produccion"
JWT_EXPIRES_IN="7d"
PORT=4000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
```

**Ejemplo con usuario por defecto:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alquileres"
JWT_SECRET="mi_clave_secreta_12345"
JWT_EXPIRES_IN="7d"
PORT=4000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
```

4. Genera el cliente de Prisma:
```bash
npm run prisma:generate
```

5. Ejecuta las migraciones (crea las tablas):
```bash
npm run prisma:migrate
```

Cuando te pregunte el nombre de la migración, puedes poner: `init`

6. Ejecuta el seed (crea datos iniciales):
```bash
npm run prisma:seed
```

Esto creará:
- Usuario administrador: `admin@alquileres.com` / `admin123`
- Roles y parámetros del sistema

7. Inicia el servidor backend:
```bash
npm run dev
```

Deberías ver:
```
🚀 Servidor corriendo en http://localhost:4000
```

## Paso 3: Configurar Frontend

1. Abre una **nueva terminal** y navega a la carpeta frontend:
```bash
cd frontend
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

Deberías ver:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

## Paso 4: Acceder al Sistema

1. Abre tu navegador en: http://localhost:5173

2. Inicia sesión con:
   - **Email:** `admin@alquileres.com`
   - **Contraseña:** `admin123`

## Verificación

### Backend funcionando:
- Abre: http://localhost:4000/api/health
- Deberías ver: `{"status":"ok","message":"Sistema de Alquileres API"}`

### Frontend funcionando:
- Abre: http://localhost:5173
- Deberías ver la página de login

## Comandos Útiles

### Backend
```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start

# Ver base de datos en navegador
npm run prisma:studio

# Crear nueva migración
npm run prisma:migrate

# Resetear base de datos (CUIDADO: borra todo)
npx prisma migrate reset
```

### Frontend
```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

## Solución de Problemas

### Error: "Cannot find module"
```bash
# Elimina node_modules y reinstala
rm -rf node_modules package-lock.json
npm install
```

### Error de conexión a PostgreSQL
- Verifica que PostgreSQL esté corriendo
- Verifica las credenciales en `.env`
- Verifica que la base de datos `alquileres` exista

### Error: "Prisma Client not generated"
```bash
npm run prisma:generate
```

### Error en el frontend: "Cannot connect to API"
- Verifica que el backend esté corriendo en puerto 4000
- Verifica que `CORS_ORIGIN` en `.env` del backend sea `http://localhost:5173`

### Puerto 4000 ya en uso
```bash
# Cambia el puerto en backend/.env
PORT=4001
# Y en frontend/vite.config.js cambia el proxy a puerto 4001
```

## Estructura de Archivos Esperada

```
alquileres/
├── backend/
│   ├── .env                    ← CREAR ESTE ARCHIVO
│   ├── .env.example
│   ├── node_modules/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   └── package.json
└── frontend/
    ├── node_modules/
    ├── src/
    └── package.json
```

## Próximos Pasos

Una vez levantado el sistema:
1. ✅ Verifica que puedas hacer login
2. ✅ Crea un propietario de prueba
3. ✅ Crea un inquilino de prueba
4. ✅ Crea una unidad
5. ⏳ Crea un contrato (módulo pendiente)
6. ⏳ Genera una liquidación (módulo pendiente)

