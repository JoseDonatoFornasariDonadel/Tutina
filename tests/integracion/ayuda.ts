import { prisma } from '@/lib/prisma';

/**
 * Las pruebas de integración escriben en la base. Para que nunca toquen la base real
 * (Supabase), solo corren con TUTINA_TEST_DB=1 y contra una base local.
 */
export function verificarBaseDePrueba() {
  const url = process.env.DATABASE_URL || '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // URL inválida: se rechaza abajo
  }
  const local = ['localhost', '127.0.0.1', 'postgres'].includes(host);
  if (process.env.TUTINA_TEST_DB !== '1' || !local) {
    throw new Error(
      'Pruebas de integración canceladas: se necesitan TUTINA_TEST_DB=1 y una DATABASE_URL local ' +
        '(localhost). Nunca se corren contra la base de producción.'
    );
  }
}

let contador = 0;
const unico = (prefijo: string) => `${prefijo}-${Date.now()}-${++contador}`;

/** Crea una prenda con una variante y todo lo necesario para registrar pedidos. */
export async function crearEscenario({ stock = 5, precio = 10000, costo = 5000 } = {}) {
  const [marca, categoria, talle, color, cliente, formaPago, estadoPagado, estadoCancelado] =
    await Promise.all([
      prisma.marca.create({ data: { nombreMarca: unico('Marca') } }),
      prisma.categoria.create({ data: { nombreCategoria: unico('Categoría') } }),
      prisma.talle.create({ data: { nombreTalle: unico('T') } }),
      prisma.color.create({ data: { nombreColor: unico('Color') } }),
      prisma.cliente.create({
        data: { nombreCliente: 'Cliente', apellidoCliente: unico('Prueba'), telefonoCliente: '1' },
      }),
      prisma.formaPago.create({ data: { nombreFP: unico('Efectivo') } }),
      prisma.estadoPedido.create({
        data: { nombreEP: unico('Pagado'), reservaStock: true, liberaStock: false },
      }),
      prisma.estadoPedido.create({
        data: { nombreEP: unico('Cancelado'), reservaStock: false, liberaStock: true },
      }),
    ]);
  const producto = await prisma.producto.create({
    data: {
      nombre: unico('Remera'),
      descripcion: '',
      imagen: '',
      precioCosto: costo,
      porcentajeMarkup: 100,
      precio,
      codMarca: marca.codMarca,
      codCategoria: categoria.codCategoria,
    },
  });
  const variante = await prisma.varianteProducto.create({
    data: {
      sku: unico('SKU'),
      stock,
      codProducto: producto.codProducto,
      codTalle: talle.codTalle,
      codColor: color.codColor,
    },
  });
  return { producto, variante, cliente, formaPago, estadoPagado, estadoCancelado, color };
}

export async function stockDe(codVariante: number) {
  const v = await prisma.varianteProducto.findUniqueOrThrow({ where: { codVariante } });
  return v.stock;
}
