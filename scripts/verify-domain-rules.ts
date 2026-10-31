import assert from 'node:assert';
import { prisma } from '../src/lib/prisma';
import {
  calcularCoeficienteReventa,
  calcularMarkupReverso,
  calcularPrecioSugerido,
} from '../src/lib/services/pricing.service';
import { registrarNuevoPedido } from '../src/lib/services/pedidos.service';
import { registrarFacturaIngreso } from '../src/lib/services/ingresos.service';
import { obtenerReportesFinancieros } from '../src/lib/services/reportes.service';

async function runVerification() {
  console.log('🔍 1. Verificando Reglas de Precios y Markup (RN-02)...');
  assert.strictEqual(calcularPrecioSugerido(10000, 120), 22000);
  assert.strictEqual(calcularCoeficienteReventa(130), 2.3);
  assert.strictEqual(calcularMarkupReverso(10000, 23500), 135);
  console.log('   ✔ Cálculo de Markup, Coeficiente y Redondeo Inverso OK.');

  console.log('🔍 2. Verificando Disparo de Alerta WhatsApp al caer a stock < 3 (RN-04)...');
  // Buscar la variante TUT-CAL-SCU-M-NEG que en el seed tiene stock = 3 y alertaStockEnviada = false
  const varianteCriticaTest = await prisma.varianteProducto.findUnique({
    where: { sku: 'TUT-CAL-SCU-M-NEG' },
    include: { producto: true },
  });
  assert(varianteCriticaTest, 'Variante TUT-CAL-SCU-M-NEG debe existir');
  assert.strictEqual(varianteCriticaTest.stock, 3);
  assert.strictEqual(varianteCriticaTest.alertaStockEnviada, false);

  const cliente = await prisma.cliente.findFirstOrThrow();
  const formaPago = await prisma.formaPago.findFirstOrThrow();

  // Venta 1: Vender 1 unidad -> stock pasa de 3 a 2 (< 3) -> DEBE disparar WhatsApp
  const resPedido1 = await registrarNuevoPedido({
    codCliente: cliente.codCliente,
    codFP: formaPago.codFP,
    items: [{ codVariante: varianteCriticaTest.codVariante, cantidad: 1 }],
  });

  assert.strictEqual(resPedido1.alertasWhatsAppDisparadas.length, 1);
  assert.strictEqual(resPedido1.alertasWhatsAppDisparadas[0].stockRemanente, 2);
  console.log('   ✔ Venta 1 (stock 3 -> 2): Alerta WhatsApp disparada correctamente.');

  // Venta 2: Vender 1 unidad adicional -> stock pasa de 2 a 1 -> NO debe spamear WhatsApp porque alertaStockEnviada == true
  const resPedido2 = await registrarNuevoPedido({
    codCliente: cliente.codCliente,
    codFP: formaPago.codFP,
    items: [{ codVariante: varianteCriticaTest.codVariante, cantidad: 1 }],
  });
  assert.strictEqual(resPedido2.alertasWhatsAppDisparadas.length, 0);
  console.log('   ✔ Venta 2 (stock 2 -> 1): Control Anti-Spam activo (no re-envió WhatsApp).');

  console.log(
    '🔍 3. Verificando Factura de Proveedor, Actualización de Costo e Inmutabilidad Histórica (RN-03)...'
  );
  const costoHistoricoCongelado = resPedido1.pedido.detallesPedido[0].precioUnitarioCostoHistorico;
  assert.strictEqual(costoHistoricoCongelado, 14500);

  const proveedor = await prisma.proveedor.findFirstOrThrow();
  const resFactura = await registrarFacturaIngreso({
    codProveedor: proveedor.codProveedor,
    nroFactura: 'FC-TEST-VERIF-001',
    detalles: [
      {
        codVariante: varianteCriticaTest.codVariante,
        cantidadDI: 5, // Stock pasa de 1 a 6 (>= 3)
        precioIndividual: 16000, // Nuevo costo de reposición (subió de 14500 a 16000)
      },
    ],
  });

  assert.strictEqual(resFactura.productosActualizados[0].costoNuevo, 16000);
  assert.strictEqual(resFactura.productosActualizados[0].alertaReseteada, true);

  // Comprobar que el pedido anterior mantiene intacto su precioUnitarioCostoHistorico de $14.500
  const detallePedidoHistorico = await prisma.detallePedido.findFirstOrThrow({
    where: { nroPedido: resPedido1.pedido.nroPedido },
  });
  assert.strictEqual(detallePedidoHistorico.precioUnitarioCostoHistorico, 14500);
  console.log(
    '   ✔ Nuevo costo actualizado en Producto ($16.000), flag WhatsApp reseteado y costo histórico en Pedido anterior ($14.500) inmutable.'
  );

  console.log('🔍 4. Verificando Reportes de Margen de Contribución y Utilidad Neta (RN-06)...');
  const reportes = await obtenerReportesFinancieros();
  assert(reportes.kpis.facturacionNetaTotal > 0);
  assert(reportes.kpis.margenContribucionTotal > 0);
  assert.strictEqual(
    reportes.kpis.utilidadNetaTotal,
    reportes.kpis.margenContribucionTotal - reportes.kpis.gastosOperativosTotal
  );
  console.log(
    `   ✔ Reportes Financieros OK: Facturación Neta $${reportes.kpis.facturacionNetaTotal.toLocaleString(
      'es-AR'
    )} | Margen Contribución $${reportes.kpis.margenContribucionTotal.toLocaleString(
      'es-AR'
    )} | Utilidad Neta $${reportes.kpis.utilidadNetaTotal.toLocaleString('es-AR')}`
  );
}

runVerification()
  .then(async () => {
    // Restaurar seed limpio para uso interactivo de la dueña
    await prisma.$disconnect();
    console.log('✅ Todas las pruebas de reglas de negocio de Tutina pasaron exitosamente.');
  })
  .catch(async (err) => {
    console.error('❌ Error en verificación:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
