import { chromium } from 'playwright';

/**
 * Scraper para obtener liquidaciones/deudas de TGI desde SIAT Rosario
 * 
 * @param {Array<{propiedadImpuestoId: number, CTA: string, COD_GES: string}>} propiedades - Array de propiedades con sus credenciales
 * @param {Date} inicioPeriodo - Fecha de inicio del período (día 1 del mes, 00:00)
 * @param {Date} finPeriodo - Fecha de fin del período (día 1 del mes siguiente, 00:00, excluyente)
 * @returns {Promise<Array<{propiedadImpuestoId: number, CTA: string, COD_GES: string, importe: number, vencimiento: Date, refExterna: string}>>}
 */
export async function scrapeSiatLiquidaciones(propiedades, inicioPeriodo, finPeriodo) {
  if (!propiedades || propiedades.length === 0) {
    return [];
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Para Docker/VPS
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const page = await context.newPage();
  const resultados = [];

  try {
    // URL de SIAT Rosario
    const siatUrl = 'https://siat.rosario.gob.ar/siat/seg/Login.do?method=anonimo&url=/gde/AdministrarLiqDeuda.do?method=inicializarContr&id=14';
    
    for (const propiedad of propiedades) {
      const { propiedadImpuestoId, CTA, COD_GES } = propiedad;
      
      try {
        console.log(`[SIAT] Procesando propiedad ${propiedadImpuestoId} - CTA: ${CTA}, COD_GES: ${COD_GES ? '***' : 'NO CONFIGURADO'}`);
        
        if (!CTA || !COD_GES) {
          console.log(`[SIAT] Propiedad ${propiedadImpuestoId} sin credenciales completas`);
          continue;
        }

        // La página SIAT no tiene "cerrar sesión"; para cambiar de cuenta hay que volver al login.
        // Limpiar cookies y storage para que cada propiedad vea el formulario de login y no la sesión anterior.
        await context.clearCookies();
        await page.goto('about:blank').catch(() => {});
        await page.waitForTimeout(500);

        // Navegar a SIAT (pantalla de login limpia)
        console.log(`[SIAT] Navegando a SIAT para propiedad ${propiedadImpuestoId}...`);
        await page.goto(siatUrl, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
        
        await page.waitForTimeout(3000);
        
        // Verificar que estamos en la página correcta
        const urlInicial = page.url();
        console.log(`[SIAT] URL inicial: ${urlInicial}`);

        // Buscar campos de CTA y COD_GES
        // Los campos tienen nombres específicos según el HTML proporcionado
        const ctaSelectors = [
          'input[name="cuenta.numeroCuenta"]', // Selector específico
          'input[name*="numeroCuenta"]',
          'input[name*="cuenta"]',
          'input[id*="cuenta"]',
          'input[type="text"]:nth-of-type(1)'
        ];
        
        const codGesSelectors = [
          'input[name="cuenta.codGesPer"]', // Selector específico
          'input[name*="codGesPer"]',
          'input[name*="codigo"]',
          'input[name*="gestion"]',
          'input[id*="codigo"]',
          'input[id*="gestion"]',
          'input[type="text"]:nth-of-type(2)'
        ];

        let ctaField = null;
        let codGesField = null;

        // Buscar campo CTA
        for (const selector of ctaSelectors) {
          try {
            const field = await page.$(selector);
            if (field) {
              const isVisible = await field.isVisible().catch(() => false);
              if (isVisible) {
                ctaField = field;
                console.log(`[SIAT] Campo CTA encontrado: ${selector}`);
                break;
              }
            }
          } catch (e) {
            // Continuar con el siguiente selector
          }
        }

        // Buscar campo COD_GES
        for (const selector of codGesSelectors) {
          try {
            const field = await page.$(selector);
            if (field) {
              const isVisible = await field.isVisible().catch(() => false);
              if (isVisible) {
                codGesField = field;
                console.log(`[SIAT] Campo COD_GES encontrado: ${selector}`);
                break;
              }
            }
          } catch (e) {
            // Continuar con el siguiente selector
          }
        }

        if (!ctaField || !codGesField) {
          console.log(`[SIAT] No se encontraron los campos de entrada para propiedad ${propiedadImpuestoId}`);
          // Guardar screenshot para debugging
          await page.screenshot({ path: `siat-debug-${propiedadImpuestoId}.png` }).catch(() => {});
          continue;
        }

        // Completar campos
        console.log(`[SIAT] Completando credenciales para propiedad ${propiedadImpuestoId}...`);
        await ctaField.fill(CTA.trim());
        await page.waitForTimeout(500);
        await codGesField.fill(COD_GES.trim());
        await page.waitForTimeout(500);

        // Buscar el botón "Aceptar" que ejecuta submitForm
        // El botón tiene: name="btnAceptar", onclick="submitForm('ingresarLiqDeudaContr', '');"
        let botonEncontrado = false;
        
        // Buscar el botón específico de SIAT
        const botonSelectors = [
          'button[name="btnAceptar"]',
          'button.boton',
          'button:has-text("Aceptar")',
          'input[type="submit"]',
          'button[type="submit"]',
          'input[value*="Consultar"]',
          'input[value*="Ingresar"]',
          'button:has-text("Consultar")',
          'button:has-text("Ingresar")'
        ];

        for (const selector of botonSelectors) {
          try {
            const boton = await page.$(selector);
            if (boton) {
              const isVisible = await boton.isVisible().catch(() => false);
              if (isVisible) {
                // Esperar a que la navegación se complete
                const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => null);
                await boton.click();
                botonEncontrado = true;
                console.log(`[SIAT] Botón encontrado y clickeado: ${selector}`);
                await navigationPromise;
                break;
              }
            }
          } catch (e) {
            console.log(`[SIAT] Error al intentar click en ${selector}: ${e.message}`);
            // Continuar con el siguiente selector
          }
        }

        // Si no se encontró el botón, intentar ejecutar la función JavaScript directamente
        if (!botonEncontrado) {
          try {
            console.log(`[SIAT] Intentando ejecutar submitForm directamente...`);
            const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => null);
            await page.evaluate(() => {
              if (typeof submitForm === 'function') {
                submitForm('ingresarLiqDeudaContr', '');
              }
            });
            await navigationPromise;
            botonEncontrado = true;
            console.log(`[SIAT] Función submitForm ejecutada`);
          } catch (e) {
            console.log(`[SIAT] Error al ejecutar submitForm: ${e.message}`);
          }
        }

        // Si aún no funcionó, intentar submit del formulario
        if (!botonEncontrado) {
          const form = await page.$('form');
          if (form) {
            try {
              const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => null);
              await form.evaluate(form => form.submit());
              botonEncontrado = true;
              console.log(`[SIAT] Formulario enviado`);
              await navigationPromise;
            } catch (e) {
              console.log(`[SIAT] Error al enviar formulario: ${e.message}`);
            }
          }
        }

        // Esperar un poco más para que cargue completamente
        await page.waitForTimeout(3000);
        
        // Verificar que la página haya cargado correctamente
        const currentUrl = page.url();
        console.log(`[SIAT] URL actual después del login: ${currentUrl}`);
        
        // Verificar si la URL cambió (indicando que hubo navegación)
        if (currentUrl === urlInicial) {
          console.log(`[SIAT] ADVERTENCIA: La URL no cambió después del login. Posible error en el login.`);
          
          // Guardar screenshot para debugging
          await page.screenshot({ path: `siat-login-failed-${propiedadImpuestoId}.png` }).catch(() => {});
          
          // Buscar mensajes de error en la página
          const pageText = await page.evaluate(() => document.body.innerText);
          console.log(`[SIAT] Texto de la página (primeros 1000 caracteres): ${pageText.substring(0, 1000)}`);
          
          // Buscar elementos de error
          const errorElements = await page.$$('span.error, div.error, .mensaje-error, .alert, .error-message');
          if (errorElements.length > 0) {
            for (const errorElem of errorElements) {
              const errorText = await errorElem.textContent();
              console.log(`[SIAT] Mensaje de error encontrado: ${errorText}`);
            }
          }
          
          // Intentar buscar el formulario y ver si hay validaciones
          const form = await page.$('form');
          if (form) {
            const formHtml = await form.innerHTML();
            console.log(`[SIAT] HTML del formulario (primeros 500 caracteres): ${formHtml.substring(0, 500)}`);
          }
        }
        
        // Esperar a que aparezca la tabla de deudas
        try {
          await page.waitForSelector('table.tableDeuda', { timeout: 10000 });
          console.log(`[SIAT] Tabla tableDeuda encontrada`);
        } catch (e) {
          // Si no aparece la tabla, verificar qué hay en la página
          const pageTitle = await page.title();
          console.log(`[SIAT] Título de la página: ${pageTitle}`);
          
          // Guardar screenshot para debugging
          await page.screenshot({ path: `siat-after-login-${propiedadImpuestoId}.png` }).catch(() => {});
          
          // Intentar buscar cualquier tabla
          const todasLasTablas = await page.$$('table');
          console.log(`[SIAT] Total de tablas encontradas en la página: ${todasLasTablas.length}`);
          
          // Si no hay tablas, puede que el login haya fallado
          if (todasLasTablas.length === 0) {
            console.log(`[SIAT] No se encontraron tablas. El login puede haber fallado.`);
            continue; // Saltar esta propiedad y continuar con la siguiente
          }
        }

        // Buscar la tabla de deudas específica de SIAT
        let liquidaciones = [];
        
        // Buscar la tabla con clase tableDeuda
        const tablaDeuda = await page.$('table.tableDeuda');
        
        if (tablaDeuda) {
          console.log(`[SIAT] Tabla de deudas encontrada para propiedad ${propiedadImpuestoId}`);
          
          // Buscar todas las filas principales dentro de tbody (cada una representa un período)
          // Excluir las filas de totales que tienen clase "celdatotales"
          const filasPrincipales = await tablaDeuda.$$('tbody tr:not(.celdatotales)');
          
          for (const fila of filasPrincipales) {
            try {
              // Buscar el td con el período (formato YYYY-MM)
              // El período está en el segundo td (índice 1) después del checkbox
              const celdas = await fila.$$('td');
              if (celdas.length < 2) continue;
              
              const periodoCell = celdas[1]; // Segundo td
              const periodoText = await periodoCell.textContent();
              const periodoMatch = periodoText.trim().match(/(\d{4})-(\d{2})/);
              if (!periodoMatch) continue;
              
              const [, anioPeriodo, mesPeriodo] = periodoMatch;
              
              // Buscar la tabla anidada dentro de esta fila
              const tablaAnidada = await fila.$('table');
              if (!tablaAnidada) continue;
              
              // Buscar las filas dentro de la tabla anidada (cada una es una deuda)
              const filasDeuda = await tablaAnidada.$$('tbody tr');
              
              for (const filaDeuda of filasDeuda) {
                try {
                  // Obtener todas las celdas de la fila
                  const celdas = await filaDeuda.$$('td');
                  if (celdas.length < 4) continue;
                  
                  // El importe está en la tercera celda (índice 2): "$ 21.102,54"
                  const importeCell = celdas[2];
                  const importeText = await importeCell.textContent();
                  const importeMatch = importeText.match(/\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
                  
                  // El vencimiento está en la cuarta celda (índice 3): "10/03/2026"
                  const vencimientoCell = celdas[3];
                  const vencimientoText = await vencimientoCell.textContent();
                  const vencimientoMatch = vencimientoText.match(/(\d{2}\/\d{2}\/\d{4})/);
                  
                  if (importeMatch && vencimientoMatch) {
                    // Parsear importe: "21.102,54" -> 21102.54
                    const importeStr = importeMatch[1].replace(/\./g, '').replace(',', '.');
                    const importe = parseFloat(importeStr) || 0;
                    
                    // Parsear vencimiento: "10/03/2026"
                    const fechaStr = vencimientoMatch[1];
                    const [dia, mes, anio] = fechaStr.split('/');
                    const vencimiento = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                    
                    // Buscar referencia (selectedId del enlace de detalle)
                    let refExterna = null;
                    const enlaceDetalle = await filaDeuda.$('a[href*="verDetalleDeuda"]');
                    if (enlaceDetalle) {
                      const href = await enlaceDetalle.getAttribute('href');
                      const selectedIdMatch = href.match(/selectedId=(\d+)/);
                      if (selectedIdMatch) {
                        refExterna = `Liq ${selectedIdMatch[1]}`;
                      }
                    }
                    
                    if (!refExterna) {
                      refExterna = `Liq ${anioPeriodo}-${mesPeriodo}`;
                    }
                    
                    liquidaciones.push({
                      vencimiento,
                      importe,
                      refExterna
                    });
                    
                    console.log(`[SIAT] Liquidación encontrada: Período ${anioPeriodo}-${mesPeriodo}, Vencimiento ${fechaStr}, Importe $${importe}`);
                  }
                } catch (e) {
                  console.log(`[SIAT] Error al procesar fila de deuda: ${e.message}`);
                  continue;
                }
              }
            } catch (e) {
              console.log(`[SIAT] Error al procesar fila principal: ${e.message}`);
              continue;
            }
          }
        } else {
          console.log(`[SIAT] No se encontró la tabla tableDeuda para propiedad ${propiedadImpuestoId}`);
        }

        console.log(`[SIAT] Encontradas ${liquidaciones.length} liquidaciones para propiedad ${propiedadImpuestoId}`);

        // Filtrar liquidaciones por período y seleccionar la de menor vencimiento
        const liquidacionesEnPeriodo = liquidaciones.filter(liq => {
          return liq.vencimiento >= inicioPeriodo && liq.vencimiento < finPeriodo;
        });

        if (liquidacionesEnPeriodo.length > 0) {
          // Ordenar por vencimiento y tomar la de menor vencimiento
          liquidacionesEnPeriodo.sort((a, b) => a.vencimiento - b.vencimiento);
          const liquidacionSeleccionada = liquidacionesEnPeriodo[0];
          
          resultados.push({
            propiedadImpuestoId,
            CTA,
            COD_GES,
            importe: liquidacionSeleccionada.importe,
            vencimiento: liquidacionSeleccionada.vencimiento,
            refExterna: liquidacionSeleccionada.refExterna || `Liq ${liquidacionSeleccionada.vencimiento.toLocaleDateString('es-AR')}`
          });
          
          console.log(`[SIAT] ✓ Liquidación encontrada para propiedad ${propiedadImpuestoId}: Vencimiento ${liquidacionSeleccionada.vencimiento.toLocaleDateString('es-AR')}, Importe $${liquidacionSeleccionada.importe}`);
        } else {
          console.log(`[SIAT] No se encontró liquidación en el período para propiedad ${propiedadImpuestoId}`);
        }

      } catch (error) {
        console.error(`[SIAT] Error al procesar propiedad ${propiedadImpuestoId}: ${error.message}`);
        // Continuar con la siguiente propiedad
      }
    }

  } finally {
    await browser.close();
  }

  return resultados;
}
