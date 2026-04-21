import { chromium } from 'playwright';

/**
 * Normaliza un número de cliente para matching (solo dígitos)
 * Ej: "1243521/01" -> "124352101", "0124352101" -> "124352101"
 * @param {string} nroCliente - Número de cliente a normalizar
 * @returns {string} - Número normalizado (solo dígitos)
 */
function normalizarNroCliente(nroCliente) {
  if (!nroCliente) return '';
  // Quitar espacios, barras y cualquier carácter no numérico, luego quitar ceros a la izquierda
  return nroCliente.toString().trim().replace(/[^\d]/g, '').replace(/^0+/, '');
}

/**
 * Scraper para obtener facturas de Litoralgas
 * 
 * @param {string} usuario - Usuario/email de la oficina virtual
 * @param {string} password - Contraseña de la oficina virtual
 * @param {Date} inicioPeriodo - Fecha de inicio del período (día 1 del mes, 00:00)
 * @param {Date} finPeriodo - Fecha de fin del período (día 1 del mes siguiente, 00:00, excluyente)
 * @param {Array<string>} nroClientesFiltrar - Array de números de cliente normalizados a procesar (opcional)
 * @returns {Promise<Array<{nroCliente: string, vencimiento: Date, importe: number, refExterna: string}>>}
 */
export async function scrapeLitoralgasFacturas(usuario, password, inicioPeriodo, finPeriodo, nroClientesFiltrar = null) {
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
    // Paso 1: Ir a la página de login de Litoralgas
    console.log('[Litoralgas] Navegando a página de login...');
    await page.goto('https://www.litoralgas.com.ar/ov/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(2000);

    // Paso 2: Completar usuario y password
    console.log('[Litoralgas] Completando credenciales...');
    
    // Buscar campos de forma flexible
    const usuarioSelectors = [
      'input[name*="usuario"]',
      'input[id*="usuario"]',
      'input[id*="Usuario"]',
      'input[name*="Usuario"]',
      'input[type="email"]',
      'input[type="text"]',
      '#usuario',
      '#Usuario',
      'input[placeholder*="usuario"]',
      'input[placeholder*="Usuario"]',
      'input[placeholder*="email"]'
    ];
    
    let usuarioField = null;
    for (const selector of usuarioSelectors) {
      try {
        usuarioField = await page.$(selector);
        if (usuarioField) {
          const visible = await usuarioField.isVisible();
          if (visible) {
            console.log(`[Litoralgas] Campo de usuario encontrado: ${selector}`);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Si no encontramos con selectores específicos, buscar cualquier input de texto visible
    if (!usuarioField) {
      console.log('[Litoralgas] Buscando campo de usuario de forma alternativa...');
      const allInputs = await page.$$('input[type="text"], input[type="email"]');
      for (const input of allInputs) {
        try {
          const visible = await input.isVisible();
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          
          if (visible && (type === 'text' || type === 'email')) {
            if (!name?.toLowerCase().includes('search') && !id?.toLowerCase().includes('search')) {
              usuarioField = input;
              console.log(`[Litoralgas] Campo de usuario encontrado alternativamente: name="${name}", id="${id}"`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!usuarioField) {
      await page.screenshot({ path: 'litoralgas-debug-login.png', fullPage: true });
      throw new Error('No se pudo encontrar el campo de usuario. Screenshot guardado en litoralgas-debug-login.png');
    }

    await usuarioField.fill(usuario);
    
    // Buscar campo de password
    await page.waitForTimeout(500);
    let passwordField = await page.$('input[type="password"]');
    
    if (!passwordField) {
      const passwordSelectors = [
        'input[type="password"]',
        'input[name*="password"]',
        'input[name*="Password"]',
        'input[id*="password"]',
        'input[id*="Password"]',
        '#password',
        '#Password'
      ];
      
      for (const selector of passwordSelectors) {
        try {
          passwordField = await page.$(selector);
          if (passwordField) {
            const visible = await passwordField.isVisible();
            if (visible) {
              console.log(`[Litoralgas] Campo de contraseña encontrado: ${selector}`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!passwordField) {
      await page.screenshot({ path: 'litoralgas-debug-password.png', fullPage: true });
      throw new Error('No se pudo encontrar el campo de contraseña. Screenshot guardado en litoralgas-debug-password.png');
    }

    await passwordField.fill(password);

    // Paso 3: Click en "Ingresar" o "Iniciar sesión"
    console.log('[Litoralgas] Haciendo click en Ingresar...');
    const loginSelectors = [
      'button:has-text("Ingresar")',
      'button:has-text("Iniciar sesión")',
      'button:has-text("Iniciar")',
      'input[type="submit"][value*="Ingresar"]',
      'button[type="submit"]',
      'a:has-text("Ingresar")'
    ];
    
    let clicked = false;
    for (const selector of loginSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          clicked = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!clicked) {
      await page.keyboard.press('Enter');
    }

    // Paso 4: Esperar a que cargue la sesión
    console.log('[Litoralgas] Esperando carga de sesión...');
    await page.waitForTimeout(3000);
    
    // Verificar que se inició sesión (buscar "Cliente:" o "Facturas y pagos")
    try {
      await page.waitForSelector('text=/Cliente:|Facturas y pagos|Última factura/i', { timeout: 15000 });
      console.log('[Litoralgas] Sesión iniciada correctamente');
    } catch (e) {
      throw new Error('No se pudo verificar el inicio de sesión. Verifique las credenciales.');
    }

    // Paso 5: Obtener lista de suministros/clientes
    console.log('[Litoralgas] Obteniendo lista de suministros...');
    
    const suministros = [];
    
    // Buscar el contenedor del selector de clientes (autocomplete-container)
    const autocompleteContainer = await page.$('.autocomplete-container');
    
    if (autocompleteContainer) {
      // Hacer click para abrir el selector
      console.log('[Litoralgas] Abriendo selector de clientes...');
      await autocompleteContainer.click();
      await page.waitForTimeout(2000);
      
      // Buscar la lista de clientes en el dropdown abierto
      const suggestionsContainer = await page.$('.suggestions-container-contract.is-visible');
      
      if (suggestionsContainer) {
        // Buscar todos los items de la lista
        const items = await suggestionsContainer.$$('li.item');
        console.log(`[Litoralgas] Encontrados ${items.length} items de clientes`);
        
        for (const item of items) {
          try {
            const visible = await item.isVisible();
            if (!visible) continue;
            
            // Obtener el texto del item (contiene "Cliente: 1243521/01")
            const text = await item.textContent();
            
            // Extraer número de cliente del texto: "Cliente: 1243521/01"
            const nroClienteMatch = text.match(/Cliente:\s*(\d+(?:\/\d+)?)/i);
            if (nroClienteMatch) {
              const nroCliente = normalizarNroCliente(nroClienteMatch[1]);
              if (nroCliente) {
                suministros.push({
                  nroCliente: nroCliente,
                  item: item,
                  text: text.trim()
                });
                console.log(`[Litoralgas] Suministro encontrado: ${nroCliente} - ${text.trim()}`);
              }
            }
          } catch (e) {
            console.log(`[Litoralgas] Error al procesar item de cliente: ${e.message}`);
            continue;
          }
        }
      }
    }
    
    // Si no encontramos suministros en el selector, buscar el cliente actual en la página
    if (suministros.length === 0) {
      console.log('[Litoralgas] No se encontraron suministros en el selector, buscando cliente actual...');
      const clienteText = await page.textContent();
      const clienteMatch = clienteText.match(/Cliente:\s*(\d+(?:\/\d+)?)/i);
      if (clienteMatch) {
        const nroCliente = normalizarNroCliente(clienteMatch[1]);
        suministros.push({
          nroCliente: nroCliente,
          item: null,
          text: `Cliente: ${clienteMatch[1]}`
        });
        console.log(`[Litoralgas] Cliente actual encontrado: ${nroCliente}`);
      }
    }
    
    // Filtrar suministros si hay filtro (holgado: nroCliente puede venir como string u objeto)
    let suministrosAFiltrar = suministros;
    if (nroClientesFiltrar && nroClientesFiltrar.length > 0) {
      const filtrosNorm = nroClientesFiltrar.map((n) =>
        normalizarNroCliente(n?.normalizado != null ? n.normalizado : n)
      );
      suministrosAFiltrar = suministros.filter((s) =>
        filtrosNorm.some((f) => (s.nroCliente && (s.nroCliente.includes(f) || f.includes(s.nroCliente))))
      );
    }

    console.log(`[Litoralgas] Total de suministros a procesar: ${suministrosAFiltrar.length}`);
    
    if (suministrosAFiltrar.length === 0) {
      console.log('[Litoralgas] No hay suministros para procesar');
      await browser.close();
      return [];
    }

    // Paso 6: Para cada suministro, obtener facturas
    const facturas = [];
    
    for (const suministro of suministrosAFiltrar) {
      try {
        console.log(`[Litoralgas] Procesando suministro ${suministro.nroCliente}...`);
        
        // Si hay item en el selector, hacer click para seleccionarlo
        if (suministro.item) {
          // Abrir el selector si está cerrado
          const autocompleteContainer = await page.$('.autocomplete-container');
          if (autocompleteContainer) {
            await autocompleteContainer.click();
            await page.waitForTimeout(1500);
          }
          
          // Buscar el item nuevamente (puede haberse desvinculado)
          const suggestionsContainer = await page.$('.suggestions-container-contract.is-visible');
          if (suggestionsContainer) {
            const items = await suggestionsContainer.$$('li.item');
            for (const item of items) {
              const text = await item.textContent();
              if (text && text.includes(`Cliente: ${suministro.nroCliente}`) || text.includes(`Cliente: ${suministro.text.match(/Cliente:\s*(\d+(?:\/\d+)?)/i)?.[1]}`)) {
                await item.click();
                await page.waitForTimeout(2000);
                break;
              }
            }
          }
        }
        
        // Intentar ir a "Mis facturas" si existe
        let facturaEncontrada = null;
        const misFacturasSelectors = [
          'a:has-text("Mis facturas")',
          'a:has-text("Facturas")',
          'button:has-text("Mis facturas")',
          'a[href*="factura"]',
          'a[href*="Factura"]'
        ];
        
        let misFacturasLink = null;
        for (const selector of misFacturasSelectors) {
          try {
            misFacturasLink = await page.$(selector);
            if (misFacturasLink) {
              const visible = await misFacturasLink.isVisible();
              if (visible) {
                console.log(`[Litoralgas] Encontrado enlace a Mis facturas para suministro ${suministro.nroCliente}`);
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        if (misFacturasLink) {
          // Ir a Mis facturas y buscar en el listado
          await misFacturasLink.click();
          await page.waitForTimeout(3000);
          
          // Buscar facturas en el listado
          const facturaCards = await page.$$('div[class*="factura"], div[class*="card"], table tr');
          console.log(`[Litoralgas] Encontradas ${facturaCards.length} facturas en listado`);
          
          for (const card of facturaCards) {
            try {
              const text = await card.textContent();
              
              // Buscar fecha de vencimiento en el texto
              const fechaMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
              if (fechaMatch) {
                const fechaStr = fechaMatch[1];
                const [dia, mes, anio] = fechaStr.split('/');
                const vencimiento = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                
                // Verificar si está en el período
                if (vencimiento >= inicioPeriodo && vencimiento < finPeriodo) {
                  // Buscar importe
                  const importeMatch = text.match(/\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/);
                  let importe = 0;
                  if (importeMatch) {
                    const importeStr = importeMatch[1].replace(/\./g, '').replace(',', '.');
                    importe = parseFloat(importeStr) || 0;
                  }
                  
                  // Buscar número de factura
                  const facturaMatch = text.match(/Factura\s*[N°nº#:]*\s*(\d+)/i);
                  const nroFactura = facturaMatch ? facturaMatch[1] : null;
                  
                  facturaEncontrada = {
                    vencimiento,
                    importe,
                    refExterna: nroFactura ? `Factura ${nroFactura}` : 'Factura'
                  };
                  
                  console.log(`[Litoralgas] Factura encontrada en listado: Vencimiento ${fechaStr}, Importe $${importe}`);
                  break; // Tomar la primera que encuentre en el período
                }
              }
            } catch (e) {
              continue;
            }
          }
          
          // Volver atrás si es necesario
          try {
            await page.goBack();
            await page.waitForTimeout(2000);
          } catch (e) {
            // Continuar
          }
        }
        
        // Si no encontramos en Mis facturas, usar "Última factura" desde el widget
        if (!facturaEncontrada) {
          console.log(`[Litoralgas] Buscando Última factura para suministro ${suministro.nroCliente}...`);
          
          // Volver a la página principal si estamos en Mis facturas
          try {
            const currentUrl = page.url();
            if (currentUrl.includes('factura') || currentUrl.includes('Factura')) {
              console.log(`[Litoralgas] Volviendo a página principal desde: ${currentUrl}`);
              await page.goBack();
              await page.waitForTimeout(3000);
              // Esperar a que el widget esté visible
              await page.waitForSelector('widget-ultima-factura', { timeout: 5000 }).catch(() => {
                console.log(`[Litoralgas] Widget no encontrado después de volver atrás`);
              });
            }
          } catch (e) {
            console.log(`[Litoralgas] Error al volver atrás: ${e.message}`);
          }
          
          // Buscar el widget de última factura
          const ultimaFacturaWidget = await page.$('widget-ultima-factura');
          
          if (!ultimaFacturaWidget) {
            console.log(`[Litoralgas] Widget de última factura no encontrado en la página`);
          }
          
          if (ultimaFacturaWidget) {
            try {
              // Buscar el mat-card dentro del widget
              const matCard = await ultimaFacturaWidget.$('mat-card.sdl-card-widget');
              const cardToUse = matCard || ultimaFacturaWidget;
              
              // Buscar específicamente el h4 con clase subtitleContratoVigencia que contiene el importe
              // Según el HTML: <h4 class="subtitleContratoVigencia">$1868.1</h4>
              const importeElement = await cardToUse.$('h4.subtitleContratoVigencia');
              let importeStr = null;
              
              if (importeElement) {
                const text = await importeElement.textContent();
                // Verificar que realmente sea un importe (tiene $ seguido de números)
                if (text && /^\s*\$\s*\d+/.test(text.trim())) {
                  importeStr = text.trim();
                  console.log(`[Litoralgas] Importe encontrado en h4.subtitleContratoVigencia: ${importeStr}`);
                } else {
                  console.log(`[Litoralgas] Elemento h4.subtitleContratoVigencia encontrado pero no contiene importe válido: "${text}"`);
                }
              } else {
                // Fallback: buscar cualquier h4 que tenga un importe válido
                const allH4 = await cardToUse.$$('h4');
                for (const h4 of allH4) {
                  const text = await h4.textContent();
                  // Buscar el que tiene el importe (debe tener $ seguido de números)
                  if (text && /^\s*\$\s*\d+/.test(text.trim())) {
                    importeStr = text.trim();
                    console.log(`[Litoralgas] Importe encontrado (fallback): ${importeStr}`);
                    break;
                  }
                }
              }
              
              // Buscar específicamente el h2 con clase subtitleFactSub que contiene el vencimiento
              // Según el HTML: <h2 class="subtitleFactSub"> VENCIMIENTO 15/01/2026 </h2>
              const vencimientoElement = await cardToUse.$('h2.subtitleFactSub');
              let vencimientoStr = null;
              
              if (vencimientoElement) {
                const text = await vencimientoElement.textContent();
                // Verificar que tenga una fecha
                if (text && /\d{2}\/\d{2}\/\d{4}/.test(text)) {
                  vencimientoStr = text.trim();
                  console.log(`[Litoralgas] Vencimiento encontrado en h2.subtitleFactSub: ${vencimientoStr}`);
                } else {
                  console.log(`[Litoralgas] Elemento h2.subtitleFactSub encontrado pero no contiene fecha válida: "${text}"`);
                }
              } else {
                // Fallback: buscar cualquier h2 que tenga una fecha
                const allH2 = await cardToUse.$$('h2');
                for (const h2 of allH2) {
                  const text = await h2.textContent();
                  // Buscar el que tiene una fecha (formato dd/MM/yyyy)
                  if (text && /\d{2}\/\d{2}\/\d{4}/.test(text)) {
                    vencimientoStr = text.trim();
                    console.log(`[Litoralgas] Vencimiento encontrado (fallback): ${vencimientoStr}`);
                    break;
                  }
                }
              }
              
              console.log(`[Litoralgas] Widget encontrado - Importe: ${importeStr}, Vencimiento: ${vencimientoStr}`);
              
              if (importeStr && vencimientoStr) {
                // Extraer fecha de vencimiento: "VENCIMIENTO 15/01/2026"
                const fechaMatch = vencimientoStr.match(/(\d{2}\/\d{2}\/\d{4})/);
                if (fechaMatch) {
                  const fechaStr = fechaMatch[1];
                  const [dia, mes, anio] = fechaStr.split('/');
                  const vencimiento = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                  
                  // Verificar si está en el período
                  if (vencimiento >= inicioPeriodo && vencimiento < finPeriodo) {
                    // Parsear importe: "$1868.1" o "$1.868,10" o "$1868,10"
                    let importeClean = importeStr.replace(/[$\s]/g, '');
                    
                    // Si tiene coma, es formato europeo (punto = miles, coma = decimal)
                    if (importeClean.includes(',')) {
                      // Formato: "1.868,10" -> eliminar puntos (miles), reemplazar coma por punto
                      importeClean = importeClean.replace(/\./g, '').replace(',', '.');
                    } else if (importeClean.includes('.')) {
                      // Si tiene punto pero no coma, verificar si es decimal o miles
                      // Si hay más de un punto o el punto está antes de los últimos 3 dígitos, es separador de miles
                      const parts = importeClean.split('.');
                      if (parts.length > 2 || (parts.length === 2 && parts[1].length > 2)) {
                        // Es separador de miles, eliminar puntos
                        importeClean = importeClean.replace(/\./g, '');
                      }
                      // Si es un solo punto con 1-2 dígitos después, es decimal, dejarlo
                    }
                    
                    const importe = parseFloat(importeClean) || 0;
                    
                    if (importe > 0) {
                      facturaEncontrada = {
                        vencimiento,
                        importe,
                        refExterna: 'Última factura'
                      };
                      
                      console.log(`[Litoralgas] ✓ Última factura válida: Vencimiento ${fechaStr}, Importe $${importe}`);
                    } else {
                      console.log(`[Litoralgas] Importe inválido: ${importeStr}`);
                    }
                  } else {
                    console.log(`[Litoralgas] Última factura fuera del período: Vencimiento ${fechaStr}`);
                  }
                }
              } else {
                console.log(`[Litoralgas] No se encontraron importe o vencimiento en el widget`);
                // Log para debugging
                const widgetText = await cardToUse.textContent();
                console.log(`[Litoralgas] Texto completo del widget: ${widgetText.substring(0, 500)}`);
              }
            } catch (e) {
              console.log(`[Litoralgas] Error al leer widget de última factura: ${e.message}`);
            }
          }
          
          // Fallback: buscar en el texto de la página
          if (!facturaEncontrada) {
            try {
              const pageText = await page.evaluate(() => document.body.innerText);
              const ultimaFacturaMatch = pageText.match(/ÚLTIMA\s+FACTURA[\s\S]{0,500}?VENCIMIENTO\s+(\d{2}\/\d{2}\/\d{4})[\s\S]{0,200}?(\$\s*\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d+)/i);
              
              if (ultimaFacturaMatch) {
                const fechaStr = ultimaFacturaMatch[1];
                const importeStr = ultimaFacturaMatch[2];
                
                const [dia, mes, anio] = fechaStr.split('/');
                const vencimiento = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                
                if (vencimiento >= inicioPeriodo && vencimiento < finPeriodo) {
                  // Parsear importe: "$1868.1" o "$1.868,10" o "$1868,10"
                  let importeClean = importeStr.replace(/[$\s]/g, '');
                  
                  // Si tiene coma, es formato europeo (punto = miles, coma = decimal)
                  if (importeClean.includes(',')) {
                    // Formato: "1.868,10" -> eliminar puntos (miles), reemplazar coma por punto
                    importeClean = importeClean.replace(/\./g, '').replace(',', '.');
                  } else if (importeClean.includes('.')) {
                    // Si tiene punto pero no coma, verificar si es decimal o miles
                    // Si hay más de un punto o el punto está antes de los últimos 3 dígitos, es separador de miles
                    const parts = importeClean.split('.');
                    if (parts.length > 2 || (parts.length === 2 && parts[1].length > 2)) {
                      // Es separador de miles, eliminar puntos
                      importeClean = importeClean.replace(/\./g, '');
                    }
                    // Si es un solo punto con 1-2 dígitos después, es decimal, dejarlo
                  }
                  
                  const importe = parseFloat(importeClean) || 0;
                  
                  if (importe > 0) {
                    facturaEncontrada = {
                      vencimiento,
                      importe,
                      refExterna: 'Última factura'
                    };
                    
                    console.log(`[Litoralgas] Última factura válida (fallback): Vencimiento ${fechaStr}, Importe $${importe}`);
                  }
                }
              }
            } catch (e) {
              console.log(`[Litoralgas] Error en fallback de última factura: ${e.message}`);
            }
          }
        }
        
        if (facturaEncontrada) {
          facturas.push({
            nroCliente: suministro.nroCliente,
            ...facturaEncontrada
          });
        } else {
          console.log(`[Litoralgas] No se encontró factura en el período para suministro ${suministro.nroCliente}`);
        }
        
      } catch (error) {
        console.error(`[Litoralgas] Error al procesar suministro ${suministro.nroCliente}:`, error.message);
        continue;
      }
    }

    await browser.close();
    
    console.log(`[Litoralgas] Scraping completado. ${facturas.length} facturas encontradas.`);
    return facturas;
    
  } catch (error) {
    await browser.close();
    console.error('[Litoralgas] Error en scraping:', error);
    throw error;
  }
}
