import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Crear roles
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: 'Administrador' },
    update: {},
    create: {
      nombre: 'Administrador',
      descripcion: 'Acceso total al sistema'
    }
  });

  console.log('✅ Rol Administrador creado');

  // Crear usuario administrador por defecto
  const passwordHash = await bcrypt.hash('admin123', 10);
  const usuario = await prisma.usuario.upsert({
    where: { email: 'admin@alquileres.com' },
    update: {},
    create: {
      nombre: 'Administrador',
      email: 'admin@alquileres.com',
      passwordHash,
      activo: true,
      roles: {
        create: {
          rolId: rolAdmin.id
        }
      }
    }
  });

  console.log('✅ Usuario administrador creado (admin@alquileres.com / admin123)');

  // Crear categorías y parámetros
  const categorias = [
    {
      codigo: 'tipo_unidad',
      descripcion: 'Tipos de Unidad',
      parametros: [
        { codigo: 'casa', descripcion: 'Casa', abreviatura: 'C', orden: 1 },
        { codigo: 'departamento', descripcion: 'Departamento', abreviatura: 'D', orden: 2 },
        { codigo: 'local', descripcion: 'Local Comercial', abreviatura: 'LC', orden: 3 },
        { codigo: 'oficina', descripcion: 'Oficina', abreviatura: 'O', orden: 4 }
      ]
    },
    {
      codigo: 'estado_unidad',
      descripcion: 'Estados de Unidad',
      parametros: [
        { codigo: 'disponible', descripcion: 'Disponible', abreviatura: 'DISP', orden: 1 },
        { codigo: 'alquilada', descripcion: 'Alquilada', abreviatura: 'ALQ', orden: 2 },
        { codigo: 'no_disponible', descripcion: 'No Disponible', abreviatura: 'NO_DISP', orden: 3 },
        { codigo: 'mantenimiento', descripcion: 'En Mantenimiento', abreviatura: 'MANT', orden: 4 }
      ]
    },
    {
      codigo: 'tipo_impuesto',
      descripcion: 'Tipos de Impuestos y Servicios',
      parametros: [
        { codigo: 'tgi', descripcion: 'Tasa General de Inmuebles', abreviatura: 'TGI', orden: 1 },
        { codigo: 'api', descripcion: 'Alumbrado Público e Iluminación', abreviatura: 'API', orden: 2 },
        { codigo: 'agua', descripcion: 'Agua', abreviatura: 'AGUA', orden: 3 },
        { codigo: 'gas', descripcion: 'Gas', abreviatura: 'GAS', orden: 4 },
        { codigo: 'luz', descripcion: 'Luz/Energía Eléctrica', abreviatura: 'LUZ', orden: 5 },
        { codigo: 'expensas', descripcion: 'Expensas', abreviatura: 'EXP', orden: 6 }
      ]
    },
    {
      codigo: 'tipo_cargo',
      descripcion: 'Tipos de Cargo',
      parametros: [
        { codigo: 'alquiler', descripcion: 'Alquiler', abreviatura: 'ALQ', orden: 1 },
        { codigo: 'tgi', descripcion: 'TGI', abreviatura: 'TGI', orden: 2 },
        { codigo: 'api', descripcion: 'API', abreviatura: 'API', orden: 3 },
        { codigo: 'agua', descripcion: 'Agua', abreviatura: 'AGUA', orden: 4 },
        { codigo: 'gas', descripcion: 'Gas', abreviatura: 'GAS', orden: 5 },
        { codigo: 'luz', descripcion: 'Luz', abreviatura: 'LUZ', orden: 6 },
        { codigo: 'expensas', descripcion: 'Expensas', abreviatura: 'EXP', orden: 7 }
      ]
    },
    {
      codigo: 'quien_paga',
      descripcion: 'Responsabilidad de Pago',
      parametros: [
        { codigo: 'inquilino', descripcion: 'Inquilino', abreviatura: 'INQ', orden: 1 },
        { codigo: 'propietario', descripcion: 'Propietario', abreviatura: 'PROP', orden: 2 },
        { codigo: 'prorrata', descripcion: 'Prorrata', abreviatura: 'PROR', orden: 3 }
      ]
    },
    {
      codigo: 'metodo_ajuste',
      descripcion: 'Métodos de Ajuste',
      parametros: [
        { codigo: 'coeficiente', descripcion: 'Coeficiente de Variación', abreviatura: 'COEF', orden: 1 },
        { codigo: 'indice', descripcion: 'Índice de Precios', abreviatura: 'IND', orden: 2 },
        { codigo: 'fijo', descripcion: 'Monto Fijo', abreviatura: 'FIJO', orden: 3 },
        { codigo: 'sin_ajuste', descripcion: 'Sin Ajuste', abreviatura: 'SIN', orden: 4 }
      ]
    },
    {
      codigo: 'moneda',
      descripcion: 'Monedas',
      parametros: [
        { codigo: 'ARS', descripcion: 'Pesos Argentinos', abreviatura: 'ARS', orden: 1 },
        { codigo: 'USD', descripcion: 'Dólares', abreviatura: 'USD', orden: 2 }
      ]
    },
    {
      codigo: 'periodicidad',
      descripcion: 'Periodicidad',
      parametros: [
        { codigo: 'mensual', descripcion: 'Mensual', abreviatura: 'MEN', orden: 1 },
        { codigo: 'bimestral', descripcion: 'Bimestral', abreviatura: 'BIM', orden: 2 },
        { codigo: 'trimestral', descripcion: 'Trimestral', abreviatura: 'TRI', orden: 3 },
        { codigo: 'semestral', descripcion: 'Semestral', abreviatura: 'SEM', orden: 4 },
        { codigo: 'anual', descripcion: 'Anual', abreviatura: 'ANU', orden: 5 }
      ]
    },
    {
      codigo: 'tipo_garantia',
      descripcion: 'Tipos de Garantía',
      parametros: [
        { codigo: 'fianza', descripcion: 'Fianza', abreviatura: 'FIA', orden: 1 },
        { codigo: 'deposito', descripcion: 'Depósito', abreviatura: 'DEP', orden: 2 },
        { codigo: 'garante', descripcion: 'Garante', abreviatura: 'GAR', orden: 3 },
        { codigo: 'seguro', descripcion: 'Seguro de Caución', abreviatura: 'SEG', orden: 4 }
      ]
    },
    {
      codigo: 'estado_garantia',
      descripcion: 'Estados de Garantía',
      parametros: [
        { codigo: 'activa', descripcion: 'Activa', abreviatura: 'ACT', orden: 1 },
        { codigo: 'vencida', descripcion: 'Vencida', abreviatura: 'VEN', orden: 2 },
        { codigo: 'devuelta', descripcion: 'Devuelta', abreviatura: 'DEV', orden: 3 }
      ]
    },
    {
      codigo: 'tipo_gasto_inicial',
      descripcion: 'Tipos de Gasto Inicial',
      parametros: [
        { codigo: 'sellado', descripcion: 'Sellado', abreviatura: 'SEL', orden: 1 },
        { codigo: 'honorarios', descripcion: 'Honorarios', abreviatura: 'HON', orden: 2 },
        { codigo: 'deposito', descripcion: 'Depósito', abreviatura: 'DEP', orden: 3 },
        { codigo: 'limpieza', descripcion: 'Limpieza', abreviatura: 'LIM', orden: 4 },
        { codigo: 'otro', descripcion: 'Otro', abreviatura: 'OTR', orden: 5 }
      ]
    },
    {
      codigo: 'estado_gasto',
      descripcion: 'Estados de Gasto',
      parametros: [
        { codigo: 'pendiente', descripcion: 'Pendiente', abreviatura: 'PEND', orden: 1 },
        { codigo: 'pagado', descripcion: 'Pagado', abreviatura: 'PAG', orden: 2 }
      ]
    },
    {
      codigo: 'estado_liquidacion',
      descripcion: 'Estados de Liquidación',
      parametros: [
        { codigo: 'borrador', descripcion: 'Borrador', abreviatura: 'BORR', orden: 1 },
        { codigo: 'pendiente_items', descripcion: 'Pendiente Items', abreviatura: 'PEND_ITEMS', orden: 2 },
        { codigo: 'lista_para_emitir', descripcion: 'Lista para Emitir', abreviatura: 'LISTA', orden: 3 },
        { codigo: 'emitida', descripcion: 'Emitida', abreviatura: 'EMIT', orden: 4 },
        { codigo: 'pagada', descripcion: 'Pagada', abreviatura: 'PAG', orden: 5 }
      ]
    },
    {
      codigo: 'estado_item',
      descripcion: 'Estados de Item de Liquidación',
      parametros: [
        { codigo: 'pendiente', descripcion: 'Pendiente', abreviatura: 'PEND', orden: 1 },
        { codigo: 'completado', descripcion: 'Completado', abreviatura: 'COMP', orden: 2 },
        { codigo: 'no_aplica', descripcion: 'No Aplica', abreviatura: 'NO_APL', orden: 3 }
      ]
    },
    {
      codigo: 'estado_contrato',
      descripcion: 'Estados de Contrato',
      parametros: [
        { codigo: 'borrador', descripcion: 'Borrador', abreviatura: 'BORR', orden: 1 },
        { codigo: 'pendiente_de_firma', descripcion: 'Pendiente de Firma', abreviatura: 'PEND_FIRMA', orden: 2 },
        { codigo: 'vigente', descripcion: 'Vigente', abreviatura: 'VIG', orden: 3 },
        { codigo: 'suspendido', descripcion: 'Suspendido', abreviatura: 'SUSP', orden: 4 },
        { codigo: 'en_mora', descripcion: 'En Mora', abreviatura: 'MORA', orden: 5 },
        { codigo: 'vencido', descripcion: 'Vencido', abreviatura: 'VENC', orden: 6 },
        { codigo: 'prorrogado', descripcion: 'Prorrogado', abreviatura: 'PRORR', orden: 7 },
        { codigo: 'renovado', descripcion: 'Renovado', abreviatura: 'RENOV', orden: 8 },
        { codigo: 'rescindido', descripcion: 'Rescindido', abreviatura: 'RESC', orden: 9 },
        { codigo: 'anulado', descripcion: 'Anulado', abreviatura: 'ANUL', orden: 10 },
        { codigo: 'finalizado', descripcion: 'Finalizado', abreviatura: 'FIN', orden: 11 }
      ]
    },
    {
      codigo: 'motivo_rescision',
      descripcion: 'Motivos de Rescisión',
      parametros: [
        { codigo: 'mutuo_acuerdo', descripcion: 'Mutuo Acuerdo', abreviatura: 'MUTUO', orden: 1 },
        { codigo: 'incumplimiento_inquilino', descripcion: 'Incumplimiento Inquilino', abreviatura: 'INC_INQ', orden: 2 },
        { codigo: 'incumplimiento_propietario', descripcion: 'Incumplimiento Propietario', abreviatura: 'INC_PROP', orden: 3 },
        { codigo: 'otro', descripcion: 'Otro', abreviatura: 'OTRO', orden: 4 }
      ]
    },
    {
      codigo: 'motivo_suspension',
      descripcion: 'Motivos de Suspensión',
      parametros: [
        { codigo: 'obra', descripcion: 'Obra', abreviatura: 'OBRA', orden: 1 },
        { codigo: 'inhabitabilidad', descripcion: 'Inhabitabilidad', abreviatura: 'INHAB', orden: 2 },
        { codigo: 'otro', descripcion: 'Otro', abreviatura: 'OTRO', orden: 3 }
      ]
    },
    {
      codigo: 'fuente',
      descripcion: 'Fuente de Item',
      parametros: [
        { codigo: 'automatico', descripcion: 'Automático', abreviatura: 'AUTO', orden: 1 },
        { codigo: 'manual', descripcion: 'Manual', abreviatura: 'MAN', orden: 2 }
      ]
    },
    {
      codigo: 'condicion_iva',
      descripcion: 'Condición IVA',
      parametros: [
        { codigo: 'responsable_inscripto', descripcion: 'Responsable Inscripto', abreviatura: 'RI', orden: 1 },
        { codigo: 'monotributo', descripcion: 'Monotributo', abreviatura: 'MONO', orden: 2 },
        { codigo: 'exento', descripcion: 'Exento', abreviatura: 'EXE', orden: 3 },
        { codigo: 'consumidor_final', descripcion: 'Consumidor Final', abreviatura: 'CF', orden: 4 }
      ]
    },
    {
      codigo: 'ambientes',
      descripcion: 'Ambientes',
      parametros: [
        { codigo: 'monoambiente', descripcion: 'Monoambiente', abreviatura: '1', orden: 1 },
        { codigo: 'dos_ambientes', descripcion: 'Dos ambientes', abreviatura: '2', orden: 2 },
        { codigo: 'tres_ambientes', descripcion: 'Tres ambientes', abreviatura: '3', orden: 3 },
        { codigo: 'cuatro_ambientes', descripcion: 'Cuatro ambientes', abreviatura: '4', orden: 4 },
        { codigo: 'cinco_ambientes', descripcion: 'Cinco ambientes', abreviatura: '5', orden: 5 },
        { codigo: 'seis_o_mas', descripcion: 'Seis o más ambientes', abreviatura: '6+', orden: 6 }
      ]
    },
    {
      codigo: 'documentacion',
      descripcion: 'Documentación',
      parametros: [
        { codigo: 'escritura', descripcion: 'Escritura', abreviatura: 'ESCR', orden: 1 },
        { codigo: 'reglamento', descripcion: 'Reglamento Copropiedad', abreviatura: 'REG', orden: 2 },
        { codigo: 'api', descripcion: 'Api', abreviatura: 'API', orden: 3 },
        { codigo: 'tgi', descripcion: 'Tgi', abreviatura: 'TGI', orden: 4 },
        { codigo: 'agua', descripcion: 'Agua', abreviatura: 'AGUA', orden: 5 },
        { codigo: 'luz', descripcion: 'Luz', abreviatura: 'LUZ', orden: 6 },
        { codigo: 'gas', descripcion: 'Gas', abreviatura: 'GAS', orden: 7 },
        { codigo: 'expensas', descripcion: 'Expensas', abreviatura: 'EXP', orden: 8 },
        { codigo: 'dni', descripcion: 'Dni titular/es y conyugue ambos lados', abreviatura: 'DNI', orden: 9 },
        { codigo: 'poder', descripcion: 'Poder especial en caso de ser necesario', abreviatura: 'POD', orden: 10 }
      ]
    }
  ];

  for (const cat of categorias) {
    const categoria = await prisma.categoria.upsert({
      where: { codigo: cat.codigo },
      update: {},
      create: {
        codigo: cat.codigo,
        descripcion: cat.descripcion
      }
    });

    for (const param of cat.parametros) {
      await prisma.parametro.upsert({
        where: {
          categoriaId_codigo: {
            categoriaId: categoria.id,
            codigo: param.codigo
          }
        },
        update: {},
        create: {
          categoriaId: categoria.id,
          codigo: param.codigo,
          descripcion: param.descripcion,
          abreviatura: param.abreviatura,
          orden: param.orden,
          activo: true
        }
      });
    }

    console.log(`✅ Categoría "${cat.descripcion}" y parámetros creados`);
  }

  console.log('✅ Seed completado exitosamente');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

