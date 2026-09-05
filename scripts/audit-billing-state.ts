// Auditoria de la base real antes de tocar los interruptores de facturacion
// (fase de cierre, punto 1.3). Es de solo lectura - no modifica nada - pero
// corre contra Neon (no hay base de test separada), asi que hace falta tener
// las variables de entorno de produccion cargadas (DATABASE_URL, etc.).
//
// Correr con: npx tsx scripts/audit-billing-state.ts
import { createPrismaClient } from '../src/lib/prisma-standalone';

const prisma = createPrismaClient();

function fmtDate(d: Date | null): string {
  return d ? d.toISOString() : '(sin fecha)';
}

async function main() {
  const subs = await prisma.subscription.findMany({
    include: {
      agent: { select: { id: true, fullName: true, phone: true, isTestUser: true } },
      paymentMethod: { select: { id: true, brand: true, lastDigits: true, active: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n=== Suscripciones por estado (${subs.length} en total) ===`);
  const porEstado = new Map<string, number>();
  for (const s of subs) {
    porEstado.set(s.status, (porEstado.get(s.status) ?? 0) + 1);
  }
  for (const [estado, count] of [...porEstado.entries()].sort()) {
    console.log(`  ${estado}: ${count}`);
  }

  console.log(`\n=== Suscripciones con nextChargeAt no nulo ===`);
  const conProximoCobro = subs.filter((s) => s.nextChargeAt !== null);
  if (conProximoCobro.length === 0) {
    console.log('  (ninguna)');
  }
  for (const s of conProximoCobro) {
    const testTag = s.agent.isTestUser ? ' [TEST]' : '';
    console.log(
      `  ${s.id} agent=${s.agent.fullName ?? s.agent.phone}${testTag} status=${s.status} nextChargeAt=${fmtDate(s.nextChargeAt)} claimedAt=${fmtDate(s.claimedAt)}`,
    );
  }

  console.log(`\n=== Suscripciones con PaymentMethod asociado ===`);
  const conTarjeta = subs.filter((s) => s.paymentMethodId !== null);
  if (conTarjeta.length === 0) {
    console.log('  (ninguna)');
  }
  for (const s of conTarjeta) {
    const testTag = s.agent.isTestUser ? ' [TEST]' : '';
    console.log(
      `  ${s.id} agent=${s.agent.fullName ?? s.agent.phone}${testTag} brand=${s.paymentMethod?.brand} ****${s.paymentMethod?.lastDigits} active=${s.paymentMethod?.active}`,
    );
  }

  console.log(`\n=== Charges en estado PENDING (posibles cobros a medio terminar) ===`);
  const pendientes = await prisma.charge.findMany({
    where: { status: 'PENDING' },
    include: { subscription: { include: { agent: { select: { fullName: true, phone: true, isTestUser: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (pendientes.length === 0) {
    console.log('  (ninguno)');
  }
  for (const c of pendientes) {
    const agent = c.subscription.agent;
    const testTag = agent.isTestUser ? ' [TEST]' : '';
    console.log(
      `  charge=${c.id} sub=${c.subscriptionId} agent=${agent.fullName ?? agent.phone}${testTag} periodKey=${c.periodKey} attempt=${c.attempt} fallosTecnicos=${c.unknownErrorCount} clientTransactionId=${c.clientTransactionId} creado=${fmtDate(c.createdAt)}`,
    );
  }

  // Los dos flags se cuentan por separado a proposito (ver la nota de
  // isTestAccount en schema.prisma): isTestUser esconde la cuenta del ranking,
  // isTestAccount le impide ser cobrada. Que los numeros no coincidan no es un
  // error, pero conviene mirarlo antes de encender la facturacion.
  const totalTestUsers = await prisma.agent.count({ where: { isTestUser: true } });
  const totalTestAccounts = await prisma.agent.count({ where: { isTestAccount: true } });
  const cobrablesMarcadasPrueba = await prisma.agent.count({ where: { isTestUser: true, isTestAccount: false } });

  console.log(`\n=== Cuentas de prueba ===`);
  console.log(`  isTestAccount=true (excluidas del cobro): ${totalTestAccounts}`);
  console.log(`  isTestUser=true (ocultas del ranking):    ${totalTestUsers}`);
  if (cobrablesMarcadasPrueba > 0) {
    console.log(`  OJO: ${cobrablesMarcadasPrueba} cuenta(s) marcadas isTestUser pero SI cobrables (isTestAccount=false)`);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`  Suscripciones totales: ${subs.length}`);
  console.log(`  Con nextChargeAt sembrado: ${conProximoCobro.length}`);
  console.log(`  Con tarjeta guardada: ${conTarjeta.length}`);
  console.log(`  Charges PENDING sin resolver: ${pendientes.length}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
