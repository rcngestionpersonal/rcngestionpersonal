import type { Metadata } from 'next';

// Guion para que el agente presente el documento a su cliente.
//
// Es material de APOYO COMERCIAL, no legal. No explica derecho: explica cómo
// hablar. Existe porque un agente que no sabe cómo presentar el documento
// termina disculpándose por él, y un contrato presentado con disculpas se firma
// peor que uno presentado con seguridad.
//
// Por eso aquí no hay advertencias. La orientación sobre cuándo conviene un
// abogado vive en /legal/revision-abogado, que es otra conversación.
export const metadata: Metadata = {
  title: 'Cómo explicarle el contrato a tu cliente | Redinmo.io',
  description: 'Guion para presentar el documento con seguridad y responder las preguntas que suelen aparecer.',
};

const PREGUNTAS = [
  {
    pregunta: '"¿Esto lo hiciste tú o es un formato?"',
    respuesta:
      'Es un modelo estándar, y eso es una ventaja. Está armado con las cláusulas que se usan en este tipo de operaciones, no improvisado para tu caso. Lo que sí es tuyo son las condiciones: el monto, el plazo y lo que acordamos.',
  },
  {
    pregunta: '"¿No debería verlo un abogado?"',
    respuesta:
      'Puedes hacerlo y me parece bien. Te paso el PDF ahora mismo para que se lo envíes. No hay prisa por firmar hoy.',
  },
  {
    pregunta: '"¿Firmar por internet vale igual?"',
    respuesta:
      'Sí. La ley ecuatoriana reconoce la firma electrónica, y el documento queda con la constancia de quién firmó, cuándo y desde dónde. Es más rastreable que una firma en papel.',
  },
  {
    pregunta: '"¿Y si me arrepiento?"',
    respuesta:
      'Está previsto en el documento. Léelo conmigo, es la cláusula que dice qué pasa si alguna de las partes se retira. La escribimos así justamente para que nadie tenga que averiguarlo después.',
  },
  {
    pregunta: '"¿Por qué necesito firmar esto ahora?"',
    respuesta:
      'Porque lo que acordamos de palabra no obliga a nadie. Esto deja por escrito el precio, el plazo y las condiciones, y te protege a ti tanto como a la otra parte.',
  },
];

const REGLAS = [
  {
    titulo: 'Preséntalo, no lo justifiques',
    detalle:
      'La diferencia está en la primera frase. "Este es el modelo que usamos" transmite oficio. "Es un formato nomás, pero…" transmite que ni tú confías en él.',
  },
  {
    titulo: 'Manda el PDF antes de pedir la firma',
    detalle:
      'Que lo lea sin sentir que decide en el momento. Quien firma con calma reclama menos después, y tú te ahorras la conversación incómoda.',
  },
  {
    titulo: 'Léele las tres cláusulas que importan',
    detalle:
      'El monto, el plazo y qué pasa si alguien se retira. Son las que generan conflicto. Si las repasas en voz alta, dejan de ser letra chica.',
  },
  {
    titulo: 'Si pide cambios, no mientas ni improvises',
    detalle:
      'Puedes ajustar las condiciones que el formulario contempla. Lo que no está en el formulario no se cambia sobre la marcha: ahí sí corresponde un abogado, y decirlo con naturalidad suma credibilidad.',
  },
];

export default function ExplicarElContratoPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-12 text-text sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">✦ Redinmo.io</p>
        <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Cómo explicarle el contrato a tu cliente</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-2">
          El documento que generas es sólido. Lo que suele fallar no es el texto, es cómo se presenta. Aquí tienes qué
          decir.
        </p>

        <section className="mt-9">
          <h2 className="text-lg font-bold text-text">El guion, en treinta segundos</h2>
          <blockquote className="mt-4 rounded-2xl border-l-4 border-accent bg-surface p-5 text-[15px] leading-relaxed text-text">
            Este es el modelo que usamos para formalizar la reserva. Recoge lo que acordamos: el monto, el plazo y qué
            pasa si alguna de las partes se retira. Léelo con calma y, si quieres consultarlo con tu abogado, adelante.
            Está redactado con las cláusulas que se usan habitualmente en este tipo de operaciones.
          </blockquote>
          <p className="mt-3 text-[13.5px] leading-relaxed text-text-2">
            Cambia &laquo;la reserva&raquo; por lo que corresponda. El resto funciona igual para cualquiera de los
            documentos.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-text">Cuatro reglas que cambian el resultado</h2>
          <ul className="mt-4 space-y-4">
            {REGLAS.map((r) => (
              <li key={r.titulo} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm font-bold text-text">{r.titulo}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{r.detalle}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-text">Lo que te van a preguntar</h2>
          <dl className="mt-4 space-y-5">
            {PREGUNTAS.map((p) => (
              <div key={p.pregunta}>
                <dt className="text-sm font-bold text-text">{p.pregunta}</dt>
                <dd className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{p.respuesta}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-10 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">
          Esto es material de apoyo para la conversación, no asesoría legal. Si quieres saber cuándo conviene que un
          abogado revise el documento antes de enviarlo,{' '}
          <a href="/legal/revision-abogado" className="font-semibold text-accent hover:underline">
            está explicado aquí
          </a>
          .
        </p>
      </div>
    </main>
  );
}
