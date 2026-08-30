// Bloque precio + sufijo reutilizable (monto dominante, sufijo secundario) -
// unico lugar que define esta jerarquia para que no vuelva a divergir entre
// la landing, el modulo de suscripcion y la pantalla de planes.
//
// El sufijo hereda su tamano del monto via unidades "em": el className que
// recibe este componente define el font-size del monto en el elemento raiz
// (ej. "text-3xl font-bold text-text"), el span del monto lo hereda tal cual
// (1em) y el del sufijo lo calcula al 30% (0.3em) - asi la proporcion se
// mantiene automaticamente sin importar que tamano use cada pantalla.
export function PriceTag({
  amount,
  suffix,
  className,
  suffixClassName,
}: {
  amount: string;
  suffix: string;
  className?: string;
  suffixClassName?: string;
}) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.25em' }}>
      <span>{amount}</span>
      <span
        className={suffixClassName}
        style={{ fontSize: '0.3em', fontWeight: 500, color: 'var(--text-3)', letterSpacing: 'normal' }}
      >
        {suffix}
      </span>
    </span>
  );
}
