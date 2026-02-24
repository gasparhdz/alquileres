import { chromium } from 'playwright';

/**
 * Normaliza un número de cliente para matching (quita ceros a la izquierda y espacios)
 * @param {string} nroCliente - Número de cliente a normalizar
 * @returns {string} - Número normalizado
 */
function normalizarNroCliente(nroCliente) {
  if (!nroCliente) return '';
  return nroCliente.toString().trim().replace(/^0+/, '');
}

/**
 * Scraper para obtener facturas y cuotas de EPE (Empresa Provincial de la Energía)
 * 
 * @param {string} usuario - Usuario/email de la oficina virtual
 * @param {string} password - Contraseña de la oficina virtual
 * @param {Date} inicioPeriodo - Fecha de inicio del período (día 1 del mes, 00:00)
 * @param {Date} finPeriodo - Fecha de fin del período (día 1 del mes siguiente, 00:00, excluyente)
 * @param {Array<string>} nroClientesFiltrar - Array de números de cliente normalizados a procesar (opcional)
 * @returns {Promise<Array<{nroCliente: string, cuotaNro: number, vencimiento: Date, importe: number, refExterna: string}>>}
 */
export async function scrapeEpeFacturas(usuario, password, inicioPeriodo, finPeriodo, nroClientesFiltrar = null) {
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
    // Paso 1: Ir a la página de login de EPE
    console.log('[EPE] Navegando a página de login...');
    await page.goto('https://www.epe.santafe.gov.ar/oficina-virtual/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Esperar un poco más para que cargue completamente
    await page.waitForTimeout(3000);
    
    // Verificar que la página cargó correctamente
    const pageTitle = await page.title();
    console.log(`[EPE] Título de la página: ${pageTitle}`);

    // Paso 2: Completar usuario y password
    console.log('[EPE] Completando credenciales...');
    
    // Buscar campos de forma más flexible
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
            console.log(`[EPE] Campo de usuario encontrado: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // Continuar con el siguiente selector
        continue;
      }
    }
    
    // Si no encontramos con selectores específicos, buscar cualquier input de texto visible
    if (!usuarioField) {
      console.log('[EPE] Buscando campo de usuario de forma alternativa...');
      const allInputs = await page.$$('input[type="text"], input[type="email"]');
      for (const input of allInputs) {
        try {
          const visible = await input.isVisible();
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          
          if (visible && (type === 'text' || type === 'email')) {
            // Verificar que no sea un campo de búsqueda u otro tipo
            if (!name?.toLowerCase().includes('search') && !id?.toLowerCase().includes('search')) {
              usuarioField = input;
              console.log(`[EPE] Campo de usuario encontrado alternativamente: name="${name}", id="${id}"`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!usuarioField) {
      // Tomar screenshot para debugging
      await page.screenshot({ path: 'epe-debug-login.png', fullPage: true });
      throw new Error('No se pudo encontrar el campo de usuario. Screenshot guardado en epe-debug-login.png');
    }

    // Completar usuario
    await usuarioField.fill(usuario);
    
    // Buscar campo de password
    await page.waitForTimeout(500);
    let passwordField = await page.$('input[type="password"]');
    
    if (!passwordField) {
      // Intentar buscar de forma alternativa
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
              console.log(`[EPE] Campo de contraseña encontrado: ${selector}`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!passwordField) {
      await page.screenshot({ path: 'epe-debug-password.png', fullPage: true });
      throw new Error('No se pudo encontrar el campo de contraseña. Screenshot guardado en epe-debug-password.png');
    }

    // Completar password
    await passwordField.fill(password);

    // Paso 3: Click en "Iniciar sesión"
    console.log('[EPE] Haciendo click en Iniciar sesión...');
    const loginSelectors = [
      'button:has-text("Iniciar sesión")',
      'button:has-text("Iniciar")',
      'input[type="submit"][value*="Iniciar"]',
      'button[type="submit"]',
      'a:has-text("Iniciar sesión")'
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
        // Continuar
      }
    }
    
    if (!clicked) {
      // Intentar presionar Enter
      await page.keyboard.press('Enter');
    }

    // Paso 4: Esperar a que cargue la sesión
    console.log('[EPE] Esperando carga de sesión...');
    await page.waitForTimeout(3000);
    
    // Verificar que se inició sesión (buscar elementos de la oficina virtual)
    try {
      await page.waitForSelector('text=/Mis Suministros|Autogestión|Reimpresión/i', { timeout: 15000 });
    } catch (e) {
      throw new Error('No se pudo verificar el inicio de sesión. Verifique las credenciales.');
    }

    // Paso 5: Ir directamente a "Reimpresión de facturas"
    console.log('[EPE] Navegando a Reimpresión de facturas...');
    
    // Buscar el botón/card de "Reimpresión de facturas"
    const reimpresionSelectors = [
      'ion-col.card-reimpresion-facturas',
      '.card-reimpresion-facturas',
      'ion-col:has-text("REIMPRESIÓN DE FACTURAS")',
      'ion-col:has-text("Reimpresión")',
      'div.card-reimpresion-facturas',
      '[class*="reimpresion-facturas"]'
    ];
    
    let reimpresionCard = null;
    for (const selector of reimpresionSelectors) {
      try {
        reimpresionCard = await page.$(selector);
        if (reimpresionCard) {
          const visible = await reimpresionCard.isVisible();
          if (visible) {
            console.log(`[EPE] Card de Reimpresión encontrado: ${selector}`);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Si no encontramos con selectores específicos, buscar por texto
    if (!reimpresionCard) {
      const allCols = await page.$$('ion-col');
      for (const col of allCols) {
        try {
          const visible = await col.isVisible();
          if (!visible) continue;
          
          const text = await col.textContent();
          if (text && text.toUpperCase().includes('REIMPRESIÓN')) {
            reimpresionCard = col;
            console.log(`[EPE] Card de Reimpresión encontrado por texto`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!reimpresionCard) {
      throw new Error('No se pudo encontrar el card de "Reimpresión de facturas"');
    }
    
    await reimpresionCard.click();
    await page.waitForTimeout(5000); // Esperar a que cargue completamente la página de reimpresión
    
    // Esperar a que aparezca algún contenido de la página de reimpresión
    try {
      await page.waitForSelector('ion-card, ion-grid, .factura', { timeout: 10000 });
      console.log('[EPE] Página de reimpresión cargada');
    } catch (e) {
      console.log('[EPE] Advertencia: No se detectó contenido de facturas, continuando...');
    }

    // Paso 6: Obtener lista de suministros desde el selector en la página de reimpresión
    console.log('[EPE] Obteniendo lista de suministros desde Reimpresión de facturas...');
    
    // Esperar un poco más para que cargue el selector
    await page.waitForTimeout(3000);
    
    // Buscar el div clickeable .mis-suministros dentro de app-selector-mis-suministros
    // El selector está dentro de ion-row.logo-epe-row > ion-col > app-selector-mis-suministros > div.mis-suministros
    const selectorComponentSelectors = [
      'div.mis-suministros', // El div clickeable
      'app-selector-mis-suministros div.mis-suministros',
      'ion-row.logo-epe-row app-selector-mis-suministros div.mis-suministros',
      'app-selector-mis-suministros',
      '.mis-suministros',
      '[class*="mis-suministros"]'
    ];
    
    let selectorComponent = null;
    for (const selector of selectorComponentSelectors) {
      try {
        // Intentar esperar a que el elemento esté presente
        await page.waitForSelector(selector, { timeout: 5000, state: 'attached' }).catch(() => {});
        const elements = await page.$$(selector);
        for (const elem of elements) {
          try {
            // Verificar visibilidad de forma más flexible
            const boundingBox = await elem.boundingBox();
            if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) {
              selectorComponent = elem;
              console.log(`[EPE] Componente de selector encontrado: ${selector}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
        if (selectorComponent) break;
      } catch (e) {
        continue;
      }
    }
    
    // Si no encontramos con selectores específicos, buscar en toda la página
    if (!selectorComponent) {
      console.log('[EPE] Buscando selector de forma alternativa...');
      const allElements = await page.$$('app-selector-mis-suministros, div.mis-suministros, [class*="suministro"]');
      for (const elem of allElements) {
        try {
          const boundingBox = await elem.boundingBox();
          if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) {
            // Si es app-selector-mis-suministros, buscar el div.mis-suministros dentro
            const tagName = await elem.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'app-selector-mis-suministros') {
              const innerDiv = await elem.$('div.mis-suministros');
              if (innerDiv) {
                const innerBox = await innerDiv.boundingBox();
                if (innerBox && innerBox.width > 0 && innerBox.height > 0) {
                  selectorComponent = innerDiv;
                  console.log('[EPE] Selector encontrado (div.mis-suministros dentro de app-selector-mis-suministros)');
                  break;
                }
              }
            } else {
              selectorComponent = elem;
              console.log('[EPE] Selector encontrado de forma alternativa');
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    if (!selectorComponent) {
      // Tomar screenshot para debugging
      await page.screenshot({ path: 'epe-debug-reimpresion.png', fullPage: true });
      throw new Error('No se pudo encontrar el componente de "Mis Suministros" en la página de reimpresión. Screenshot guardado en epe-debug-reimpresion.png');
    }

    // Hacer scroll hasta el elemento si es necesario
    await selectorComponent.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Hacer click para abrir el dropdown usando coordenadas
    console.log('[EPE] Abriendo selector de suministros...');
    try {
      const box = await selectorComponent.boundingBox();
      if (box) {
        // Hacer click en el centro del elemento
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        console.log('[EPE] Click realizado usando coordenadas');
      } else {
        // Fallback: intentar click normal
        await selectorComponent.click({ timeout: 10000 });
      }
    } catch (e) {
      // Si falla, intentar con el método evaluate
      await selectorComponent.evaluate(el => el.click());
      console.log('[EPE] Click realizado usando evaluate');
    }
    await page.waitForTimeout(2000); // Esperar a que se abra el dropdown
    
    // Buscar la lista de suministros en el dropdown abierto
    const listaSuministrosSelectors = [
      '.lista-suministros',
      '.lista-suministros-item',
      'ion-item.item-list'
    ];
    
    let listaSuministros = null;
    for (const selector of listaSuministrosSelectors) {
      try {
        listaSuministros = await page.$(selector);
        if (listaSuministros) {
          const visible = await listaSuministros.isVisible();
          if (visible) {
            console.log(`[EPE] Lista de suministros encontrada: ${selector}`);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Si no encontramos el contenedor, buscar directamente los items
    let suministroItems = [];
    if (listaSuministros) {
      suministroItems = await listaSuministros.$$('ion-item.item-list');
    } else {
      // Buscar directamente todos los items de suministros
      suministroItems = await page.$$('ion-item.item-list');
    }
    
    console.log(`[EPE] Encontrados ${suministroItems.length} items de suministros`);
    
    // Extraer información de cada suministro (solo los que están en el filtro)
    const suministros = [];
    for (const item of suministroItems) {
      try {
        const visible = await item.isVisible();
        if (!visible) continue;
        
        // Obtener el texto del label
        const label = await item.$('ion-label');
        if (!label) continue;
        
        const text = await label.textContent();
        
        // Extraer número de cliente del texto: "hernandez gaspar (1752960)"
        const nroClienteMatch = text.match(/\((\d+)\)/);
        if (nroClienteMatch) {
          const nroCliente = normalizarNroCliente(nroClienteMatch[1]);
          
          // Si hay filtro, solo agregar si está en la lista
          if (nroClientesFiltrar && nroClientesFiltrar.length > 0) {
            if (!nroClientesFiltrar.includes(nroCliente)) {
              console.log(`[EPE] Suministro ${nroCliente} omitido (no está en la base de datos)`);
              continue; // NO agregar este suministro
            }
          }
          
          // Solo agregar si pasó el filtro (o si no hay filtro)
          suministros.push({
            nroCliente: nroCliente,
            item: item,
            text: text.trim()
          });
          console.log(`[EPE] Suministro encontrado y agregado: ${nroCliente} - ${text.trim()}`);
        }
      } catch (e) {
        console.log(`[EPE] Error al procesar item de suministro: ${e.message}`);
        continue;
      }
    }

    console.log(`[EPE] Total de suministros a procesar: ${suministros.length}`);
    
    if (suministros.length === 0) {
      console.log('[EPE] No hay suministros en la base de datos para procesar');
      await browser.close();
      return [];
    }

    // Paso 7: Para cada suministro, obtener facturas y cuotas
    const cuotas = [];
    
    for (const suministro of suministros) {
      try {
        console.log(`[EPE] Procesando suministro ${suministro.nroCliente}...`);
        
        // Abrir el selector de suministros si está cerrado
        const dropdownAbierto = await page.$('.lista-suministros.expandable');
        if (!dropdownAbierto) {
          console.log('[EPE] Abriendo selector de suministros...');
          const selector = await page.$('app-selector-mis-suministros, .mis-suministros');
          if (selector) {
            await selector.click();
            await page.waitForTimeout(2000);
          }
        }
        
        // Buscar el item por el número de cliente (siempre buscar de nuevo para evitar elementos desvinculados)
        // Esperar a que el dropdown esté visible
        try {
          await page.waitForSelector('.lista-suministros.expandable', { timeout: 5000, state: 'visible' });
        } catch (e) {
          console.log(`[EPE] El dropdown no está visible para suministro ${suministro.nroCliente}`);
        }
        
        const items = await page.$$('ion-item.item-list');
        let itemEncontrado = null;
        
        for (const item of items) {
          try {
            // Verificar visibilidad de forma más robusta
            const boundingBox = await item.boundingBox();
            if (!boundingBox) continue;
            
            const label = await item.$('ion-label');
            if (!label) continue;
            
            const text = await label.textContent();
            if (text && text.includes(`(${suministro.nroCliente})`)) {
              itemEncontrado = item;
              break;
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!itemEncontrado) {
          console.log(`[EPE] No se encontró el item para suministro ${suministro.nroCliente}`);
          continue;
        }
        
        // Hacer click en el item para seleccionarlo usando coordenadas si es necesario
        try {
          await itemEncontrado.click({ timeout: 10000 });
        } catch (e) {
          // Si falla el click normal, intentar con coordenadas
          const box = await itemEncontrado.boundingBox();
          if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          } else {
            throw e;
          }
        }
        await page.waitForTimeout(3000); // Esperar a que cargue el suministro seleccionado y las facturas
        
        // Buscar tarjetas de facturas
        console.log(`[EPE] Buscando facturas para suministro ${suministro.nroCliente}...`);
        
        // Esperar a que carguen las facturas
        await page.waitForTimeout(3000);
        
        // Buscar los ion-card que contienen las facturas (pueden estar dentro de ion-col)
        // Buscar todas las columnas y luego los cards dentro de ellas
        const facturaCols = await page.$$('ion-col');
        console.log(`[EPE] Encontradas ${facturaCols.length} columnas en total`);
        
        let facturaCards = [];
        for (const col of facturaCols) {
          const card = await col.$('ion-card');
          if (card) {
            facturaCards.push(card);
          }
        }
        
        // Si no encontramos cards en columnas, buscar directamente
        if (facturaCards.length === 0) {
          facturaCards = await page.$$('ion-card');
        }
        
        console.log(`[EPE] Total de cards de facturas encontradas: ${facturaCards.length}`);
        console.log(`[EPE] Período objetivo: ${inicioPeriodo.toLocaleDateString('es-AR')} a ${finPeriodo.toLocaleDateString('es-AR')}`);
        console.log(`[EPE] Navegando entre todas las cards para encontrar cuotas en el período...`);
        
        // Procesar cada card de factura - DETENER cuando encontremos una cuota válida
        const cuotasEncontradas = [];
        let encontroCuotaValida = false;
        
        for (let i = 0; i < facturaCards.length && !encontroCuotaValida; i++) {
          const card = facturaCards[i];
          try {
            // Intentar hacer scroll hasta el card (opcional, si falla continuamos igual)
            try {
              await card.scrollIntoViewIfNeeded({ timeout: 2000 });
              await page.waitForTimeout(100);
            } catch (scrollError) {
              // Si el scroll falla, continuamos igual - el card puede estar visible de otra forma
              console.log(`[EPE] Card ${i + 1}: No se pudo hacer scroll, continuando...`);
            }
            
            // Verificar visibilidad de forma más flexible
            const visible = await card.isVisible().catch(() => false);
            const boundingBox = await card.boundingBox().catch(() => null);
            
            if (!visible && !boundingBox) {
              console.log(`[EPE] Card ${i + 1} no visible, continuando...`);
              continue;
            }
            
            // Obtener número de factura
            const facturaElement = await card.$('.factura .itemData.destacado');
            const nroFactura = facturaElement ? (await facturaElement.textContent()).trim() : null;
            
            console.log(`[EPE] Procesando card ${i + 1}/${facturaCards.length}${nroFactura ? ` - Factura ${nroFactura}` : ''}`);
            
            // Buscar todas las cuotas en este card
            const detalleCuotas = await card.$$('.detalle-cuota');
            console.log(`[EPE] Card ${i + 1}: Revisando ${detalleCuotas.length} cuotas`);
            
            for (const detalleCuota of detalleCuotas) {
              // Si ya encontramos una cuota válida, salir del loop interno
              if (encontroCuotaValida) break;
              try {
                // Obtener el título para determinar el número de cuota
                const fechaVtoElement = await detalleCuota.$('.fecha-vto');
                if (!fechaVtoElement) continue;
                
                const tituloElement = await fechaVtoElement.$('.itemTitle');
                const titulo = tituloElement ? (await tituloElement.textContent()).trim() : '';
                
                // Extraer número de cuota del título: "VTO. CUOTA 1" o "VTO. CUOTA 2"
                const cuotaMatch = titulo.match(/CUOTA\s+(\d+)/i);
                if (!cuotaMatch) continue;
                
                const cuotaNro = parseInt(cuotaMatch[1]);
                
                // Obtener fecha de vencimiento
                const fechaElement = await fechaVtoElement.$('.itemData');
                if (!fechaElement) continue;
                
                const fechaStr = (await fechaElement.textContent()).trim();
                console.log(`[EPE] Fecha encontrada: ${fechaStr} para Cuota ${cuotaNro}`);
                
                // Parsear fecha (formato: dd/MM/yyyy)
                const [dia, mes, anio] = fechaStr.split('/');
                if (!dia || !mes || !anio) {
                  console.log(`[EPE] Error al parsear fecha: ${fechaStr}`);
                  continue;
                }
                
                const vencimiento = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
                
                // Verificar que la fecha sea válida
                if (isNaN(vencimiento.getTime())) {
                  console.log(`[EPE] Fecha inválida: ${fechaStr}`);
                  continue;
                }
                
                // Obtener importe
                const importeVtoElement = await detalleCuota.$('.importe-vto .itemData');
                if (!importeVtoElement) continue;
                
                const importeStr = (await importeVtoElement.textContent()).trim();
                // Limpiar importe: quitar $, espacios, puntos (miles) y convertir coma a punto
                // Parsear importe: "$49.322,37" o "$49322.37" o "$49322,37"
                let importeClean = importeStr.replace(/[$\s]/g, '');
                
                // Si tiene coma, es formato europeo (punto = miles, coma = decimal)
                if (importeClean.includes(',')) {
                  // Formato: "49.322,37" -> eliminar puntos (miles), reemplazar coma por punto
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
                
                // Verificar si la cuota está dentro del período
                if (vencimiento >= inicioPeriodo && vencimiento < finPeriodo) {
                  cuotasEncontradas.push({
                    cuotaNro,
                    vencimiento,
                    importe,
                    nroFactura
                  });
                  encontroCuotaValida = true; // Marcar que encontramos una cuota válida
                  console.log(`[EPE] ✓ Cuota VÁLIDA encontrada: Factura ${nroFactura}, Cuota ${cuotaNro}, Vencimiento ${fechaStr}, Importe $${importe}`);
                  console.log(`[EPE] Deteniendo búsqueda - cuota encontrada en card ${i + 1}`);
                  break; // Salir del loop de cuotas
                } else {
                  console.log(`[EPE] Card ${i + 1}, Cuota ${cuotaNro}: Vencimiento ${fechaStr} fuera del período`);
                }
              } catch (e) {
                console.log(`[EPE] Error al procesar detalle de cuota: ${e.message}`);
                continue;
              }
            }
          } catch (e) {
            console.log(`[EPE] Error al procesar card de factura: ${e.message}`);
            continue;
          }
        }
        
        // Si encontramos cuotas válidas, usar la primera encontrada (ya no necesitamos ordenar porque paramos en la primera)
        if (cuotasEncontradas.length > 0) {
          const cuotaSeleccionada = cuotasEncontradas[0];
          
          cuotas.push({
            nroCliente: suministro.nroCliente,
            cuotaNro: cuotaSeleccionada.cuotaNro,
            vencimiento: cuotaSeleccionada.vencimiento,
            importe: cuotaSeleccionada.importe,
            refExterna: cuotaSeleccionada.nroFactura ? `Factura ${cuotaSeleccionada.nroFactura} - Cuota ${cuotaSeleccionada.cuotaNro}` : `Cuota ${cuotaSeleccionada.cuotaNro}`
          });
          
          const fechaStr = cuotaSeleccionada.vencimiento.toLocaleDateString('es-AR');
          console.log(`[EPE] Cuota seleccionada para suministro ${suministro.nroCliente}: Cuota ${cuotaSeleccionada.cuotaNro}, vencimiento ${fechaStr}, importe $${cuotaSeleccionada.importe}`);
        } else {
          console.log(`[EPE] No se encontraron cuotas en el período para suministro ${suministro.nroCliente}`);
        }
        
        // Para el siguiente suministro, solo necesitamos cambiar el selector (ya estamos en la página de reimpresión)
        // El dropdown se abrirá nuevamente en la siguiente iteración
        
      } catch (error) {
        console.error(`[EPE] Error al procesar suministro ${suministro.nroCliente}:`, error.message);
        // Continuar con el siguiente suministro
      }
    }

    await browser.close();
    
    console.log(`[EPE] Scraping completado. ${cuotas.length} cuotas encontradas.`);
    return cuotas;
    
  } catch (error) {
    await browser.close();
    console.error('[EPE] Error en scraping:', error);
    throw error;
  }
}
