'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { cropImageToSquare } from '@/lib/real-estate/image-compress';
import { ECUADOR_PROVINCES } from '@/lib/real-estate/ecuador-provinces';

const PROPERTY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'HOUSE', label: 'Casas' },
  { value: 'APARTMENT', label: 'Departamentos' },
  { value: 'SUITE', label: 'Suites' },
  { value: 'OFFICE', label: 'Oficinas' },
  { value: 'LAND', label: 'Terrenos' },
  { value: 'COMMERCIAL', label: 'Locales comerciales' },
  { value: 'WAREHOUSE', label: 'Bodegas/Galpones' },
  { value: 'FARM', label: 'Quintas/Haciendas' },
  { value: 'OTHER', label: 'Otros' },
];

const COUNTRY_CODES: Array<{ code: string; label: string }> = [
  { code: '+593', label: '🇪🇨 Ecuador +593' },
  { code: '+57', label: '🇨🇴 Colombia +57' },
  { code: '+51', label: '🇵🇪 Perú +51' },
  { code: '+1', label: '🇺🇸 EE. UU./Canadá +1' },
  { code: '+34', label: '🇪🇸 España +34' },
  { code: '+52', label: '🇲🇽 México +52' },
  { code: '+58', label: '🇻🇪 Venezuela +58' },
  { code: '+506', label: '🇨🇷 Costa Rica +506' },
];

function splitPhone(fullPhone: string): { countryCode: string; local: string } {
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  const match = sorted.find((c) => fullPhone.startsWith(c.code));
  if (!match) return { countryCode: '+593', local: fullPhone.replace(/^\+/, '') };
  return { countryCode: match.code, local: fullPhone.slice(match.code.length) };
}

const inputClass =
  'w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand';

type MeAgent = {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  pendingEmail?: string | null;
  photoUrl?: string | null;
  company?: string;
  idNumber?: string;
  licenseNumber?: string;
  direccion?: string | null;
  referenciaDireccion?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  codigoPostal?: string | null;
  zones: string[];
  propertyTypesInterest: string[];
  specialty: 'SALE' | 'RENT' | 'BOTH';
  carnetMessage?: string;
};

export default function EditarPerfilPage() {
  const router = useRouter();
  const [agent, setAgent] = useState<MeAgent | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [countryCode, setCountryCode] = useState('+593');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [zonesText, setZonesText] = useState('');
  const [specialty, setSpecialty] = useState<'SALE' | 'RENT' | 'BOTH'>('BOTH');
  const [propertyTypesInterest, setPropertyTypesInterest] = useState<string[]>([]);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [direccion, setDireccion] = useState('');
  const [referenciaDireccion, setReferenciaDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [carnetMessage, setCarnetMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/real-estate/agents/me', { cache: 'no-store' });
      if (!res.ok) {
        router.replace('/login');
        return;
      }
      const data = await res.json();
      const a = data.agent as MeAgent;
      setAgent(a);
      setFullName(a.fullName);
      setCompany(a.company ?? '');
      const { countryCode: cc, local } = splitPhone(a.phone);
      setCountryCode(cc);
      setPhoneLocal(local);
      setZonesText((a.zones ?? []).join(', '));
      setSpecialty(a.specialty ?? 'BOTH');
      setPropertyTypesInterest(a.propertyTypesInterest ?? []);
      setLicenseNumber(a.licenseNumber ?? '');
      setDireccion(a.direccion ?? '');
      setReferenciaDireccion(a.referenciaDireccion ?? '');
      setCiudad(a.ciudad ?? '');
      setProvincia(a.provincia ?? '');
      setCodigoPostal(a.codigoPostal ?? '');
      setCarnetMessage(a.carnetMessage ?? '');
      setPhotoPreview(a.photoUrl ?? null);
    } finally {
      setLoading(false);
    }
  }

  function toggleProperty(value: string) {
    setPropertyTypesInterest((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await cropImageToSquare(file, 500, 0.85);
      setPhotoBlob(blob);
      setPhotoPreview(URL.createObjectURL(blob));
    } catch {
      setSaveError('No se pudo procesar la imagen. Intenta con otra foto.');
    }
  }

  async function submit() {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      if (photoBlob) {
        const form = new FormData();
        form.append('photo', photoBlob, 'perfil.jpg');
        const photoRes = await fetch('/api/real-estate/agents/me/photo', { method: 'POST', body: form });
        if (!photoRes.ok) {
          const data = await photoRes.json().catch(() => ({}));
          throw new Error(data.error ?? 'No se pudo subir la foto.');
        }
      }

      const res = await fetch('/api/real-estate/agents/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          company: company || undefined,
          countryCode,
          phoneLocal,
          zones: zonesText
            .split(',')
            .map((z) => z.trim())
            .filter(Boolean),
          specialty,
          propertyTypesInterest,
          licenseNumber: licenseNumber || undefined,
          direccion: direccion || undefined,
          referenciaDireccion: referenciaDireccion || undefined,
          ciudad: ciudad || undefined,
          provincia: provincia || undefined,
          codigoPostal: codigoPostal || undefined,
          carnetMessage: carnetMessage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar tu perfil.');

      setSaved(true);
      setPhotoBlob(null);
      // Redirige al menu principal tras el toast (Fase 7-bis, seccion 2.1):
      // quedarse en el formulario sin feedback claro es lo que se reporto
      // como "sin señal clara de exito". No hace falta recargar los datos
      // (await load()) ya que la pantalla no sigue visible.
      setTimeout(() => router.push('/'), 1000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function requestEmailChange() {
    setEmailStatus('sending');
    setEmailError('');
    try {
      const res = await fetch('/api/real-estate/agents/me/email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo iniciar el cambio de correo.');
      setEmailStatus('sent');
      await load();
    } catch (err) {
      setEmailStatus('error');
      setEmailError(err instanceof Error ? err.message : 'Error al cambiar el correo.');
    }
  }

  if (loading || !agent) {
    return <main className="min-h-screen bg-bg" />;
  }

  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-8 text-text sm:py-10">
      {saved ? (
        <div className="fixed inset-x-0 top-5 z-50 flex justify-center px-4">
          <p className="rounded-full border border-accent-line bg-accent-dim px-5 py-2.5 text-sm font-semibold text-accent shadow-md">
            ✓ Perfil actualizado
          </p>
        </div>
      ) : null}
      <div className="mx-auto max-w-2xl">
        <section className="grain-overlay relative mb-6 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-md backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[var(--glow-brand)] blur-2xl" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-3">Tu cuenta</p>
            <h1 className="gradient-text mt-1 text-2xl font-bold leading-tight sm:text-3xl">Editar perfil</h1>
            <p className="mt-2 text-sm text-text-2">Estos datos se usan en tu Carnet, tu mini-sitio y los documentos que generes.</p>
          </div>
        </section>

        <section className="glass-card space-y-5 rounded-3xl p-5 sm:p-6">
          {/* Foto de perfil */}
          <div className="flex flex-col items-center gap-2 pb-1">
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPickPhoto(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              aria-label={photoPreview ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}
              className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-brand-line bg-surface-2 transition-colors hover:border-brand"
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Vista previa de tu foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-brand/70" strokeWidth={1.8} />
              )}
            </button>
            <p className="text-xs text-text-3">Foto de perfil (recorte cuadrado automático)</p>
          </div>

          {/* Nombre + empresa */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Nombre y apellidos</p>
            <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Nombre comercial o empresa</p>
            <input className={inputClass} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa / inmobiliaria (opcional)" />
          </div>

          {/* Telefono - un solo control: selector + numero */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Teléfono</p>
            <div className="flex gap-2">
              <select
                className="w-[42%] shrink-0 rounded-xl border border-line-strong bg-surface-2 px-2 py-3 text-sm text-text outline-none transition focus:border-brand sm:w-[36%]"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} className="bg-bg" value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                className={inputClass}
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value)}
                placeholder="9XXXXXXXX"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Correo - cambio con verificacion */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Correo electrónico</p>
            <p className="rounded-xl border border-line-strong bg-surface-2 px-3 py-3 text-sm text-text-2">{agent.email ?? 'No registrado'}</p>
            {agent.pendingEmail ? (
              <p className="mt-1.5 text-xs text-accent">Verificación pendiente para: {agent.pendingEmail}. Revisa esa bandeja para confirmarlo.</p>
            ) : null}
            <div className="mt-2 flex gap-2">
              <input
                className={inputClass}
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={agent.email ? 'Nuevo correo' : 'Agregar un correo'}
              />
              <button
                onClick={() => void requestEmailChange()}
                disabled={!newEmail.trim() || emailStatus === 'sending'}
                className="shrink-0 rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-text-2 transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {emailStatus === 'sending' ? 'Enviando...' : agent.email ? 'Cambiar correo' : 'Verificar'}
              </button>
            </div>
            {emailStatus === 'sent' ? (
              <p className="mt-1.5 text-xs font-semibold text-accent">Te enviamos un enlace de verificación a {newEmail}.</p>
            ) : null}
            {emailStatus === 'error' ? <p className="mt-1.5 text-xs text-danger">{emailError}</p> : null}
          </div>

          {/* Cedula - no editable */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Cédula de identidad</p>
            <p className="rounded-xl border border-line-strong bg-surface-2 px-3 py-3 text-sm text-text-3">{agent.idNumber ?? '—'}</p>
            <p className="mt-1.5 text-xs text-text-3">Este dato no se puede editar aquí porque afecta tu verificación de identidad. Si necesitas corregirlo, contacta a soporte.</p>
          </div>

          {/* Licencia */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Licencia profesional</p>
            <input
              className={inputClass}
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="Número de licencia (opcional)"
            />
          </div>

          {/* Direccion profesional (Fase 7, seccion 8.2) */}
          <div className="space-y-2 rounded-2xl border border-line bg-surface-2/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Dirección profesional</p>
            <div>
              <input className={inputClass} value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Av. República del Salvador N34-183 y Suiza" />
              <p className="mt-1 text-xs text-text-3">Aparecerá en tus cartas de presentación y documentos profesionales.</p>
            </div>
            <input
              className={inputClass}
              value={referenciaDireccion}
              onChange={(e) => setReferenciaDireccion(e.target.value)}
              placeholder="Edificio, piso, oficina (opcional)"
            />
            <div className="flex gap-2">
              <input className={`${inputClass} min-w-0 flex-1`} value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ciudad" />
              {/* inputClass trae w-full: sin !w-[35%] esa clase gana el
                  empate de especificidad y este campo termina ocupando casi
                  toda la fila, aplastando el de Ciudad a unos pocos pixeles. */}
              <input className={`${inputClass} !w-[35%] shrink-0`} value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} placeholder="C.P. (opcional)" />
            </div>
            <select className={inputClass} value={provincia} onChange={(e) => setProvincia(e.target.value)}>
              <option className="bg-bg" value="">
                Provincia
              </option>
              {ECUADOR_PROVINCES.map((p) => (
                <option key={p} className="bg-bg" value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Zonas */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Zonas donde operas</p>
            <input
              className={inputClass}
              value={zonesText}
              onChange={(e) => setZonesText(e.target.value)}
              placeholder="Separadas por coma (ej: Centro Norte, Cumbayá)"
            />
          </div>

          {/* Especialidad */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Tu especialidad</p>
            <div className="flex flex-wrap gap-2">
              {(['SALE', 'RENT', 'BOTH'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setSpecialty(value)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    specialty === value ? 'gradient-btn border-transparent text-grad-contrast' : 'border-line-strong text-text-2 hover:bg-surface-2'
                  }`}
                >
                  {value === 'SALE' ? 'Venta' : value === 'RENT' ? 'Alquiler' : 'Ambas'}
                </button>
              ))}
            </div>
          </div>

          {/* Tipos de propiedades */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Tipos de propiedades que manejas</p>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleProperty(option.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    propertyTypesInterest.includes(option.value)
                      ? 'gradient-btn border-transparent text-grad-contrast'
                      : 'border-line-strong text-text-2 hover:bg-surface-2'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frase de presentacion */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Frase de presentación</p>
            <textarea
              className={`${inputClass} min-h-[80px] resize-none`}
              value={carnetMessage}
              onChange={(e) => setCarnetMessage(e.target.value.slice(0, 220))}
              placeholder="Una frase corta para presentarte a tus clientes (se usará en tu mini-sitio Pro)."
            />
            <p className="mt-1 text-right text-[11px] text-text-3">{carnetMessage.length}/220</p>
          </div>

          {saveError ? <p className="rounded-xl border border-danger bg-danger-dim px-3 py-2.5 text-sm text-danger">{saveError}</p> : null}

          <button
            onClick={() => void submit()}
            disabled={saving}
            className="gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </section>
      </div>
    </main>
  );
}
