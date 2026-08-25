import type { Metadata } from 'next';
import Link from 'next/link';
import { getPriceAmountUsd, getPriceWithTaxUsd, getTaxAmountUsd, TRIAL_DAYS } from '@/lib/real-estate/subscription-config';

export const metadata: Metadata = {
  title: 'Política de Cancelación | Redinmo',
};

function fmtUsd(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

export default function PoliticaCancelacionPage() {
  const price = getPriceAmountUsd();
  const tax = getTaxAmountUsd();
  const total = getPriceWithTaxUsd();

  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-text sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Política de Cancelación</h1>
        <p className="mt-2 text-sm text-text-2">Última actualización: agosto de 2026.</p>

        <div className="mt-8 space-y-7 text-sm leading-relaxed text-text-2">
          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">1. Prueba gratuita</h2>
            <p>
              Toda cuenta nueva de agente en Redinmo.io inicia con {TRIAL_DAYS} días de prueba gratuita, con acceso completo a la
              plataforma. No se solicita tarjeta de crédito ni ningún dato de pago para activar la prueba.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">2. Suscripción mensual</h2>
            <p>
              Al finalizar la prueba gratuita, para continuar usando Redinmo se activa la suscripción mensual de ${fmtUsd(price)} +
              IVA (${fmtUsd(tax)}) = ${fmtUsd(total)}, procesada de forma segura por Payphone. Redinmo no almacena los datos de tu
              tarjeta en ningún momento.
            </p>
            <p className="mt-2">
              Cada pago habilita el acceso a la plataforma por 30 días adicionales a partir de la fecha del cobro. La suscripción no
              se renueva automáticamente: recibirás un aviso antes de que tu período pagado termine para que puedas renovar cuando
              quieras.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">3. Cómo cancelar</h2>
            <p>
              No hay ningún compromiso de permanencia ni proceso de baja que tramitar: simplemente no realices el siguiente pago
              mensual y tu cuenta dejará de renovarse. Conservarás acceso hasta el final del período ya pagado, y tu información
              (inmuebles, pedidos, matches e historial) permanece guardada por si decides reactivar más adelante.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">4. Reembolsos</h2>
            <p>
              Los pagos procesados no son reembolsables una vez confirmados, dado que habilitan acceso inmediato a la plataforma por
              el período de 30 días correspondiente. Si tuviste un problema con un cobro, escríbenos y lo revisamos caso por caso.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">5. Contacto</h2>
            <p>
              Cualquier duda sobre tu suscripción o un cobro, escríbenos a{' '}
              <a href="mailto:notificaciones@redinmo.io" className="font-semibold text-accent hover:underline">
                notificaciones@redinmo.io
              </a>
              .
            </p>
          </section>
        </div>

        <Link href="/agentes/suscripcion/pagar" className="mt-8 inline-block text-sm font-semibold text-text-3 hover:text-text-2">
          ← Volver a mi suscripción
        </Link>
      </div>
    </main>
  );
}
