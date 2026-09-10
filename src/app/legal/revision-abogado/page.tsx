import type { Metadata } from 'next';

// Orientación sobre cuándo conviene que un abogado revise un documento
// (punto 4.6). Es una página de criterio, no un directorio: aquí NO se
// recomiendan despachos concretos, no se ofrece el servicio y no se deriva a
// nadie. Solo se explica cómo decidir.
export const metadata: Metadata = {
  title: '¿Necesitas que un abogado lo revise? | Redinmo.io',
  description:
    'Cuándo conviene que un profesional del derecho revise un contrato inmobiliario antes de firmarlo, y qué preguntarle.',
};

const CUANDO_SI = [
  {
    titulo: 'El monto es significativo para las partes',
    detalle:
      'No hay una cifra mágica. La pregunta útil es otra: si esta operación sale mal, ¿cuánto le duele a tu cliente? Cuando la respuesta es "mucho", la revisión cuesta una fracción de lo que está en juego.',
  },
  {
    titulo: 'Hay algo fuera de lo habitual en la propiedad',
    detalle:
      'Hipoteca vigente, patrimonio familiar, herencia sin partición, usufructo, copropietarios que no comparecen, litigios, construcción sin regularizar o linderos que no cuadran con la escritura.',
  },
  {
    titulo: 'Alguien firma por otro',
    detalle:
      'Poderes, representación de una empresa, apoderados en el exterior o herederos. Que el poder exista no basta: tiene que alcanzar para este acto en concreto.',
  },
  {
    titulo: 'El pago no es simple',
    detalle:
      'Crédito hipotecario, pagos en cuotas, permutas, parte del precio en otro bien, dinero que viene del exterior o un tercero que paga por el comprador.',
  },
  {
    titulo: 'Las partes pactaron algo que el modelo no contempla',
    detalle:
      'Si en la negociación acordaron una condición particular —una entrega diferida, una reparación previa, una penalidad distinta— eso necesita redacción propia. Un campo del formulario no siempre alcanza.',
  },
  {
    titulo: 'Es un arrendamiento',
    detalle:
      'El arrendamiento urbano se rige por normas que las partes no pueden cambiar libremente, y en varios cantones el contrato debe registrarse ante la autoridad competente. Es el tipo de documento donde una revisión evita más problemas.',
  },
];

const QUE_PREGUNTAR = [
  '¿Este documento dice lo que las partes acordaron de verdad?',
  '¿Falta alguna cláusula que en esta operación concreta haría falta?',
  '¿Hay algo aquí que sea nulo, inaplicable o contrario a una norma imperativa?',
  '¿Qué pasa, según este texto, si una de las partes incumple?',
  '¿Este documento necesita elevarse a escritura pública o registrarse en alguna parte?',
];

export default function RevisionAbogadoPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-text sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">¿Necesitas que un abogado lo revise?</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-2">
          Los documentos que genera Redinmo son modelos referenciales: están redactados con base en la práctica habitual del
          mercado inmobiliario ecuatoriano, pero no conocen tu operación. Esta página te ayuda a decidir cuándo esa diferencia
          importa.
        </p>
        <p className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[13.5px] leading-relaxed text-text-2">
          La respuesta corta: una revisión legal nunca sobra, y hay casos en los que directamente no es opcional. Abajo están
          esos casos.
        </p>

        <section className="mt-9">
          <h2 className="text-lg font-bold text-text">Cuándo conviene, sin dudarlo</h2>
          <ul className="mt-4 space-y-4">
            {CUANDO_SI.map((caso) => (
              <li key={caso.titulo} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm font-bold text-text">{caso.titulo}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{caso.detalle}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-9">
          <h2 className="text-lg font-bold text-text">Qué pedirle que mire</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            Llegar con preguntas concretas hace la revisión más corta y más barata. Estas cinco cubren casi todo:
          </p>
          <ul className="mt-4 space-y-2">
            {QUE_PREGUNTAR.map((pregunta) => (
              <li key={pregunta} className="flex gap-3 text-[13.5px] leading-relaxed text-text-2">
                <span aria-hidden="true" className="text-accent">
                  ·
                </span>
                <span>{pregunta}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13.5px] leading-relaxed text-text-2">
            Descarga el borrador en PDF desde el módulo de contratos y envíaselo tal cual. Es el mismo texto que van a leer las
            partes cuando les llegue el enlace de firma.
          </p>
        </section>

        <section className="mt-9">
          <h2 className="text-lg font-bold text-text">Qué no hacemos</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            Redinmo no presta asesoría legal, no revisa documentos, no recomienda profesionales concretos ni intermedia en su
            contratación. No somos parte de los contratos que generas: la responsabilidad por su contenido y sus efectos es de
            quienes los suscriben. La elección del profesional es tuya y de tu cliente.
          </p>
        </section>

        <p className="mt-10 text-[11.5px] text-text-3">
          <a href="/legal/terminos" className="hover:underline">
            Términos y Condiciones
          </a>
        </p>
      </div>
    </main>
  );
}
