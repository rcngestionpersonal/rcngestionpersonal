import type { Metadata } from 'next';
import { LEGAL_ENTITY, LEGAL_VERSIONS } from '@/lib/real-estate/legal';
import LegalCrossLinks from '../_components/LegalCrossLinks';
import LegalEntityBlock from '../_components/LegalEntityBlock';

export const metadata: Metadata = {
  title: 'Términos y Condiciones | Redinmo.io',
};

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-text sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Términos y Condiciones</h1>
        <p className="mt-2 text-sm text-text-2">
          Versión {LEGAL_VERSIONS.terminos} · última actualización el {LEGAL_VERSIONS.terminos}.
        </p>
        <p className="mt-2 text-xs text-text-3">
          Este documento no sustituye asesoría legal. El texto vigente fue preparado como base operativa; su forma final debe ser
          revisada por un abogado antes de considerarse definitivo.
        </p>

        <div className="mt-8 space-y-7 text-sm leading-relaxed text-text-2">
          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">1. Quién presta el servicio</h2>
            <LegalEntityBlock />
            <p className="mt-3">
              En adelante nos referimos al operador como &quot;Redinmo.io&quot;, &quot;la plataforma&quot; o
              &quot;nosotros&quot;. Al crear una cuenta o usar la plataforma, aceptas estos Términos y nuestra{' '}
              <a href="/legal/privacidad" className="font-semibold text-accent hover:underline">
                Política de Privacidad
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">2. Qué es Redinmo.io y qué no</h2>
            <p>
              Redinmo.io es una herramienta de intermediación entre agentes inmobiliarios: permite publicar inmuebles, registrar
              pedidos de clientes, encontrar coincidencias (matches) entre ambos y coordinar el contacto entre agentes. Redinmo.io{' '}
              <strong className="text-text">no participa</strong> en la negociación, el cierre ni la firma de ninguna operación
              inmobiliaria, y <strong className="text-text">no garantiza</strong> que un match se convierta en un cierre, ni un
              nivel determinado de ingresos, contactos o resultados para ningún agente. El uso de la plataforma es una
              herramienta de trabajo, no una promesa de negocio.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">3. Cuenta de agente verificado</h2>
            <p>
              Para registrarte como agente debes proporcionar información real y verificable: nombre completo, cédula o RUC,
              teléfono, correo y, si aplica, número de licencia profesional. Redinmo.io puede solicitar verificación adicional en
              cualquier momento. Una cuenta puede suspenderse o cancelarse, sin previo aviso en casos graves, cuando: (a) se
              detecte información falsa o suplantación de identidad; (b) se publique contenido fraudulento, engañoso o que
              vulnere derechos de terceros; (c) se incumplan estos Términos de forma reiterada; o (d) exista una orden de
              autoridad competente.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">4. Contenido cargado por el agente</h2>
            <p>
              Todo contenido que cargues en Redinmo.io —inmuebles, fotografías, descripciones, precios y pedidos de clientes— es de
              tu exclusiva responsabilidad. Al publicar un inmueble, declaras que: (a) la información y el precio son veraces al
              momento de publicarlos; (b) cuentas con la autorización del propietario para publicar ese inmueble y sus
              fotografías; y (c), al cargar un pedido de un cliente final, cuentas con la autorización de ese cliente para
              registrar y tratar sus datos en la plataforma conforme a lo descrito en nuestra{' '}
              <a href="/legal/privacidad" className="font-semibold text-accent hover:underline">
                Política de Privacidad
              </a>
              . Redinmo.io puede remover contenido que incumpla esto sin previo aviso.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">5. Mapa de precios de cierre</h2>
            <p>
              Los datos del mapa de precios de cierre (montos, zonas y fechas de operaciones cerradas) son aportados
              voluntariamente por los propios agentes de la comunidad y se muestran únicamente como referencia de mercado.
              Redinmo.io no verifica, audita ni garantiza la exactitud, actualidad o representatividad de esos datos.{' '}
              <strong className="text-text">
                Ninguna decisión económica, de fijación de precio o de inversión debe tomarse basándose exclusivamente en el
                mapa de precios de cierre
              </strong>
              ; Redinmo.io no asume responsabilidad por pérdidas derivadas de su uso como única fuente de análisis.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">6. Propiedad intelectual</h2>
            <p>
              El software, diseño, marca, logotipos y demás elementos de la plataforma son propiedad de{' '}
              {LEGAL_ENTITY.razonSocial}{' '}
              o de sus licenciantes. Se te concede una licencia limitada, no exclusiva e intransferible para usar la plataforma
              conforme a estos Términos, mientras tu cuenta esté activa. El contenido que tú cargas (inmuebles, fotos, pedidos)
              sigue siendo tuyo o de quien corresponda; al publicarlo, nos concedes una licencia para almacenarlo, mostrarlo y
              procesarlo dentro de la plataforma con el único fin de operar el servicio.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">7. Suscripción y pagos</h2>
            <p>
              El uso continuado de Redinmo.io más allá del período de prueba requiere una suscripción paga. Los detalles de
              planes, precios, cobro automático, reintentos, cancelación y reembolsos están descritos en la{' '}
              <a href="/legal/suscripcion" className="font-semibold text-accent hover:underline">
                Política de Suscripción, Cobros y Cancelación
              </a>
              , que forma parte integral de estos Términos.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">8. Ley aplicable y controversias</h2>
            <p>
              Estos Términos se rigen por las leyes de la República del Ecuador. Cualquier controversia derivada de su
              interpretación o cumplimiento se someterá, en primer lugar, a un intento de solución directa entre las partes; de
              no lograrse, a los jueces competentes del domicilio de {LEGAL_ENTITY.razonSocial} en Ecuador, o a mediación/
              arbitraje si ambas partes lo acuerdan expresamente.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">9. Cambios a estos Términos</h2>
            <p>
              Podemos actualizar estos Términos cuando cambie el servicio o lo exija la ley. Cada versión publicada indica su
              fecha de vigencia en la parte superior de esta página. Si un cambio es sustancial, lo notificaremos por correo o
              dentro de la plataforma y, cuando corresponda, pediremos una nueva aceptación antes de que puedas seguir usando
              tu cuenta.
            </p>
          </section>
        </div>

        <LegalCrossLinks current="/legal/terminos" />
      </div>
    </main>
  );
}
