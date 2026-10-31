import { prisma } from '../src/lib/prisma';

async function main() {
  const count = await prisma.producto.count({ where: { fechaHoraBajaProd: null } });
  console.log(`Prendas actuales en catálogo: ${count}`);

  if (count >= 15) {
    console.log('Ya existen 15 o más prendas para probar la paginación de 12 por página.');
    return;
  }

  const marca = await prisma.marca.findFirstOrThrow({ where: { fechaHoraBajaMarca: null } });
  const categoria = await prisma.categoria.findFirstOrThrow({ where: { fechaHoraBajaCat: null } });
  const temporada = await prisma.temporada.findFirstOrThrow({ where: { fechaHoraBajaTemp: null } });
  const talle = await prisma.talle.findFirstOrThrow({ where: { fechaHoraBajaTalle: null } });
  const color = await prisma.color.findFirstOrThrow({ where: { fechaHoraBajaColor: null } });

  const adicionales = [
    {
      nombre: 'Conjunto Seamless Ribbed Tiro Alto',
      descripcion: 'Conjunto deportivo acanalado de alta compresión y máxima suavidad.',
      imagen: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
      precioCosto: 18500,
      porcentajeMarkup: 130,
      precio: 42550,
    },
    {
      nombre: 'Short Running Doble Calza Ultraligero',
      descripcion: 'Short con calza interna antiroce y bolsillo oculto porta celular.',
      imagen: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
      precioCosto: 11200,
      porcentajeMarkup: 125,
      precio: 25200,
    },
    {
      nombre: 'Musculosa Deportiva Espalda Nadador Microtul',
      descripcion: 'Musculosa fresca con recorte de microtul respirable para entrenamientos intensos.',
      imagen: 'https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=800&q=80',
      precioCosto: 8500,
      porcentajeMarkup: 120,
      precio: 18700,
    },
    {
      nombre: 'Buzo Oversize Rústico Peinado Tutina Urban',
      descripcion: 'Buzo urbano corte relajado en algodón rústico premium para post-entreno.',
      imagen: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80',
      precioCosto: 17000,
      porcentajeMarkup: 135,
      precio: 39950,
    },
    {
      nombre: 'Calza Oxford Deportiva Supplex',
      descripcion: 'Pantalón flare / oxford deportivo que estiliza la figura, apto yoga y uso urbano.',
      imagen: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=800&q=80',
      precioCosto: 15200,
      porcentajeMarkup: 130,
      precio: 34960,
    },
    {
      nombre: 'Top Asimétrico One-Shoulder Fitness',
      descripcion: 'Top de un solo hombro con doble forrería y elástico embutido.',
      imagen: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80',
      precioCosto: 9800,
      porcentajeMarkup: 125,
      precio: 22050,
    },
    {
      nombre: 'Pantalón Jogger Masculino Training Slim',
      descripcion: 'Jogger masculino con cierres en botamanga y bolsillos con cierre.',
      imagen: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      precioCosto: 16500,
      porcentajeMarkup: 120,
      precio: 36300,
    },
    {
      nombre: 'Remera Crop Top Algodón Pima & Lycra',
      descripcion: 'Remera corta al cuerpo de tacto ultra suave para pilates y gym.',
      imagen: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=800&q=80',
      precioCosto: 8900,
      porcentajeMarkup: 125,
      precio: 20025,
    },
    {
      nombre: 'Rompevientos Deportivo Impermeable Ultraliviano',
      descripcion: 'Campera rompevientos plegable con capucha ajustable y detalles reflectivos.',
      imagen: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80',
      precioCosto: 21500,
      porcentajeMarkup: 130,
      precio: 49450,
    },
    {
      nombre: 'Calza Térmica Frizada Invierno Pro',
      descripcion: 'Calza con interior frizado térmico para entrenamientos al aire libre.',
      imagen: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=800&q=80',
      precioCosto: 15800,
      porcentajeMarkup: 130,
      precio: 36340,
    },
  ];

  for (let i = 0; i < adicionales.length; i++) {
    const item = adicionales[i];
    await prisma.producto.create({
      data: {
        nombre: item.nombre,
        descripcion: item.descripcion,
        imagen: item.imagen,
        precioCosto: item.precioCosto,
        porcentajeMarkup: item.porcentajeMarkup,
        precio: item.precio,
        codMarca: marca.codMarca,
        codCategoria: categoria.codCategoria,
        productosTemporada: {
          create: [{ anio: 2026, codTemporada: temporada.codTemporada }],
        },
        variantes: {
          create: [
            {
              sku: `TUT-PAG-${Date.now().toString().slice(-4)}-${i + 1}`,
              codTalle: talle.codTalle,
              codColor: color.codColor,
              stock: 6,
              alertaStockEnviada: false,
            },
          ],
        },
      },
    });
  }

  const nuevoTotal = await prisma.producto.count({ where: { fechaHoraBajaProd: null } });
  console.log(`✅ Catálogo ampliado a ${nuevoTotal} prendas para visualizar múltiples páginas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
