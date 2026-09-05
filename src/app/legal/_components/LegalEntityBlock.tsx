import { LEGAL_ENTITY } from '@/lib/real-estate/legal';

// Bloque de identificacion del operador, IDENTICO en las cuatro paginas de
// /legal/* por pedido explicito. Es un componente compartido y no texto
// copiado cuatro veces justamente para que no pueda divergir: si manana
// cambia el domicilio o el RUC, cambia en un solo lugar.
//
// El operador es la persona natural (LEGAL_ENTITY.razonSocial), no el nombre
// comercial - ver la nota en legal.ts sobre por que "Redinmo" no puede
// figurar como la entidad que contrae obligaciones.
export default function LegalEntityBlock() {
  return (
    <section className="rounded-xl border border-line bg-surface-2 p-4">
      <p>
        Este sitio y el servicio asociado son operados por{' '}
        <strong className="text-text">{LEGAL_ENTITY.razonSocial}</strong>, persona natural con RUC{' '}
        <strong className="text-text">{LEGAL_ENTITY.ruc}</strong>, con domicilio en {LEGAL_ENTITY.domicilio}, Ecuador.{' '}
        {LEGAL_ENTITY.nombreComercial} es el nombre comercial bajo el cual se presta el servicio. Contacto:{' '}
        <a href={`mailto:${LEGAL_ENTITY.correoContacto}`} className="font-semibold text-accent hover:underline">
          {LEGAL_ENTITY.correoContacto}
        </a>{' '}
        · {LEGAL_ENTITY.telefonoContacto}.
      </p>
    </section>
  );
}
