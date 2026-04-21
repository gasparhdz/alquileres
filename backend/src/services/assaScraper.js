import { chromium } from 'playwright';

/**
 * Scraper para obtener facturas vigentes de Aguas Santafesinas (ASSA)
 * 
 * @param {string} usuario - Usuario/email de la oficina virtual
 * @param {string} password - Contraseña de la oficina virtual
 * @param {Date} inicioPeriodo - Fecha de inicio del período (día 1 del mes, 00:00)
 * @param {Date} finPeriodo - Fecha de fin del período (día 1 del mes siguiente, 00:00, excluyente)
 * @param {Array<string>} puntosFiltrar - Array de puntos de suministro a procesar (opcional)
 * @returns {Promise<Array<{punto: string, importe: number, vencimiento: Date, referencia: string}>>}
 */
export async function scrapeAssaFacturas(usuario, password, inicioPeriodo, finPeriodo, puntosFiltrar = null) {
  if (!usuario || !password) {
    throw new Error('Usuario y contraseña son requeridos');
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

  try {
    // Paso 1: Ir a la página de login
    console.log('[ASSA] Navegando a página de login...');
    try {
      await page.goto('https://www.aguassantafesinas.com.ar/Gestiones/home.aspx', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
    } catch (error) {
      // Si falla con domcontentloaded, intentar con load
      console.log('[ASSA] Reintentando con waitUntil: load...');
      await page.goto('https://www.aguassantafesinas.com.ar/Gestiones/home.aspx', {
        waitUntil: 'load',
        timeout: 60000
      });
    }

    // Paso 2: Completar usuario y password
    console.log('[ASSA] Completando credenciales...');
    
    // Esperar a que los campos estén disponibles (aumentar timeout)
    await page.waitForSelector('input[type="text"], input[name*="usuario"], input[id*="usuario"]', { timeout: 20000 });
    await page.waitForSelector('input[type="password"]', { timeout: 20000 });
    
    // Intentar diferentes selectores posibles para usuario
    const usuarioSelectors = [
      'input[name*="usuario"]',
      'input[id*="usuario"]',
      'input[type="text"]',
      '#txtUsuario',
      'input[name="txtUsuario"]'
    ];
    
    let usuarioField = null;
    for (const selector of usuarioSelectors) {
      try {
        usuarioField = await page.$(selector);
        if (usuarioField) {
          await usuarioField.fill(usuario);
          break;
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }
    
    if (!usuarioField) {
      throw new Error('No se pudo encontrar el campo de usuario');
    }

    // Completar password
    await page.fill('input[type="password"]', password);

    // Paso 3: Click en "Ingresar"
    console.log('[ASSA] Haciendo click en Ingresar...');
    const ingresarSelectors = [
      'button:has-text("Ingresar")',
      'input[type="submit"][value*="Ingresar"]',
      'a:has-text("Ingresar")',
      '#btnIngresar',
      'button[type="submit"]'
    ];
    
    let clicked = false;
    for (const selector of ingresarSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          clicked = true;
          break;
        }
      } catch (e) {
        // Continuar
      }
    }
    
    if (!clicked) {
      // Intentar presionar Enter
      await page.keyboard.press('Enter');
    }

    // Paso 4: Esperar a que cargue la oficina virtual
    console.log('[ASSA] Esperando carga de oficina virtual...');
    await page.waitForURL(/Gestiones|oficina|home|default/i, { timeout: 30000 });
    
    // Esperar un poco más para que cargue completamente
    await page.waitForTimeout(2000);

    // Paso 4.5: Cerrar popups/modales informativos si aparecen
    console.log('[ASSA] Verificando si hay popups para cerrar...');
    
    const popupSelectors = [
      // Botón "CONTINUAR" del popup
      'button:has-text("CONTINUAR")',
      'button:has-text("Continuar")',
      'button:has-text("CONTINUE")',
      'a:has-text("CONTINUAR")',
      // Botón X para cerrar
      'button[aria-label*="cerrar"]',
      'button[aria-label*="close"]',
      '.close',
      '[class*="close"]',
      '[class*="modal-close"]',
      // Cualquier botón dentro de un modal/popup
      'div[class*="modal"] button',
      'div[class*="popup"] button',
      'div[id*="modal"] button',
      'div[id*="popup"] button'
    ];
    
    for (const selector of popupSelectors) {
      try {
        const popupButton = await page.$(selector);
        if (popupButton) {
          const visible = await popupButton.isVisible();
          if (visible) {
            console.log(`[ASSA] Cerrando popup con selector: ${selector}`);
            await popupButton.click();
            await Promise.race([
              page.waitForLoadState('domcontentloaded'),
              page.waitForTimeout(3000)
            ]).catch(() => {});
            await page.waitForTimeout(1000);
            break; // Solo cerrar un popup
          }
        }
      } catch (e) {
        // Continuar con el siguiente selector
        continue;
      }
    }
    
    // También intentar presionar Escape para cerrar modales
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } catch (e) {
      // No es crítico si falla
    }
    
    // Esperar más tiempo después de cerrar popup y que la página esté estable (evitar "Execution context was destroyed")
    console.log('[ASSA] Esperando a que cargue el contenido después del popup...');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    // Hacer scroll para asegurar que todo el contenido esté cargado (en try/catch por si hubo navegación)
    try {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1000);
    } catch (e) {
      if (!/Execution context was destroyed|Target closed/.test(e?.message || '')) throw e;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }

    // Paso 5: Buscar selector de puntos de suministro
    console.log('[ASSA] Buscando selector de puntos...');
    
    // Esperar específicamente por el selector con UNIDAD
    try {
      await page.waitForSelector('select[name*="UNIDAD"], select[id*="UNIDAD"]', { timeout: 10000 });
      console.log('[ASSA] Selector encontrado esperando...');
    } catch (e) {
      console.log('[ASSA] No se encontró selector esperando, buscando de otras formas...');
    }
    
    await page.waitForTimeout(2000);
    
    // Intentar diferentes estrategias para encontrar el selector
    // Basado en el HTML real: select con id/name dinámico que contiene "UNIDAD"
    const puntoSelectors = [
      // Selectores específicos basados en el HTML real
      'select[name*="UNIDAD"]',
      'select[id*="UNIDAD"]',
      'select.Attribute_Filter',
      'select.form-control[class*="Attribute"]',
      // Selectores genéricos
      'select[id*="punto"]',
      'select[name*="punto"]',
      'select[id*="suministro"]',
      'select[name*="suministro"]',
      'select[id*="Punto"]',
      'select[name*="Punto"]',
      'select[id*="Suministro"]',
      'select[name*="Suministro"]',
      'select',
      '#ddlPuntoSuministro',
      'select#ddlPuntoSuministro',
      'select.ddlPuntoSuministro',
      // También puede ser un input con dropdown
      'input[type="text"][id*="punto"]',
      'input[type="text"][id*="suministro"]',
      // O un div/span clickeable que abre un dropdown
      'div[id*="punto"]',
      'div[class*="punto"]'
    ];
    
    let puntoSelect = null;
    let selectorEncontrado = null;
    
    for (const selector of puntoSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const tagName = await element.evaluate(el => el.tagName.toLowerCase());
          
          // Si es un select, verificar que tenga opciones
          if (tagName === 'select') {
            const options = await element.$$('option');
            if (options.length > 1) {
              puntoSelect = element;
              selectorEncontrado = selector;
              console.log(`[ASSA] Selector encontrado: ${selector} (${options.length} opciones)`);
              break;
            }
          } else {
            // Para otros elementos, verificar que sean visibles
            const visible = await element.isVisible();
            if (visible) {
              puntoSelect = element;
              selectorEncontrado = selector;
              console.log(`[ASSA] Elemento encontrado: ${selector}`);
              break;
            }
          }
        }
      } catch (e) {
        // Continuar con el siguiente selector
        continue;
      }
    }
    
    // Si no encontramos un select, intentar buscar cualquier elemento que contenga el texto del punto
    if (!puntoSelect) {
      console.log('[ASSA] No se encontró select estándar, buscando elementos alternativos...');
      
      // Buscar elementos que puedan ser el selector (input, div, etc.)
      const elementosAlternativos = await page.$$('input, div, span, button');
      for (const elem of elementosAlternativos) {
        try {
          const texto = await elem.textContent();
          const id = await elem.getAttribute('id');
          const className = await elem.getAttribute('class');
          
          // Si contiene "punto" o "suministro" en id, class o está cerca de un label con ese texto
          if ((id && (id.toLowerCase().includes('punto') || id.toLowerCase().includes('suministro'))) ||
              (className && (className.toLowerCase().includes('punto') || className.toLowerCase().includes('suministro')))) {
            const visible = await elem.isVisible();
            if (visible) {
              puntoSelect = elem;
              selectorEncontrado = `elemento alternativo (${id || className})`;
              console.log(`[ASSA] Elemento alternativo encontrado: ${id || className}`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!puntoSelect) {
      // Intentar una búsqueda más exhaustiva: buscar todos los selects en la página
      console.log('[ASSA] Búsqueda exhaustiva: listando todos los selects en la página...');
      const allSelects = await page.$$('select');
      console.log(`[ASSA] Encontrados ${allSelects.length} elementos select en la página`);
      
      for (let i = 0; i < allSelects.length; i++) {
        try {
          const select = allSelects[i];
          const id = await select.getAttribute('id');
          const name = await select.getAttribute('name');
          const className = await select.getAttribute('class');
          const visible = await select.isVisible();
          const options = await select.$$('option');
          
          console.log(`[ASSA] Select ${i + 1}: id="${id}", name="${name}", class="${className}", visible=${visible}, options=${options.length}`);
          
          // Si tiene opciones y es visible, podría ser el que buscamos
          if (visible && options.length > 0) {
            // Leer el texto de la primera opción para ver si parece un punto de suministro
            const firstOptionText = await options[0].textContent();
            if (firstOptionText && /^\d+\s*\|/.test(firstOptionText.trim())) {
              console.log(`[ASSA] Posible selector encontrado: ${id || name || className}`);
              puntoSelect = select;
              break;
            }
          }
        } catch (e) {
          console.log(`[ASSA] Error al examinar select ${i + 1}:`, e.message);
        }
      }
    }
    
    if (!puntoSelect) {
      // Tomar screenshot para debugging
      await page.screenshot({ path: 'assa-debug-selector.png', fullPage: true });
      console.log('[ASSA] Screenshot guardado en assa-debug-selector.png');
      
      // También guardar el HTML de la página para debugging
      const html = await page.content();
      const fs = await import('fs');
      fs.writeFileSync('assa-debug-page.html', html);
      console.log('[ASSA] HTML de la página guardado en assa-debug-page.html');
      
      throw new Error('No se pudo encontrar el selector de puntos de suministro. Se guardó un screenshot y el HTML para debugging.');
    }

    // Obtener todas las opciones de puntos
    let puntos = [];
    const tagName = await puntoSelect.evaluate(el => el.tagName.toLowerCase());
    
    if (tagName === 'select') {
      // Es un select estándar
      const options = await puntoSelect.$$('option');
      
      // Determinar desde dónde empezar (puede que no haya placeholder)
      let startIndex = 0;
      if (options.length > 1) {
        // Si hay más de una opción, verificar si la primera es un placeholder
        const firstOption = options[0];
        const firstText = await firstOption.textContent();
        const firstValue = await firstOption.getAttribute('value');
        
        // Si la primera opción tiene value vacío, "0", o texto como "Seleccionar", es un placeholder
        if (!firstValue || firstValue === '0' || firstValue === '' || 
            /seleccionar|elige|choose|select/i.test(firstText)) {
          startIndex = 1;
        }
      }
      
      console.log(`[ASSA] Procesando ${options.length} opciones, empezando desde índice ${startIndex}`);
      
      for (let i = startIndex; i < options.length; i++) {
        const option = options[i];
        const value = await option.getAttribute('value');
        const text = await option.textContent();
        
        console.log(`[ASSA] Opción ${i}: value="${value}", text="${text}"`);
        
        if (value && value.trim() !== '' && value !== '0') {
          // Extraer el número de punto del texto (ej: "50002096 | SARMIENTO...")
          const puntoMatch = text.match(/^(\d+)/);
          const puntoNumero = puntoMatch ? puntoMatch[1] : value.trim();
          
          // Si hay filtro, solo agregar si está en la lista
          if (puntosFiltrar && puntosFiltrar.length > 0 && !puntosFiltrar.includes(puntoNumero)) {
            console.log(`[ASSA] Punto ${puntoNumero} omitido (no está en la base de datos)`);
            continue; // NO agregar este punto
          }
          
          console.log(`[ASSA] Punto encontrado y agregado: ${puntoNumero}`);
          
          puntos.push({
            value: puntoNumero,
            text: text.trim()
          });
        } else {
          console.log(`[ASSA] Opción ${i} descartada: value="${value}"`);
        }
      }
    } else {
      // Puede ser un input con dropdown o elemento personalizado
      // Intentar hacer click para abrir el dropdown
      try {
        await puntoSelect.click();
        await page.waitForTimeout(1000);
        
        // Buscar opciones en el dropdown que se abrió
        const dropdownOptions = await page.$$('li, div[role="option"], option, .dropdown-item, [data-value]');
        
        for (const option of dropdownOptions) {
          try {
            const text = await option.textContent();
            const value = await option.getAttribute('value') || await option.getAttribute('data-value');
            
            if (text && text.trim()) {
              // Extraer el número de punto del texto (ej: "50002096 | SARMIENTO...")
              const puntoMatch = text.match(/^(\d+)/);
              if (puntoMatch) {
                const puntoNumero = puntoMatch[1];
                
                // Si hay filtro, solo agregar si está en la lista
                if (puntosFiltrar && puntosFiltrar.length > 0 && !puntosFiltrar.includes(puntoNumero)) {
                  console.log(`[ASSA] Punto ${puntoNumero} omitido (no está en la base de datos)`);
                  continue; // NO agregar este punto
                }
                
                puntos.push({
                  value: puntoNumero,
                  text: text.trim()
                });
                console.log(`[ASSA] Punto encontrado y agregado: ${puntoNumero}`);
              }
            }
          } catch (e) {
            continue;
          }
        }
      } catch (e) {
        console.log('[ASSA] No se pudo abrir dropdown, intentando leer valor directamente...');
        // Si no se puede abrir, intentar leer el valor actual
        const currentValue = await puntoSelect.inputValue ? await puntoSelect.inputValue() : await puntoSelect.textContent();
        if (currentValue) {
          const puntoMatch = currentValue.match(/^(\d+)/);
          if (puntoMatch) {
            const puntoNumero = puntoMatch[1];
            
            // Si hay filtro, solo agregar si está en la lista
            if (puntosFiltrar && puntosFiltrar.length > 0 && !puntosFiltrar.includes(puntoNumero)) {
              console.log(`[ASSA] Punto ${puntoNumero} omitido (no está en la base de datos)`);
            } else {
              puntos.push({
                value: puntoNumero,
                text: currentValue.trim()
              });
              console.log(`[ASSA] Punto encontrado y agregado: ${puntoNumero}`);
            }
          }
        }
      }
    }

    console.log(`[ASSA] Total de puntos a procesar: ${puntos.length}`);
    
    if (puntos.length === 0) {
      console.log('[ASSA] No hay puntos de suministro en la base de datos para procesar');
      await browser.close();
      return [];
    }

    // Paso 6: Para cada punto, obtener facturas vigentes
    const facturas = [];
    
    for (const punto of puntos) {
      try {
        console.log(`[ASSA] Procesando punto ${punto.value}...`);
        
        // Seleccionar el punto
        if (tagName === 'select') {
          await puntoSelect.selectOption(punto.value);
        } else {
          // Para elementos personalizados, hacer click y seleccionar
          await puntoSelect.click();
          await page.waitForTimeout(500);
          // Buscar y hacer click en la opción que contiene el punto
          const optionToClick = await page.$(`text=/^${punto.value}/`);
          if (optionToClick) {
            await optionToClick.click();
          } else {
            // Intentar escribir el número de punto si es un input
            await puntoSelect.fill(punto.value);
            await page.keyboard.press('Enter');
          }
        }
        
        // Esperar a que carguen las facturas vigentes
        await page.waitForTimeout(3000);
        
        // Buscar la sección "Facturas vigentes" y la tarjeta de factura
        // Según la captura, hay una tarjeta con los datos
        console.log(`[ASSA] Buscando facturas para punto ${punto.value}...`);
        
        // Buscar elementos que contengan "Facturas vigentes" o la tarjeta de factura
        const facturaSelectors = [
          'div:has-text("Facturas vigentes")',
          'h2:has-text("Facturas vigentes")',
          'h3:has-text("Facturas vigentes")',
          '.factura',
          '[class*="factura"]',
          '[id*="factura"]',
          'div[class*="card"]',
          'div[class*="tarjeta"]'
        ];
        
        let facturaContainer = null;
        for (const selector of facturaSelectors) {
          try {
            const elements = await page.$$(selector);
            for (const elem of elements) {
              const visible = await elem.isVisible();
              if (visible) {
                facturaContainer = elem;
                break;
              }
            }
            if (facturaContainer) break;
          } catch (e) {
            continue;
          }
        }
        
        // Si no encontramos contenedor específico, buscar en toda la página
        if (!facturaContainer) {
          facturaContainer = page;
        }
        
        // Buscar el texto completo de la factura según el formato de la captura:
        // "Cuota 2 | 0200-52511753" (referencia)
        // "$ 20381,93" (importe)
        // "Fec. Venc.: 12/02/2026" (vencimiento)
        
        // Esperar a que aparezca el texto "Facturas vigentes" o algún elemento de factura
        try {
          await page.waitForSelector('text=/Facturas vigentes|Cuota|Fec\.?\s*Venc/i', { timeout: 5000 });
        } catch (e) {
          console.log(`[ASSA] No se encontró texto de facturas, continuando...`);
        }
        
        await page.waitForTimeout(1000);
        
        const pageText = await facturaContainer.textContent();
        console.log(`[ASSA] Texto de la página para punto ${punto.value} (primeros 500 chars):`, pageText.substring(0, 500));
        
        // Buscar importe - puede estar en diferentes formatos:
        // "$ 20381,93" o "$20381,93" o "20381,93" (sin $)
        // También puede estar pegado a la fecha: "20381,9312/02/2026"
        // Buscar números con coma decimal que pueden tener puntos de miles
        let importeMatch = pageText.match(/(?:\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/);
        
        // Si no encuentra con el patrón anterior, buscar números seguidos de coma y dos dígitos
        // Especialmente cuando está pegado a la fecha: "20381,9312/02/2026"
        if (!importeMatch) {
          // Buscar patrón: número grande seguido de coma y dos dígitos (puede estar pegado a fecha)
          const importeMatch2 = pageText.match(/(\d{4,},\d{2})(?=\d{2}\/\d{2}\/\d{4}|PAGAR|$)/);
          if (importeMatch2) {
            importeMatch = { 1: importeMatch2[1] };
            console.log(`[ASSA] Importe encontrado con patrón alternativo: ${importeMatch2[1]}`);
          }
        }
        
        // Buscar fecha de vencimiento (formato: Fec. Venc.: 12/02/2026 o 12/02/2026)
        // Puede estar pegado al importe: "20381,9312/02/2026"
        const fechaMatch = pageText.match(/(?:Fec\.?\s*Venc\.?:?\s*)?(\d{2}\/\d{2}\/\d{4})/);
        
        // Buscar referencia (formato: Cuota X | 0200-52511753 o similar)
        // Puede ser "Cuota 2 | 0200-52511753" o solo "0200-52511753"
        const referenciaMatch = pageText.match(/(?:Cuota\s+\d+\s*\|\s*)?([\d-]+)/);
        
        if (importeMatch || fechaMatch) {
          // Parsear importe (remover puntos de miles, convertir coma a punto)
          let importe = 0;
          if (importeMatch && importeMatch[1]) {
            const importeStr = importeMatch[1].replace(/\./g, '').replace(',', '.');
            importe = parseFloat(importeStr) || 0;
            console.log(`[ASSA] Importe parseado: "${importeMatch[1]}" -> ${importe}`);
          } else {
            console.log(`[ASSA] No se encontró importe en el texto`);
          }
          
          // Parsear fecha
          let vencimiento = null;
          if (fechaMatch) {
            const [dia, mes, anio] = fechaMatch[1].split('/');
            vencimiento = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
          }
          
          // Verificar si la factura está dentro del período (si se proporcionó)
          if (inicioPeriodo && finPeriodo && vencimiento) {
            if (vencimiento < inicioPeriodo || vencimiento >= finPeriodo) {
              console.log(`[ASSA] Factura para punto ${punto.value} fuera del período: Vencimiento ${fechaMatch[1]} no está entre ${inicioPeriodo.toLocaleDateString('es-AR')} y ${finPeriodo.toLocaleDateString('es-AR')}`);
              continue; // No agregar esta factura
            }
          }
          
          // Referencia - tomar el número después del | o el patrón de números con guiones
          let referencia = `Punto ${punto.value}`;
          if (referenciaMatch) {
            referencia = referenciaMatch[1] || referenciaMatch[0];
            // Si hay "Cuota X |" antes, incluirlo
            const cuotaMatch = pageText.match(/Cuota\s+(\d+)\s*\|\s*([\d-]+)/);
            if (cuotaMatch) {
              referencia = `Cuota ${cuotaMatch[1]} | ${cuotaMatch[2]}`;
            }
          }
          
          facturas.push({
            punto: punto.value,
            importe: importe,
            vencimiento: vencimiento,
            referencia: referencia
          });
          
          console.log(`[ASSA] ✓ Factura VÁLIDA encontrada para punto ${punto.value}: $${importe}, vencimiento ${vencimiento ? fechaMatch[1] : 'N/A'}, referencia: ${referencia}`);
        } else {
          console.log(`[ASSA] No se encontraron facturas para punto ${punto.value}`);
          console.log(`[ASSA] Texto disponible:`, pageText.substring(0, 1000));
        }
        
      } catch (e) {
        console.error(`[ASSA] Error al procesar punto ${punto.value}:`, e.message);
        // Continuar con el siguiente punto
      }
    }

    await browser.close();
    
    console.log(`[ASSA] Scraping completado. ${facturas.length} facturas encontradas.`);
    return facturas;
    
  } catch (error) {
    await browser.close();
    console.error('[ASSA] Error en scraping:', error);
    throw error;
  }
}
