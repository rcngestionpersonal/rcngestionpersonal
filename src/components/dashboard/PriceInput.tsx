'use client';

// Input de precio con separador de miles automatico (ej: escribe "150000" y ve
// "150,000" en pantalla) para que el agente no tenga que adivinar si debe usar
// puntos o comas. El valor que maneja el padre siempre son solo digitos, sin
// separadores, listo para convertir con Number().
export function formatPriceDigits(digits: string): string {
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

export function PriceInput({
  value,
  onChange,
  placeholder,
  helperText,
}: {
  value: string;
  onChange: (rawDigits: string) => void;
  placeholder?: string;
  helperText?: string;
}) {
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">$</span>
        <input
          className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pl-6 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-400"
          value={formatPriceDigits(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder={placeholder}
        />
      </div>
      {helperText ? <p className="mt-1 text-[11px] text-white/40">{helperText}</p> : null}
    </div>
  );
}
