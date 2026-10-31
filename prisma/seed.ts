import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos para Tutina...');

  // Limpiar tablas existentes en orden seguro
  await prisma.alertaWhatsAppLog.deleteMany();
  await prisma.pedidoFormaPago.deleteMany();
  await prisma.pedidoEstado.deleteMany();
  await prisma.detallePedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.detalleIngreso.deleteMany();
  await prisma.factura.deleteMany();
  await prisma.historialPrecioProducto.deleteMany();
  await prisma.varianteProducto.deleteMany();
  await prisma.productoTemporada.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.descuento.deleteMany();
  await prisma.temporada.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.marca.deleteMany();
  await prisma.talle.deleteMany();
  await prisma.color.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.estadoPedido.deleteMany();
  await prisma.formaPago.deleteMany();
  await prisma.gastoOperativo.deleteMany();
  await prisma.categoriaGasto.deleteMany();
  await prisma.configuracionTienda.deleteMany();

  // 1. Configuración inicial de Tutina
  await prisma.configuracionTienda.create({
    data: {
      nombreComercial: 'Tutina',
      logoUrl: '/tutina-logo.svg',
      slogan: 'Indumentaria Deportiva & Urbana',
      telefonoWhatsAppNotificaciones: '+5493516543210',
      cuit: '27-34891203-4',
      direccionComercial: 'Av. Hipólito Yrigoyen 450 - Showroom Tutina',
      instagramHandle: '@tutina.indumentaria',
      markupPorDefectoGlobal: 120.0,
      umbralAlertaStockDefault: 3,
    },
  });

  // 2. Talles y Colores
  const [talleS, talleM, talleL, talleXL] = await Promise.all([
    prisma.talle.create({ data: { nombreTalle: 'S', tipoTalle: 'Alfanumérico', ordenVisualizacion: 1 } }),
    prisma.talle.create({ data: { nombreTalle: 'M', tipoTalle: 'Alfanumérico', ordenVisualizacion: 2 } }),
    prisma.talle.create({ data: { nombreTalle: 'L', tipoTalle: 'Alfanumérico', ordenVisualizacion: 3 } }),
    prisma.talle.create({ data: { nombreTalle: 'XL', tipoTalle: 'Alfanumérico', ordenVisualizacion: 4 } }),
  ]);

  const [colorNegro, colorRosa, colorPetroleo, colorGris, colorBlanco, colorLila] = await Promise.all([
    prisma.color.create({ data: { nombreColor: 'Negro Ónix', codigoHex: '#18181B' } }),
    prisma.color.create({ data: { nombreColor: 'Rosa Coral', codigoHex: '#F43F5E' } }),
    prisma.color.create({ data: { nombreColor: 'Azul Petróleo', codigoHex: '#0F766E' } }),
    prisma.color.create({ data: { nombreColor: 'Gris Melange', codigoHex: '#71717A' } }),
    prisma.color.create({ data: { nombreColor: 'Blanco Puro', codigoHex: '#F8FAFC' } }),
    prisma.color.create({ data: { nombreColor: 'Lila Pastel', codigoHex: '#C084FC' } }),
  ]);

  // 3. Marcas, Categorías, Temporadas y Descuentos
  const [marcaTutina, marcaVandalia, marcaTouche, marcaUnder] = await Promise.all([
    prisma.marca.create({ data: { nombreMarca: 'Tutina Fit (Línea Propia)' } }),
    prisma.marca.create({ data: { nombreMarca: 'Vandalia Active' } }),
    prisma.marca.create({ data: { nombreMarca: 'Touché Sport' } }),
    prisma.marca.create({ data: { nombreMarca: 'ProRun Masculino' } }),
  ]);

  const [catCalzas, catTops, catBikers, catMasculino, catAbrigos] = await Promise.all([
    prisma.categoria.create({
      data: { nombreCategoria: 'Calzas & Leggings', rubro: 'Deportivo Femenino', markupPorDefectoCategoria: 130.0 },
    }),
    prisma.categoria.create({
      data: { nombreCategoria: 'Tops Deportivos', rubro: 'Deportivo Femenino', markupPorDefectoCategoria: 125.0 },
    }),
    prisma.categoria.create({
      data: { nombreCategoria: 'Bikers & Shorts', rubro: 'Deportivo Femenino', markupPorDefectoCategoria: 120.0 },
    }),
    prisma.categoria.create({
      data: { nombreCategoria: 'Entrenamiento Masculino', rubro: 'Deportivo Masculino', markupPorDefectoCategoria: 115.0 },
    }),
    prisma.categoria.create({
      data: { nombreCategoria: 'Buzos & Camperas Lycra', rubro: 'Urbano & Abrigo', markupPorDefectoCategoria: 135.0 },
    }),
  ]);

  const [tempPV, tempOI, tempTodoAnio] = await Promise.all([
    prisma.temporada.create({ data: { nombreTemporada: 'Primavera / Verano' } }),
    prisma.temporada.create({ data: { nombreTemporada: 'Otoño / Invierno' } }),
    prisma.temporada.create({ data: { nombreTemporada: 'Continuo Todo el Año' } }),
  ]);

  const [descPromoFitness, descLiquidacion] = await Promise.all([
    prisma.descuento.create({
      data: {
        nombreDesc: 'Promo Fitness 10% OFF',
        descripcionDesc: 'Descuento promocional en conjunto seamless y bikers seleccionadas',
        porcentajeDesc: 10,
        fechaInicioDesc: new Date('2026-01-01'),
        fechaFinDesc: new Date('2027-12-31'),
        activoEnTiendaOnline: true,
      },
    }),
    prisma.descuento.create({
      data: {
        nombreDesc: 'Oportunidad Fin de Temporada 15%',
        descripcionDesc: 'Descuento especial en abrigos térmicos seleccionados',
        porcentajeDesc: 15,
        fechaInicioDesc: new Date('2026-01-01'),
        fechaFinDesc: new Date('2027-12-31'),
        activoEnTiendaOnline: true,
      },
    }),
  ]);

  // 4. Proveedores
  const [provTextilSur, provActiveWearBA, provDistDeportiva] = await Promise.all([
    prisma.proveedor.create({
      data: {
        nombreProveedor: 'Textil Fitness Sur S.R.L.',
        webProveedor: 'https://textilfitnesssur.com.ar',
        numeroProveedor: '+5491145678901',
        correoProveedor: 'mayorista@textilfitnesssur.com.ar',
      },
    }),
    prisma.proveedor.create({
      data: {
        nombreProveedor: 'ActiveWear Fábrica Directa',
        webProveedor: 'https://activewearfabrica.com.ar',
        numeroProveedor: '+5493514455667',
        correoProveedor: 'pedidos@activewearfabrica.com.ar',
      },
    }),
    prisma.proveedor.create({
      data: {
        nombreProveedor: 'Distribuidora ProSport',
        webProveedor: 'https://prosportmayorista.com.ar',
        numeroProveedor: '+5493415566778',
        correoProveedor: 'ventas@prosportmayorista.com.ar',
      },
    }),
  ]);

  // 5. Productos y sus Variantes
  const p1 = await prisma.producto.create({
    data: {
      nombre: 'Calza Seamless Push-Up Sculpt',
      descripcion: 'Calza tiro alto sin costuras en tejido de poliamida elastizada premium. No trasluce, calce modelador ideal para gym y running.',
      imagen: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?auto=format&fit=crop&w=800&q=80',
      precioCosto: 14500,
      porcentajeMarkup: 130,
      precio: 33350,
      codMarca: marcaTutina.codMarca,
      codCategoria: catCalzas.codCategoria,
      codDescuento: descPromoFitness.codDescuento,
      codProveedorHabitual: provActiveWearBA.codProveedor,
      productosTemporada: {
        create: [{ anio: 2026, codTemporada: tempTodoAnio.codTemporada }],
      },
      historialPrecios: {
        create: [
          { fechaRegistro: new Date('2026-06-01'), precioCosto: 11500, porcentajeMarkup: 125, precioVenta: 25875, motivo: 'Alta inicial Junio' },
          { fechaRegistro: new Date('2026-08-01'), precioCosto: 13000, porcentajeMarkup: 130, precioVenta: 29900, motivo: 'Factura Proveedor #A-0012' },
          { fechaRegistro: new Date('2026-10-01'), precioCosto: 14500, porcentajeMarkup: 130, precioVenta: 33350, motivo: 'Factura Proveedor #A-0045' },
        ],
      },
      variantes: {
        create: [
          { sku: 'TUT-CAL-SCU-S-NEG', codTalle: talleS.codTalle, codColor: colorNegro.codColor, stock: 8, alertaStockEnviada: false },
          // Stock en 3 unidades: al vender 1 unidad caerá a 2 (< 3) y disparará el WhatsApp en vivo
          { sku: 'TUT-CAL-SCU-M-NEG', codTalle: talleM.codTalle, codColor: colorNegro.codColor, stock: 3, alertaStockEnviada: false },
          // Stock en 2 unidades: ya crítica
          { sku: 'TUT-CAL-SCU-L-PET', codTalle: talleL.codTalle, codColor: colorPetroleo.codColor, stock: 2, alertaStockEnviada: true },
        ],
      },
    },
    include: { variantes: true },
  });

  const p2 = await prisma.producto.create({
    data: {
      nombre: 'Top Deportivo Alto Impacto CrossBack',
      descripcion: 'Top deportivo con espalda cruzada reforzada, tazas desmontables y elástico bajo busto de alta sujeción.',
      imagen: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80',
      precioCosto: 9200,
      porcentajeMarkup: 125,
      precio: 20700,
      codMarca: marcaTutina.codMarca,
      codCategoria: catTops.codCategoria,
      codProveedorHabitual: provActiveWearBA.codProveedor,
      productosTemporada: {
        create: [{ anio: 2026, codTemporada: tempPV.codTemporada }],
      },
      historialPrecios: {
        create: [
          { fechaRegistro: new Date('2026-06-01'), precioCosto: 7500, porcentajeMarkup: 120, precioVenta: 16500, motivo: 'Alta inicial' },
          { fechaRegistro: new Date('2026-08-15'), precioCosto: 8400, porcentajeMarkup: 125, precioVenta: 18900, motivo: 'Ajuste lista proveedor' },
          { fechaRegistro: new Date('2026-10-05'), precioCosto: 9200, porcentajeMarkup: 125, precioVenta: 20700, motivo: 'Reposición Primavera' },
        ],
      },
      variantes: {
        create: [
          { sku: 'TUT-TOP-CRO-S-ROS', codTalle: talleS.codTalle, codColor: colorRosa.codColor, stock: 6, alertaStockEnviada: false },
          { sku: 'TUT-TOP-CRO-M-ROS', codTalle: talleM.codTalle, codColor: colorRosa.codColor, stock: 3, alertaStockEnviada: false },
          { sku: 'TUT-TOP-CRO-M-NEG', codTalle: talleM.codTalle, codColor: colorNegro.codColor, stock: 9, alertaStockEnviada: false },
        ],
      },
    },
    include: { variantes: true },
  });

  const p3 = await prisma.producto.create({
    data: {
      nombre: 'Biker Ciclista Supplex Cintura En V',
      descripcion: 'Short biker en tejido Supplex original brasileño. Costuras planas antiroce y cintura en V estilizada.',
      imagen: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=800&q=80',
      precioCosto: 10500,
      porcentajeMarkup: 120,
      precio: 23100,
      codMarca: marcaVandalia.codMarca,
      codCategoria: catBikers.codCategoria,
      codDescuento: descPromoFitness.codDescuento,
      codProveedorHabitual: provTextilSur.codProveedor,
      productosTemporada: {
        create: [{ anio: 2026, codTemporada: tempPV.codTemporada }],
      },
      historialPrecios: {
        create: [
          { fechaRegistro: new Date('2026-07-01'), precioCosto: 8900, porcentajeMarkup: 120, precioVenta: 19580, motivo: 'Alta catálogo' },
          { fechaRegistro: new Date('2026-09-20'), precioCosto: 10500, porcentajeMarkup: 120, precioVenta: 23100, motivo: 'Ingreso Primavera' },
        ],
      },
      variantes: {
        create: [
          { sku: 'VAN-BIK-SUP-S-LIL', codTalle: talleS.codTalle, codColor: colorLila.codColor, stock: 5, alertaStockEnviada: false },
          { sku: 'VAN-BIK-SUP-M-NEG', codTalle: talleM.codTalle, codColor: colorNegro.codColor, stock: 4, alertaStockEnviada: false },
        ],
      },
    },
    include: { variantes: true },
  });

  const p4 = await prisma.producto.create({
    data: {
      nombre: 'Remera Masculina Dry-Fit AeroTech',
      descripcion: 'Remera de entrenamiento masculino con paneles microperforados respirables y secado ultra rápido.',
      imagen: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      precioCosto: 11000,
      porcentajeMarkup: 115,
      precio: 23650,
      codMarca: marcaUnder.codMarca,
      codCategoria: catMasculino.codCategoria,
      codProveedorHabitual: provDistDeportiva.codProveedor,
      productosTemporada: {
        create: [{ anio: 2026, codTemporada: tempTodoAnio.codTemporada }],
      },
      historialPrecios: {
        create: [
          { fechaRegistro: new Date('2026-07-10'), precioCosto: 9500, porcentajeMarkup: 115, precioVenta: 20425, motivo: 'Alta línea masculina' },
          { fechaRegistro: new Date('2026-10-01'), precioCosto: 11000, porcentajeMarkup: 115, precioVenta: 23650, motivo: 'Actualización Octubre' },
        ],
      },
      variantes: {
        create: [
          { sku: 'PRO-REM-DRY-L-GRI', codTalle: talleL.codTalle, codColor: colorGris.codColor, stock: 7, alertaStockEnviada: false },
          { sku: 'PRO-REM-DRY-XL-NEG', codTalle: talleXL.codTalle, codColor: colorNegro.codColor, stock: 3, alertaStockEnviada: false },
        ],
      },
    },
    include: { variantes: true },
  });

  const p5 = await prisma.producto.create({
    data: {
      nombre: 'Campera Deportiva Slim Lycra Térmica',
      descripcion: 'Campera entallada con cierre completo, pasa-pulgar en puños y bolsillos laterales invisibles.',
      imagen: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80',
      precioCosto: 19000,
      porcentajeMarkup: 135,
      precio: 44650,
      codMarca: marcaTouche.codMarca,
      codCategoria: catAbrigos.codCategoria,
      codDescuento: descLiquidacion.codDescuento,
      codProveedorHabitual: provTextilSur.codProveedor,
      productosTemporada: {
        create: [{ anio: 2026, codTemporada: tempOI.codTemporada }],
      },
      historialPrecios: {
        create: [
          { fechaRegistro: new Date('2026-06-01'), precioCosto: 16500, porcentajeMarkup: 135, precioVenta: 38775, motivo: 'Temporada Invierno' },
          { fechaRegistro: new Date('2026-09-01'), precioCosto: 19000, porcentajeMarkup: 135, precioVenta: 44650, motivo: 'Reposición cápsula' },
        ],
      },
      variantes: {
        create: [
          { sku: 'TOU-CAM-SLI-M-BLA', codTalle: talleM.codTalle, codColor: colorBlanco.codColor, stock: 5, alertaStockEnviada: false },
          { sku: 'TOU-CAM-SLI-L-NEG', codTalle: talleL.codTalle, codColor: colorNegro.codColor, stock: 1, alertaStockEnviada: true },
        ],
      },
    },
    include: { variantes: true },
  });

  // 6. Facturas de Proveedor Históricas
  await prisma.factura.create({
    data: {
      nroFactura: 'FC-A-0001-00004512',
      fechaFactura: new Date('2026-10-01'),
      ivaFactura: 21.0,
      costoTotal: 269000,
      rutaFacturaPDF: '/facturas/FC-A-0001-00004512.pdf',
      codProveedor: provActiveWearBA.codProveedor,
      detallesIngreso: {
        create: [
          {
            codVariante: p1.variantes[0].codVariante,
            cantidadDI: 10,
            precioIndividual: 14500,
            subtotalDI: 145000,
          },
          {
            codVariante: p2.variantes[0].codVariante,
            cantidadDI: 8,
            precioIndividual: 9200,
            subtotalDI: 73600,
          },
        ],
      },
    },
  });

  // 7. Clientes
  const [cliLucia, cliValentina, cliMartina, cliNicolas] = await Promise.all([
    prisma.cliente.create({
      data: {
        nombreCliente: 'Lucía',
        apellidoCliente: 'Fernández',
        telefonoCliente: '+5493512345678',
        emailCliente: 'lucia.fernandez@gmail.com',
        dniCuit: '38451290',
      },
    }),
    prisma.cliente.create({
      data: {
        nombreCliente: 'Valentina',
        apellidoCliente: 'Gómez',
        telefonoCliente: '+5493518765432',
        emailCliente: 'valengomez.fit@gmail.com',
        dniCuit: '41209384',
      },
    }),
    prisma.cliente.create({
      data: {
        nombreCliente: 'Martina',
        apellidoCliente: 'Sánchez',
        telefonoCliente: '+5493513344556',
        emailCliente: 'marti.sanchez@hotmail.com',
        dniCuit: '39887123',
      },
    }),
    prisma.cliente.create({
      data: {
        nombreCliente: 'Nicolás',
        apellidoCliente: 'Peralta',
        telefonoCliente: '+5493519988776',
        emailCliente: 'nico.peralta@gmail.com',
        dniCuit: '36712390',
      },
    }),
  ]);

  // 8. Estados de Pedido y Formas de Pago
  const [
    estConfirmado,
    estPagadoEntregado,
    estEntregadoPendientePago,
    estPendiente,
    estCancelado,
  ] = await Promise.all([
    prisma.estadoPedido.create({
      data: {
        nombreEP: 'Confirmado / Reservado',
        colorBadge: 'blue',
        reservaStock: true,
        liberaStock: false,
        impactaEnReportesVenta: true,
      },
    }),
    prisma.estadoPedido.create({
      data: {
        nombreEP: 'Pagado y Entregado',
        colorBadge: 'emerald',
        reservaStock: true,
        liberaStock: false,
        impactaEnReportesVenta: true,
      },
    }),
    prisma.estadoPedido.create({
      data: {
        nombreEP: 'Entregado y pendiente de pago',
        colorBadge: 'amber',
        reservaStock: true,
        liberaStock: false,
        impactaEnReportesVenta: true,
      },
    }),
    prisma.estadoPedido.create({
      data: {
        nombreEP: 'Pendiente de Retiro',
        colorBadge: 'amber',
        reservaStock: true,
        liberaStock: false,
        impactaEnReportesVenta: true,
      },
    }),
    prisma.estadoPedido.create({
      data: {
        nombreEP: 'Cancelado / Devuelto',
        colorBadge: 'rose',
        reservaStock: false,
        liberaStock: true,
        impactaEnReportesVenta: false,
      },
    }),
  ]);

  const [fpEfectivo, fpTransferencia, fpTarjetaCredito, fpMercadoPago] = await Promise.all([
    prisma.formaPago.create({
      data: { nombreFP: 'Efectivo Local', porcentajeComisionActual: 0.0, recargoFinancieroPorcentaje: 0.0 },
    }),
    prisma.formaPago.create({
      data: { nombreFP: 'Transferencia Bancaria / Alias', porcentajeComisionActual: 0.0, recargoFinancieroPorcentaje: 0.0 },
    }),
    prisma.formaPago.create({
      data: { nombreFP: 'Tarjeta de Crédito (3 Cuotas)', porcentajeComisionActual: 6.5, recargoFinancieroPorcentaje: 10.0 },
    }),
    prisma.formaPago.create({
      data: { nombreFP: 'Mercado Pago QR', porcentajeComisionActual: 3.2, recargoFinancieroPorcentaje: 0.0 },
    }),
  ]);

  // 9. Pedidos Históricos (Junio a Octubre 2026) con Snapshot Histórico Inmutable
  const pedidosSeed = [
    {
      fecha: new Date('2026-06-15T11:30:00'),
      codCliente: cliLucia.codCliente,
      codEstado: estPagadoEntregado.codEP,
      codFP: fpTransferencia.codFP,
      comisionPct: 0,
      items: [
        { codVariante: p1.variantes[0].codVariante, cant: 2, pVenta: 25875, descPct: 0, pCostoHist: 11500 },
        { codVariante: p2.variantes[0].codVariante, cant: 2, pVenta: 16500, descPct: 0, pCostoHist: 7500 },
      ],
    },
    {
      fecha: new Date('2026-07-18T17:20:00'),
      codCliente: cliValentina.codCliente,
      codEstado: estPagadoEntregado.codEP,
      codFP: fpTarjetaCredito.codFP,
      comisionPct: 6.5,
      items: [
        { codVariante: p5.variantes[0].codVariante, cant: 2, pVenta: 38775, descPct: 0, pCostoHist: 16500 },
        { codVariante: p3.variantes[0].codVariante, cant: 2, pVenta: 19580, descPct: 10, pCostoHist: 8900 },
      ],
    },
    {
      fecha: new Date('2026-08-22T18:10:00'),
      codCliente: cliMartina.codCliente,
      codEstado: estPagadoEntregado.codEP,
      codFP: fpMercadoPago.codFP,
      comisionPct: 3.2,
      items: [
        { codVariante: p1.variantes[1].codVariante, cant: 3, pVenta: 29900, descPct: 10, pCostoHist: 13000 },
        { codVariante: p2.variantes[2].codVariante, cant: 2, pVenta: 18900, descPct: 0, pCostoHist: 8400 },
      ],
    },
    {
      fecha: new Date('2026-09-14T16:45:00'),
      codCliente: cliNicolas.codCliente,
      codEstado: estPagadoEntregado.codEP,
      codFP: fpTransferencia.codFP,
      comisionPct: 0,
      items: [
        { codVariante: p4.variantes[0].codVariante, cant: 3, pVenta: 23650, descPct: 0, pCostoHist: 11000 },
        { codVariante: p3.variantes[1].codVariante, cant: 2, pVenta: 23100, descPct: 10, pCostoHist: 10500 },
        { codVariante: p5.variantes[1].codVariante, cant: 1, pVenta: 44650, descPct: 15, pCostoHist: 19000 },
      ],
    },
    {
      fecha: new Date('2026-10-12T12:15:00'),
      codCliente: cliLucia.codCliente,
      codEstado: estPagadoEntregado.codEP,
      codFP: fpMercadoPago.codFP,
      comisionPct: 3.2,
      items: [
        { codVariante: p1.variantes[0].codVariante, cant: 2, pVenta: 33350, descPct: 10, pCostoHist: 14500 },
        { codVariante: p2.variantes[1].codVariante, cant: 2, pVenta: 20700, descPct: 0, pCostoHist: 9200 },
      ],
    },
    {
      fecha: new Date('2026-10-25T19:00:00'),
      codCliente: cliValentina.codCliente,
      codEstado: estConfirmado.codEP,
      codFP: fpEfectivo.codFP,
      comisionPct: 0,
      items: [
        { codVariante: p1.variantes[2].codVariante, cant: 2, pVenta: 33350, descPct: 10, pCostoHist: 14500 },
        { codVariante: p4.variantes[1].codVariante, cant: 1, pVenta: 23650, descPct: 0, pCostoHist: 11000 },
      ],
    },
  ];

  for (const ped of pedidosSeed) {
    let subtotalBruto = 0;
    let totalNeto = 0;

    const detallesData = ped.items.map((it) => {
      const brutoLinea = it.cant * it.pVenta;
      const precioNetoUnit = Math.round(it.pVenta * (1 - it.descPct / 100));
      const subtotalLinea = it.cant * precioNetoUnit;
      subtotalBruto += brutoLinea;
      totalNeto += subtotalLinea;

      return {
        codVariante: it.codVariante,
        Cantidad: it.cant,
        precioUnitarioVenta: it.pVenta,
        porcentajeDescuentoAplicado: it.descPct,
        precioUnitarioNeto: precioNetoUnit,
        precioUnitarioCostoHistorico: it.pCostoHist,
        subtotal: subtotalLinea,
      };
    });

    const montoComision = Math.round(totalNeto * (ped.comisionPct / 100));
    const esPagado = ped.codEstado === estPagadoEntregado.codEP;

    await prisma.pedido.create({
      data: {
        fechaPedido: ped.fecha,
        canalVenta: 'LOCAL_MANUAL',
        subtotalBruto,
        montoDescuentosTotal: subtotalBruto - totalNeto,
        total: totalNeto,
        totalPagado: esPagado ? totalNeto : 0,
        totalAPagar: esPagado ? 0 : totalNeto,
        codCliente: ped.codCliente,
        codEstadoActual: ped.codEstado,
        detallesPedido: {
          create: detallesData,
        },
        historialEstados: {
          create: [
            {
              codEP: ped.codEstado,
              fechaInicioPE: ped.fecha,
              motivoCambio: 'Registro inicial de pedido',
            },
          ],
        },
        formasPago: {
          create: [
            {
              codFP: ped.codFP,
              montoPFP: totalNeto,
              fechaPFP: ped.fecha,
              porcentajeComisionAplicado: ped.comisionPct,
              montoComisionCalculado: montoComision,
            },
          ],
        },
      },
    });
  }

  // 10. Categorías de Gasto y Gastos Operativos (para cálculo real de Utilidad Neta)
  const [cgAlquiler, cgPublicidad, cgPackaging] = await Promise.all([
    prisma.categoriaGasto.create({ data: { nombreCategoriaGasto: 'Showroom & Servicios', esCostoFijoMensual: true } }),
    prisma.categoriaGasto.create({ data: { nombreCategoriaGasto: 'Marketing & Instagram Ads', esCostoFijoMensual: false } }),
    prisma.categoriaGasto.create({ data: { nombreCategoriaGasto: 'Bolsas Tutina & Etiquetas', esCostoFijoMensual: false } }),
  ]);

  await prisma.gastoOperativo.createMany({
    data: [
      { descripcionGasto: 'Expensas y Servicios Showroom Junio', montoGasto: 18000, fechaImputacion: new Date('2026-06-10'), codCategoriaGasto: cgAlquiler.codCategoriaGasto },
      { descripcionGasto: 'Expensas y Servicios Showroom Julio', montoGasto: 19500, fechaImputacion: new Date('2026-07-10'), codCategoriaGasto: cgAlquiler.codCategoriaGasto },
      { descripcionGasto: 'Bolsas Impresas Logo Tutina x200', montoGasto: 14000, fechaImputacion: new Date('2026-08-05'), codCategoriaGasto: cgPackaging.codCategoriaGasto },
      { descripcionGasto: 'Expensas y Servicios Showroom Septiembre', montoGasto: 22000, fechaImputacion: new Date('2026-09-10'), codCategoriaGasto: cgAlquiler.codCategoriaGasto },
      { descripcionGasto: 'Pauta Publicitaria Lanzamiento Primavera', montoGasto: 16500, fechaImputacion: new Date('2026-10-08'), codCategoriaGasto: cgPublicidad.codCategoriaGasto },
      { descripcionGasto: 'Packaging Perfumado Tutina Octubre', montoGasto: 11000, fechaImputacion: new Date('2026-10-18'), codCategoriaGasto: cgPackaging.codCategoriaGasto },
    ],
  });

  // 11. Alertas de WhatsApp previas para las 2 variantes que ya están con stock < 3 en el seed
  await prisma.alertaWhatsAppLog.createMany({
    data: [
      {
        codVariante: p1.variantes[2].codVariante,
        telefonoDestino: '+5493516543210',
        stockRemanente: 2,
        estadoEnvio: 'ENVIADO',
        origenDisparo: 'VENTA_PEDIDO',
        mensajeEnviado:
          '⚠️ *Alerta de Stock en Tutina*: La prenda *Calza Seamless Push-Up Sculpt* (Talle: L, Color: Azul Petróleo, SKU: TUT-CAL-SCU-L-PET) quedó con *2 unidades* disponibles (umbral crítico < 3).',
      },
      {
        codVariante: p5.variantes[1].codVariante,
        telefonoDestino: '+5493516543210',
        stockRemanente: 1,
        estadoEnvio: 'ENVIADO',
        origenDisparo: 'VENTA_PEDIDO',
        mensajeEnviado:
          '⚠️ *Alerta de Stock en Tutina*: La prenda *Campera Deportiva Slim Lycra Térmica* (Talle: L, Color: Negro Ónix, SKU: TOU-CAM-SLI-L-NEG) quedó con *1 unidad* disponible (umbral crítico < 3).',
      },
    ],
  });

  console.log('✅ Seed de Tutina completado con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
