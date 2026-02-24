# Autocompletado de Importes desde ASSA

## Instalación de Playwright

Para que funcione el autocompletado desde ASSA, es necesario instalar Playwright:

```bash
cd backend
npm install playwright
npx playwright install chromium
```

## Configuración

1. **Credenciales ASSA**: 
   - Ir a Configuración > Tipos de Impuesto > AGUA
   - Configurar el campo "Usuario Oficina Virtual" con el email/usuario de ASSA
   - Configurar el campo "Contraseña Oficina Virtual" con la contraseña

2. **Punto de Suministro**:
   - Cada propiedad con impuesto AGUA debe tener configurado el campo "PUNTO_SUMINISTRO"
   - Este campo debe contener el número de punto de suministro (ej: "50002096")

## Uso

1. En la pantalla "Carga de Impuestos", seleccionar el período deseado (MM-YYYY)
2. Hacer click en el botón "Autocompletar importes (ASSA)"
3. El sistema:
   - Se conectará a la oficina virtual de ASSA
   - Obtendrá las facturas vigentes para todos los puntos configurados
   - Completará automáticamente los importes y vencimientos de los items de AGUA del período seleccionado
   - Mostrará un resumen con los items actualizados y posibles advertencias

## Reglas de Matching

- Solo se completan items cuyo vencimiento de factura caiga dentro del período seleccionado
- Si hay múltiples facturas en el período, se toma la de menor vencimiento
- Los items completados pasan a estado "COMPLETADO"

## Ejecución en Docker/VPS

Para ejecutar en un servidor, se recomienda usar Docker con la imagen oficial de Playwright:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-focal
# ... resto de la configuración
```

O instalar las dependencias del sistema necesarias:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2
```

## Troubleshooting

- Si falla el login: Verificar que las credenciales estén correctas en Configuración
- Si no encuentra puntos: Verificar que los puntos de suministro estén configurados en las propiedades
- Si no encuentra facturas: Verificar que existan facturas vigentes en ASSA para el período seleccionado
