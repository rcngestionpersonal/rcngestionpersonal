import type { Metadata } from 'next';
import { LEGAL_ENTITY, LEGAL_VERSIONS } from '@/lib/real-estate/legal';
import LegalCrossLinks from '../_components/LegalCrossLinks';
import LegalEntityBlock from '../_components/LegalEntityBlock';

export const metadata: Metadata = {
  title: 'Aviso de Cookies | Redinmo',
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-text sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Aviso de Cookies</h1>
        <p className="mt-2 text-sm text-text-2">
          Versión {LEGAL_VERSIONS.cookies} · última actualización el {LEGAL_VERSIONS.cookies}.
        </p>

        <div className="mt-8 space-y-7 text-sm leading-relaxed text-text-2">
          <LegalEntityBlock />

          <section>
            <p>
              Redinmo usa la mínima cantidad de cookies necesaria para funcionar. No usamos cookies de publicidad ni de
              rastreo de terceros, y no vendemos ni compartimos datos de navegación con nadie.
            </p>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">Qué usamos</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-text">Cookie de sesión</strong> (<code className="text-text-3">brokerhub_session</code>)
                — esencial, mantiene tu sesión iniciada. Es de tipo <em>httpOnly</em> (no accesible por scripts) y expira al
                cerrar sesión o pasado un tiempo de inactividad. Sin ella no puedes usar la plataforma.
              </li>
              <li>
                <strong className="text-text">Preferencia de tema</strong> (claro/oscuro) — se guarda en el almacenamiento
                local de tu navegador, no en una cookie, y no se comparte con Redinmo ni con nadie más. Solo recuerda cómo
                prefieres ver la interfaz.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-1.5 text-base font-bold text-text">Cómo rechazarlas</h2>
            <p>
              Como la cookie de sesión es esencial para iniciar sesión, no ofrecemos un interruptor de &quot;rechazar
              cookies&quot; dentro de la plataforma: si la bloqueas desde la configuración de tu navegador, simplemente no
              podrás mantener la sesión iniciada. Puedes borrar la cookie de sesión y el dato de preferencia de tema en
              cualquier momento desde la configuración de privacidad de tu navegador.
            </p>
          </section>

          <section>
            <p>
              Para más detalle sobre qué otros datos recogemos y por qué, consulta nuestra{' '}
              <a href="/legal/privacidad" className="font-semibold text-accent hover:underline">
                Política de Privacidad
              </a>
              . Dudas:{' '}
              <a href={`mailto:${LEGAL_ENTITY.correoContacto}`} className="font-semibold text-accent hover:underline">
                {LEGAL_ENTITY.correoContacto}
              </a>
              .
            </p>
          </section>
        </div>

        <LegalCrossLinks current="/legal/cookies" />
      </div>
    </main>
  );
}
