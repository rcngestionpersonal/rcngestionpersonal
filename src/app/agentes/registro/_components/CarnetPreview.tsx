'use client';

import { IdCard } from 'lucide-react';

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export type CarnetPreviewProps = {
  fullName: string;
  photoPreview: string | null;
  zonesText: string;
  company: string;
  licenseNumber: string;
  specialty: 'SALE' | 'RENT' | 'BOTH';
  propertyTypesInterest: string[];
};

const SPECIALTY_LABEL: Record<CarnetPreviewProps['specialty'], string> = {
  SALE: 'Venta',
  RENT: 'Alquiler',
  BOTH: 'Venta y alquiler',
};

// Vista previa en vivo del Carnet de Agente: mientras mas informacion real
// (fidedigna) agregue el agente en el formulario, mas completo se ve - asi el
// propio formulario "vende" el valor de llenar los campos opcionales, en vez
// de que sean casillas invisibles sin motivo aparente para completarlas.
export default function CarnetPreview({ fullName, photoPreview, zonesText, company, licenseNumber, specialty, propertyTypesInterest }: CarnetPreviewProps) {
  const zones = zonesText
    .split(',')
    .map((z) => z.trim())
    .filter(Boolean);

  const completenessChecks = [Boolean(photoPreview), zones.length > 0, company.trim().length > 0, licenseNumber.trim().length > 0, propertyTypesInterest.length > 0];
  const completedCount = completenessChecks.filter(Boolean).length;
  const completeness = Math.round((completedCount / completenessChecks.length) * 100);

  const displayName = fullName.trim() || 'Tu nombre aparecerá aquí';

  return (
    <div
      className="relative overflow-hidden rounded-[20px] border p-5 text-center"
      style={{ background: 'linear-gradient(165deg, #131a22 0%, #10141f 45%, #141225 100%)', borderColor: 'rgba(45,212,191,0.35)' }}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full border border-[rgba(45,212,191,0.2)]" />
      <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full border border-[rgba(45,212,191,0.2)]" />

      <p className="relative text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#62667f]">
        <span className="text-[#2dd4bf]">✦ REDINMO.IO</span> · CARNET DE AGENTE
      </p>

      <div className="relative mt-4 flex justify-center">
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt=""
            className="h-[72px] w-[72px] rounded-full object-cover outline outline-[2.5px] outline-offset-[3px] outline-[#2dd4bf]"
          />
        ) : (
          <div
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-xl font-extrabold text-white outline outline-[2.5px] outline-offset-[3px] outline-dashed outline-[rgba(167,139,250,0.5)]"
            style={{ background: 'linear-gradient(160deg, #26304a, #1a2033)' }}
          >
            {initialsOf(fullName) || <IdCard className="h-6 w-6 text-white/40" strokeWidth={1.6} />}
          </div>
        )}
      </div>

      <p className={`relative mt-3 truncate text-[17px] font-extrabold ${fullName.trim() ? 'text-[#f0f1f7]' : 'text-white/30'}`}>{displayName}</p>

      <div className="relative mt-2 flex flex-wrap items-center justify-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold"
          style={{ borderColor: 'rgba(167,139,250,0.42)', background: 'rgba(167,139,250,0.13)', color: '#b7a5ff' }}
        >
          ● Agente Inicial
        </span>
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-white/50">
          {SPECIALTY_LABEL[specialty]}
        </span>
      </div>

      {zones.length > 0 ? <p className="relative mt-3 text-[11px] text-[#9296b0]">{zones.slice(0, 3).join(' · ')}</p> : null}

      {company.trim() || licenseNumber.trim() ? (
        <div className="relative mt-3 space-y-1 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-2.5 text-left">
          {company.trim() ? <p className="text-[11px] text-[#9296b0]">🏢 {company.trim()}</p> : null}
          {licenseNumber.trim() ? <p className="text-[11px] text-[#9296b0]">🪪 {licenseNumber.trim()}</p> : null}
        </div>
      ) : null}

      <div className="relative mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${Math.max(completeness, 8)}%`, background: 'linear-gradient(90deg, #b7a5ff, #3ee8d2)' }}
          />
        </div>
        <p className="mt-1.5 text-[10.5px] font-semibold text-[#62667f]">Tu carnet está {completeness}% completo</p>
      </div>

      <p className="relative mt-3 text-[9.5px] leading-relaxed text-[#62667f]">
        Mientras más información real agregues, más completo se ve tu carnet para tus colegas y clientes.
      </p>
    </div>
  );
}
