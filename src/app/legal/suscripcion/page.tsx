import type { Metadata } from 'next';
import { TRIAL_DAYS } from '@/lib/real-estate/subscription-config';
import { PLANES, formatUsd } from '@/config/planes';
import { LEGAL_ENTITY, LEGAL_VERSIONS } from '@/lib/real-estate/legal';
import LegalCrossLinks from '../_components/LegalCrossLinks';

export const metadata: Metadata = {
  title: 'Política de Suscripción y Cobros | Redinmo',
};

export default function SuscripcionPage() {
  const basico = PLANES.BASICO;
  const pro = PLANES.PRO;

  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-text sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Política de Suscripción, Cobros y Cancelación</h1>
        <p className="mt-2 text-sm text-text-2">
          Versión {LEGAL_VERSIONS.suscripcion} · última actualización el {LEGAL_VERSIONS.suscripcion}.
        </p>

        <div className="mt-8 space-y-7 text-sm leading-relaxed text-text-2">
          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">1. Planes y precios</h2>
            <p>
              Redinmo ofrece dos planes: Básico (${formatUsd(basico.precioBase)} + IVA (${formatUsd(basico.impuesto)}) = $
              {formatUsd(basico.total)} cada 30 días) y Pro (${formatUsd(pro.precioBase)} + IVA (${formatUsd(pro.impuesto)}) = $
              {formatUsd(pro.total)} cada 30 días). Los precios se muestran sin IVA hasta el momento del cobro, cuando se
              calcula sobre la tarifa vigente en Ecuador.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">2. Prueba gratuita</h2>
            <p>
              Toda cuenta nueva inicia con {TRIAL_DAYS} días de prueba gratuita, con acceso completo al plan Pro sin necesidad
              de ingresar ningún dato de pago. Al terminar la prueba, debes elegir un plan y guardar una tarjeta para seguir
              usando la plataforma; si no lo haces, tu cuenta pasa a modo lectura conforme a la sección 5.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">3. Cobro automático recurrente</h2>
            <p>
              Al guardar una tarjeta para pagar tu plan, autorizas expresamente a Redinmo a cobrar automáticamente, cada 30
              días, el monto correspondiente a tu plan vigente, sin necesidad de una nueva autorización en cada ciclo, hasta
              que canceles tu suscripción. Redinmo nunca almacena el número completo de tu tarjeta: guarda únicamente un
              identificador cifrado (token) que Payphone entrega tras la primera autorización.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">4. Aviso previo al cobro</h2>
            <p>
              Te avisamos por correo con <strong className="text-text">3 días de anticipación</strong> a cada cobro
              automático, indicando el monto y la fecha exacta, para que puedas cambiar de tarjeta o cancelar antes si lo
              deseas.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">5. Si un cobro es rechazado</h2>
            <p>
              Si el banco rechaza un cobro, tu cuenta pasa a estado <strong className="text-text">Pago pendiente</strong>, con
              el mismo nivel de acceso que una cuenta al día — no se interrumpe el servicio de inmediato. Reintentamos el
              cobro automáticamente a los <strong className="text-text">3 y 7 días</strong> del primer rechazo. Si el tercer
              intento (día 7) también es rechazado, tu cuenta pasa a{' '}
              <strong className="text-text">modo lectura</strong>: se bloquean las funciones que requieren un plan pago, pero
              toda tu información (inmuebles, pedidos, matches, historial) se conserva intacta, lista para reactivarse en
              cuanto actualices tu método de pago.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">6. Cómo cancelar</h2>
            <p>
              Puedes cancelar tu suscripción en cualquier momento desde tu cuenta, en la sección Suscripción. La cancelación{' '}
              <strong className="text-text">nunca es inmediata</strong>: conservas acceso completo hasta el final del período
              de 30 días que ya pagaste, y no se realiza ningún cobro adicional después de eso.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">7. Reembolsos</h2>
            <p>
              Un cobro solo puede revertirse automáticamente <strong className="text-text">el mismo día</strong> en que se
              realizó, por una limitación técnica del procesador de pagos. Pasado ese día, cualquier reembolso deja de ser
              automático y se convierte en un{' '}
              <strong className="text-text">trámite manual</strong> que evaluamos caso por caso, escribiendo a{' '}
              <a href={`mailto:${LEGAL_ENTITY.correoContacto}`} className="font-semibold text-accent hover:underline">
                {LEGAL_ENTITY.correoContacto}
              </a>
              . No podemos garantizar un plazo fijo de resolución para un reembolso manual, y preferimos decirlo con claridad
              en vez de prometer una devolución inmediata que no siempre es técnicamente posible.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">8. Modo lectura y tus datos</h2>
            <p>
              Una cuenta en modo lectura (por falta de pago o tras cancelar) mantiene toda su información guardada: inmuebles,
              pedidos, matches y el historial completo de cobros. Nada se elimina por dejar de pagar; reactivar el plan
              restablece el acceso normal de inmediato.
            </p>
          </section>
        </div>

        <LegalCrossLinks current="/legal/suscripcion" />
      </div>
    </main>
  );
}
