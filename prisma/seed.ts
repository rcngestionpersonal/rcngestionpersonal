import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.student.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.branch.deleteMany();

  const branches = await prisma.branch.createMany({
    data: [
      { name: 'Sede Norte', city: 'San Isidro', address: 'Av. Libertad 123', phone: '+54 9 11 1111-1111', coach: 'Diego Alvarez' },
      { name: 'Sede Sur', city: 'Lomas', address: 'Calle Rojo 45', phone: '+54 9 11 2222-2222', coach: 'Martín Pérez' },
      { name: 'Sede Este', city: 'Ituzaingó', address: 'Ruta 5 km 12', phone: '+54 9 11 3333-3333', coach: 'Lucas Gómez' },
      { name: 'Sede Oeste', city: 'Morón', address: 'Av. Libertador 987', phone: '+54 9 11 4444-4444', coach: 'Javier Ramírez' },
      { name: 'Sede Central', city: 'CABA', address: 'Calle Principal 1000', phone: '+54 9 11 5555-5555', coach: 'Rodrigo Díaz' }
    ]
  });

  const plans = await prisma.plan.createMany({
    data: [
      { name: 'Mensualidad Básica', description: 'Entrenamientos semanales y material grupal', type: 'monthly', amount: 25000, currency: 'ARS', interval: 'monthly' },
      { name: 'Matrícula', description: 'Pago único de inscripción', type: 'one-time', amount: 15000, currency: 'ARS', interval: 'one-time' },
      { name: 'Uniforme', description: 'Conjunto de camiseta y short oficial', type: 'one-time', amount: 12000, currency: 'ARS', interval: 'one-time' },
      { name: 'Torneo', description: 'Cuota por torneo especial', type: 'one-time', amount: 18000, currency: 'ARS', interval: 'one-time' }
    ]
  });

  const planRecords = await prisma.plan.findMany();
  const allBranches = await prisma.branch.findMany();

  const guardians = [];
  for (let i = 1; i <= 40; i++) {
    guardians.push({
      name: `Tutor ${i}`,
      whatsapp: `+5491110000${String(i).padStart(2, '0')}`,
      email: `tutor${i}@academiafutbol.com`,
      phone: `+54 11 6${String(i).padStart(8, '0')}`
    });
  }
  await prisma.guardian.createMany({ data: guardians });
  const guardiansRecords = await prisma.guardian.findMany();

  const students = [];
  let guardianIndex = 0;
  for (let branchIndex = 0; branchIndex < allBranches.length; branchIndex++) {
    const branch = allBranches[branchIndex];
    for (let studentIndex = 1; studentIndex <= 20; studentIndex++) {
      const guardian = guardiansRecords[guardianIndex++];
      students.push({
        firstName: `Alumno${branchIndex + 1}${studentIndex}`,
        lastName: `Apellido${studentIndex}`,
        birthDate: new Date(2012, studentIndex % 12, 10),
        category: studentIndex <= 10 ? 'Sub 12' : 'Sub 14',
        active: true,
        branchId: branch.id,
        guardianId: guardian.id,
        notes: studentIndex === 1 ? 'Alumno con potencial selector.' : undefined
      });
    }
  }
  await prisma.student.createMany({ data: students });
  const studentRecords = await prisma.student.findMany();

  const enrollmentData = studentRecords.map((student, index) => ({
    studentId: student.id,
    planId: planRecords.find(p => p.name === 'Mensualidad Básica')!.id,
    startDate: new Date(2026, 0, 1),
    active: true
  }));
  await prisma.enrollment.createMany({ data: enrollmentData });

  const charges = [];
  const today = new Date();
  for (const student of studentRecords) {
    const branch = allBranches.find(b => b.id === student.branchId)!;
    const guardian = guardiansRecords.find(g => g.id === student.guardianId)!;
    charges.push({
      branchId: branch.id,
      studentId: student.id,
      guardianId: guardian.id,
      planId: planRecords.find(p => p.name === 'Mensualidad Básica')!.id,
      description: 'Cobro mensualidad ' + today.toLocaleString('es-AR', { month: 'long' }),
      amount: 25000,
      currency: 'ARS',
      dueDate: new Date(today.getFullYear(), today.getMonth(), 10),
      status: 'pending'
    });
  }
  await prisma.charge.createMany({ data: charges });

  const samplePayments = studentRecords.slice(0, 20).map(student => ({
    chargeId: '',
    amount: 25000,
    currency: 'ARS',
    method: 'manual',
    reference: 'Pago directo',
    recordedBy: 'Coordinador'
  }));

  const pendingCharges = await prisma.charge.findMany({ where: { status: 'pending' } });
  for (let i = 0; i < Math.min(samplePayments.length, pendingCharges.length); i++) {
    const charge = pendingCharges[i];
    await prisma.payment.create({
      data: {
        chargeId: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        method: 'manual',
        reference: 'Pago de prueba',
        recordedBy: 'Coordinador'
      }
    });
    await prisma.charge.update({ where: { id: charge.id }, data: { status: 'paid', paidAt: new Date() } });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
