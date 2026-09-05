// Marca isTestAccount=true en las cuentas que no deben cobrarse nunca (fase
// de cierre, punto 3). Idempotente: correrlo de nuevo no cambia nada.
//
// Criterio:
//  - Toda cuenta ya marcada isTestUser=true (las cuentas de QA creadas
//    durante el desarrollo, que por definicion son de prueba).
//  - "Lex Lutor": un registro de prueba del propio dueño que quedo con
//    isTestUser=false y un Charge PENDING de un checkout abandonado.
//
// NO borra nada: las cuentas se conservan porque se necesitan para probar.
//
// Correr con: npx tsx --env-file=.env scripts/mark-test-accounts.ts
import { createPrismaClient } from '../src/lib/prisma-standalone';

const prisma = createPrismaClient();

async function main() {
  const porFlagQa = await prisma.agent.updateMany({
    where: { isTestUser: true, isTestAccount: false },
    data: { isTestAccount: true },
  });

  const lexLutor = await prisma.agent.updateMany({
    where: { fullName: { contains: 'Lex Lutor' }, isTestAccount: false },
    data: { isTestAccount: true },
  });

  const marcadas = await prisma.agent.findMany({
    where: { isTestAccount: true },
    select: { id: true, fullName: true, phone: true, isTestUser: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nMarcadas ahora por isTestUser: ${porFlagQa.count}`);
  console.log(`Marcadas ahora por nombre (Lex Lutor): ${lexLutor.count}`);
  console.log(`\n=== Cuentas excluidas del cobro (isTestAccount=true): ${marcadas.length} ===`);
  for (const a of marcadas) {
    console.log(`  ${a.id}  ${a.fullName ?? a.phone}${a.isTestUser ? '' : '  [no marcada como isTestUser]'}`);
  }
  console.log('');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
