'use client';

import { useEffect, useState } from 'react';

type Branch = { id: string; name: string; city: string; coach?: string };
type Charge = { id: string; description: string; amount: number; dueDate: string; status: string; branch: Branch; student: { firstName: string; lastName: string; }; guardian: { name: string; whatsapp: string; }; };

type DashboardData = {
  totalBranches: number;
  totalStudents: number;
  totalPending: number;
  totalPaid: number;
  topBranches: { name: string; pending: number; }[];
};

const mockBranches: Branch[] = [
  { id: '1', name: 'Sede Norte', city: 'San Isidro', coach: 'Diego Alvarez' },
  { id: '2', name: 'Sede Sur', city: 'Lomas', coach: 'Martín Pérez' },
  { id: '3', name: 'Sede Este', city: 'Ituzaingó', coach: 'Lucas Gómez' },
  { id: '4', name: 'Sede Oeste', city: 'Morón', coach: 'Javier Ramírez' },
  { id: '5', name: 'Sede Central', city: 'CABA', coach: 'Rodrigo Díaz' }
];

const mockCharges: Charge[] = [
  { id: '1', description: 'Mensualidad Junio', amount: 25000, dueDate: '2026-06-10', status: 'pending', branchId: '1', studentId: 's1', guardianId: 'g1', planId: 'p1', branch: mockBranches[0], student: { firstName: 'Juan', lastName: 'Perez' }, guardian: { name: 'Tutor 1', whatsapp: '+5491110000001' } },
  { id: '2', description: 'Mensualidad Junio', amount: 25000, dueDate: '2026-06-10', status: 'pending', branchId: '2', studentId: 's2', guardianId: 'g2', planId: 'p1', branch: mockBranches[1], student: { firstName: 'María', lastName: 'García' }, guardian: { name: 'Tutor 2', whatsapp: '+5491110000002' } },
  { id: '3', description: 'Uniforme', amount: 12000, dueDate: '2026-07-01', status: 'pending', branchId: '3', studentId: 's3', guardianId: 'g3', planId: 'p3', branch: mockBranches[2], student: { firstName: 'Carlos', lastName: 'López' }, guardian: { name: 'Tutor 3', whatsapp: '+5491110000003' } },
  { id: '4', description: 'Mensualidad Junio', amount: 25000, dueDate: '2026-06-10', status: 'paid', branchId: '4', studentId: 's4', guardianId: 'g4', planId: 'p1', branch: mockBranches[3], student: { firstName: 'Pedro', lastName: 'Martínez' }, guardian: { name: 'Tutor 4', whatsapp: '+5491110000004' } },
  { id: '5', description: 'Torneo Regional', amount: 18000, dueDate: '2026-07-05', status: 'pending', branchId: '5', studentId: 's5', guardianId: 'g5', planId: 'p4', branch: mockBranches[4], student: { firstName: 'Diego', lastName: 'Rodríguez' }, guardian: { name: 'Tutor 5', whatsapp: '+5491110000005' } }
];

export default function Home() {
  const [branches, setBranches] = useState<Branch[]>(mockBranches);
  const [charges, setCharges] = useState<Charge[]>(mockCharges);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // For MVP development, using mock data directly
    // In production, this would fetch from real API
    setDashboard({
      totalBranches: mockBranches.length,
      totalStudents: 100,
      totalPending: mockCharges.filter(c => c.status === 'pending').length,
      totalPaid: mockCharges.filter(c => c.status === 'paid').length,
      topBranches: mockBranches.slice(0, 3).map((branch, idx) => ({ name: branch.name, pending: Math.floor(Math.random() * 12) + 3 })),
    });
    setLoading(false);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Cobranza Academy</h1>
          <p className="mt-2 text-slate-600">MVP de gestión de cobranzas para academias de fútbol con múltiples sedes.</p>
        </div>

        {loading ? (
          <div className="rounded-xl bg-white p-8 shadow-sm">Cargando...</div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-700">{error}</div>
        ) : (
          <>
            <section className="grid gap-6 mb-8 lg:grid-cols-4">
              <Card title="Sedes" value={dashboard?.totalBranches ?? 0} />
              <Card title="Alumnos aproximados" value={dashboard?.totalStudents ?? 0} />
              <Card title="Cobros pendientes" value={dashboard?.totalPending ?? 0} />
              <Card title="Pagos registrados" value={dashboard?.totalPaid ?? 0} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Cobros pendientes</h2>
                <div className="space-y-4">
                  {charges.map((charge) => (
                    <div key={charge.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{charge.description}</p>
                          <p className="text-sm text-slate-500">{charge.branch.name} · {charge.student.firstName} {charge.student.lastName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">ARS {charge.amount.toLocaleString()}</p>
                          <p className="text-sm text-slate-500">Vence {new Date(charge.dueDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Resumen por sede</h2>
                <div className="space-y-3">
                  {dashboard?.topBranches.map((branch) => (
                    <div key={branch.name} className="rounded-2xl border border-slate-200 p-4">
                      <p className="font-semibold text-slate-900">{branch.name}</p>
                      <p className="text-sm text-slate-500">Cobros pendientes: {branch.pending}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-3">
              <ActionCard title="Registrar alumno" description="Alta rápida de alumno y apoderado" buttonText="Ir" />
              <ActionCard title="Generar cobro" description="Crear pago mensual o extra" buttonText="Ir" />
              <ActionCard title="Registrar pago" description="Marcar cobro como pagado" buttonText="Ir" />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ActionCard({ title, description, buttonText }: { title: string; description: string; buttonText: string }) {
  return (
    <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-slate-300">{description}</p>
      <button className="mt-4 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">{buttonText}</button>
    </div>
  );
}
