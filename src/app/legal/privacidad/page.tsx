import type { Metadata } from 'next';
import { LEGAL_ENTITY, LEGAL_VERSIONS } from '@/lib/real-estate/legal';
import LegalCrossLinks from '../_components/LegalCrossLinks';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Redinmo',
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-text sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Política de Privacidad y Tratamiento de Datos</h1>
        <p className="mt-2 text-sm text-text-2">
          Versión {LEGAL_VERSIONS.privacidad} · última actualización el {LEGAL_VERSIONS.privacidad}.
        </p>
        <p className="mt-2 text-xs text-text-3">
          Este documento no sustituye asesoría legal. Su forma final, especialmente el tratamiento de la cédula y de los datos
          de tarjeta, debe ser revisada por un abogado antes de considerarse definitiva.
        </p>

        <div className="mt-8 space-y-7 text-sm leading-relaxed text-text-2">
          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">1. Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos personales recogidos a través de Redinmo.io es{' '}
              <strong className="text-text">{LEGAL_ENTITY.razonSocial}</strong> (RUC {LEGAL_ENTITY.ruc}), con domicilio en{' '}
              {LEGAL_ENTITY.domicilio}, Ecuador. Para cualquier consulta sobre esta política o para ejercer tus derechos,
              escríbenos a{' '}
              <a href={`mailto:${LEGAL_ENTITY.correoContacto}`} className="font-semibold text-accent hover:underline">
                {LEGAL_ENTITY.correoContacto}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">2. Qué datos recogemos</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-text">Identificación del agente:</strong> nombre completo, cédula o RUC, número de
                licencia profesional (si aplica).
              </li>
              <li>
                <strong className="text-text">Contacto:</strong> teléfono, correo electrónico, dirección profesional.
              </li>
              <li>
                <strong className="text-text">Datos de pago:</strong> un identificador cifrado de tu tarjeta (token) entregado
                por Payphone, marca y últimos 4 dígitos, historial de cobros. Redinmo nunca almacena el número completo de
                tarjeta, CVV ni la fecha de expiración: esos datos los procesa Payphone directamente.
              </li>
              <li>
                <strong className="text-text">Datos de los inmuebles:</strong> dirección, características, fotografías, precio
                y estado de la publicación.
              </li>
              <li>
                <strong className="text-text">Datos de clientes finales:</strong> cuando un agente registra un pedido, puede
                incluir nombre, teléfono y preferencias de búsqueda de su cliente. Estos datos los ingresa el agente, no
                nosotros; ver la sección 9 sobre su tratamiento.
              </li>
              <li>
                <strong className="text-text">Datos de uso:</strong> registros técnicos básicos (fecha, hora, dirección IP) que
                se generan al usar la plataforma, usados para seguridad y para el registro de consentimientos.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">3. Finalidad y base legal</h2>
            <p>
              Tratamos tus datos para: (a) crear y administrar tu cuenta de agente, con base en la ejecución del contrato de
              servicio (estos Términos); (b) procesar tu suscripción y los cobros recurrentes, también con base contractual y
              con tu consentimiento expreso para el cobro automático; (c) verificar tu identidad como agente, con base en
              nuestro interés legítimo de mantener la confianza de la comunidad; (d) enviarte notificaciones operativas (avisos
              de cobro, cambios de estado), con base contractual; y (e) cumplir obligaciones legales y tributarias.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">4. Conservación de datos</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Si tu cuenta pasa a modo lectura (por falta de pago) o
              cancelas la suscripción, tus datos e información (inmuebles, pedidos, matches, historial) se conservan, no se
              eliminan, por si decides reactivar más adelante. Los registros de cobros y comprobantes se conservan además por
              el plazo que exige la normativa tributaria ecuatoriana. Si solicitas la eliminación de tu cuenta, la
              procesaremos conforme al procedimiento de la sección 5, salvo la información que debamos conservar por
              obligación legal (por ejemplo, comprobantes de pago).
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">5. Tus derechos</h2>
            <p>
              Como titular de tus datos, tienes derecho a acceder a ellos, rectificarlos si son inexactos, solicitar su
              eliminación, oponerte a un tratamiento específico, pedir su portabilidad a otro proveedor y solicitar la
              suspensión temporal de su tratamiento. Puedes ejercer cualquiera de estos derechos escribiendo a{' '}
              <a href={`mailto:${LEGAL_ENTITY.correoContacto}`} className="font-semibold text-accent hover:underline">
                {LEGAL_ENTITY.correoContacto}
              </a>{' '}
              indicando tu solicitud y el dato involucrado. Responderemos en un plazo razonable, conforme a los términos que
              establece la Ley Orgánica de Protección de Datos Personales del Ecuador.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">6. Con quién compartimos tus datos</h2>
            <p>No vendemos tus datos. Los compartimos únicamente con los proveedores que necesitamos para operar el servicio:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong className="text-text">Payphone</strong> — procesamiento de pagos y tokenización de tarjeta.
              </li>
              <li>
                <strong className="text-text">Proveedor de hosting e infraestructura</strong> (Vercel) — aloja la aplicación.
              </li>
              <li>
                <strong className="text-text">Proveedor de base de datos</strong> (Neon) — almacena la información de la
                plataforma.
              </li>
              <li>
                <strong className="text-text">Proveedor de correo</strong> (Resend) — envío de notificaciones transaccionales.
              </li>
              <li>Un facturador electrónico, cuando esté habilitado, para emitir comprobantes de pago.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">7. Transferencias internacionales</h2>
            <p>
              Nuestro proveedor de base de datos y de hosting operan con infraestructura ubicada fuera de Ecuador (Estados
              Unidos). Esto implica que tus datos se almacenan y procesan en servidores fuera del país. Estos proveedores
              cuentan con medidas de seguridad estándar de la industria; al usar Redinmo, aceptas esta transferencia
              internacional de datos necesaria para operar el servicio.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">8. Medidas de seguridad</h2>
            <p>
              Aplicamos medidas técnicas razonables para proteger tus datos: contraseñas almacenadas con hash (nunca en texto
              plano), el identificador de tu tarjeta cifrado en reposo con una clave propia distinta de la que usa Payphone,
              conexiones cifradas (HTTPS) en toda la plataforma, y acceso restringido a la información según el rol de cada
              usuario. Ningún sistema es 100% infalible; si detectamos una brecha que afecte tus datos, te lo notificaremos
              conforme a la ley aplicable.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">9. Datos de clientes finales cargados por el agente</h2>
            <p>
              Cuando un agente registra un pedido, incluye datos de una persona (su cliente) que no ha interactuado
              directamente con Redinmo ni aceptado estos documentos. Por eso, nuestros{' '}
              <a href="/legal/terminos" className="font-semibold text-accent hover:underline">
                Términos y Condiciones
              </a>{' '}
              exigen que el agente cuente con la autorización de ese cliente antes de cargar sus datos. Redinmo trata esos
              datos únicamente para el fin de facilitar el match y el contacto entre agentes, con la misma diligencia y
              medidas de seguridad que el resto de la información de la plataforma, y los conserva mientras el pedido o la
              cuenta del agente esté activa.
            </p>
          </section>
        </div>

        <LegalCrossLinks current="/legal/privacidad" />
      </div>
    </main>
  );
}
