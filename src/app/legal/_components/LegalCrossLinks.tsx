import Link from 'next/link';

const PAGES = [
  { href: '/legal/terminos', label: 'Términos y Condiciones' },
  { href: '/legal/privacidad', label: 'Privacidad y Datos' },
  { href: '/legal/suscripcion', label: 'Suscripción y Cobros' },
  { href: '/legal/cookies', label: 'Cookies' },
] as const;

export default function LegalCrossLinks({ current }: { current: (typeof PAGES)[number]['href'] }) {
  return (
    <nav className="mt-10 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-5 text-xs text-text-3">
      {PAGES.filter((p) => p.href !== current).map((p) => (
        <Link key={p.href} href={p.href} className="font-semibold hover:text-text-2 hover:underline">
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
