'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera } from 'lucide-react';
import { compressImage } from '@/lib/real-estate/image-compress';
import { buildPhoneE164 } from '@/lib/real-estate/phone';
import { ECUADOR_PROVINCES } from '@/lib/real-estate/ecuador-provinces';
import { TRIAL_DAYS } from '@/lib/real-estate/subscription-config';

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

const FIELD_ORDER = ['fullName', 'phone', 'email', 'password', 'idNumber', 'direccion', 'ciudad', 'provincia', 'terms'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

export default function AgentRegisterPage() {
  return (
    <Suspense fallback={null}>
      <AgentRegisterForm />
    </Suspense>
  );
}

function AgentRegisterForm() {
  const router = useRouter();
  const referralCode = useSearchParams().get('ref') ?? undefined;
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+593');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [direccion, setDireccion] = useState('');
  const [referenciaDireccion, setReferenciaDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [zonesText, setZonesText] = useState('');
  const [specialty, setSpecialty] = useState<'SALE' | 'RENT' | 'BOTH'>('BOTH');
  const [propertyTypesInterest, setPropertyTypesInterest] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState<Set<FieldName>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const idNumberRef = useRef<HTMLInputElement>(null);
  const direccionRef = useRef<HTMLInputElement>(null);
  const ciudadRef = useRef<HTMLInputElement>(null);
  const provinciaRef = useRef<HTMLSelectElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  // Los tipos de useRef(null) son nullable (RefObject<T | null>), pero el prop
  // `ref` de JSX en esta version de @types/react espera RefObject<T> sin null -
  // un solo cast aca en vez de en cada input evita repetirlo 6 veces.
  const fieldRefs = {
    fullName: fullNameRef,
    phone: phoneRef,
    email: emailRef,
    password: passwordRef,
    idNumber: idNumberRef,
    direccion: direccionRef,
    ciudad: ciudadRef,
    provincia: provinciaRef,
    terms: termsRef,
  } as unknown as Record<FieldName, React.RefObject<HTMLInputElement>>;

  function validate(): Partial<Record<FieldName, string>> {
    const errors: Partial<Record<FieldName, string>> = {};
    if (!fullName.trim()) errors.fullName = 'Ingresa tu nombre completo.';
    if (!phoneLocal.trim()) errors.phone = 'Ingresa tu número de teléfono.';
    else if (phoneLocal.replace(/\D/g, '').length < 7) errors.phone = 'Ingresa un número de teléfono válido.';
    if (!email.trim()) errors.email = 'Ingresa tu correo electrónico.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Ingresa un correo electrónico válido.';
    if (password.length < 6) errors.password = 'La contraseña debe tener al menos 6 caracteres.';
    if (!idNumber.trim()) errors.idNumber = 'Ingresa tu cédula de identidad.';
    if (direccion.trim().length < 10) errors.direccion = 'Ingresa tu dirección completa (mínimo 10 caracteres).';
    if (!ciudad.trim()) errors.ciudad = 'Ingresa tu ciudad.';
    if (!provincia) errors.provincia = 'Selecciona tu provincia.';
    if (!acceptedTerms) errors.terms = 'Debes aceptar los Términos y la Política de Privacidad para continuar.';
    return errors;
  }

  const errors = validate();
  function showError(field: FieldName): string | undefined {
    return touched.has(field) || submitAttempted ? errors[field] : undefined;
  }
  function markTouched(field: FieldName) {
    setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }
  function fieldClass(field: FieldName, base: string): string {
    return showError(field) ? `${base} border-pink-400/60 focus:border-pink-400` : `${base} border-line-strong focus:border-violet-400`;
  }

  function toggleProperty(value: string) {
    setPropertyTypesInterest((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function submit() {
    const currentErrors = validate();
    if (Object.keys(currentErrors).length > 0) {
      setSubmitAttempted(true);
      const firstInvalid = FIELD_ORDER.find((f) => currentErrors[f]);
      if (firstInvalid) {
        const el = fieldRefs[firstInvalid].current;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus();
      }
      return;
    }

    setLoading(true);
    setError('');
    try {
      const phone = buildPhoneE164(countryCode, phoneLocal);
      const res = await fetch('/api/real-estate/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          password,
          company: company || undefined,
          idNumber,
          licenseNumber: licenseNumber || undefined,
          direccion,
          referenciaDireccion: referenciaDireccion || undefined,
          ciudad,
          provincia,
          codigoPostal: codigoPostal || undefined,
          zones: zonesText
            .split(',')
            .map((z) => z.trim())
            .filter(Boolean),
          propertyTypesInterest,
          specialty,
          referralCode,
          acceptedTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo registrar el agente.');

      // La foto es opcional y no debe bloquear el registro si falla la subida:
      // el registro exitoso ya dejo la sesion activa (la ruta de registro
      // pone la cookie), asi que /agents/me/photo ya puede identificarnos.
      if (photoFile) {
        try {
          const compressed = await compressImage(photoFile, 500, 0.85);
          const photoForm = new FormData();
          photoForm.append('photo', compressed, 'perfil.jpg');
          await fetch('/api/real-estate/agents/me/photo', { method: 'POST', body: photoForm });
        } catch {
          // No critico: el agente puede agregar su foto despues desde su perfil.
        }
      }

      router.replace('/agentes/verificar-telefono');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de registro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-8 text-text sm:py-10">
      <div className="mx-auto max-w-xl">
          <section className="grain-overlay relative mb-6 overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-violet-600/25 blur-2xl" />
            <div className="relative z-10 space-y-3">
              <p className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
                Redinmo.io
              </p>
              <h1 className="gradient-text text-3xl font-bold leading-tight sm:text-4xl">Regístrate como agente</h1>
              <p className="max-w-xl text-sm text-text-2">
                Activa tu prueba gratuita de {TRIAL_DAYS} días y empieza a recibir matches de tus colegas hoy
              </p>
            </div>
          </section>

          <section className="glass-card rounded-3xl p-5 sm:p-6">
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 pb-1">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickPhoto(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label={photoPreview ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}
                  className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-violet-400/40 bg-surface-2 transition-colors hover:border-violet-400/70"
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Vista previa de tu foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-6 w-6 text-violet-300/70" strokeWidth={1.8} />
                  )}
                </button>
                <p className="text-xs text-text-3">{photoPreview ? 'Foto lista' : 'Foto de perfil (opcional)'}</p>
              </div>

              <div>
                <input
                  ref={fieldRefs.fullName}
                  className={fieldClass('fullName', 'w-full rounded-xl border bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => markTouched('fullName')}
                  placeholder="Nombre completo *"
                />
                {showError('fullName') ? <p className="mt-1 text-xs text-pink-300">{showError('fullName')}</p> : null}
              </div>

              <div>
                <div className="flex gap-2">
                  <select
                    className="w-[45%] shrink-0 rounded-xl border border-line-strong bg-surface-2 px-2 py-3 text-sm text-text outline-none transition focus:border-violet-400 sm:w-[38%]"
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
                    ref={fieldRefs.phone}
                    className={fieldClass('phone', 'w-full rounded-xl border bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3')}
                    value={phoneLocal}
                    onChange={(e) => setPhoneLocal(e.target.value)}
                    onBlur={() => markTouched('phone')}
                    placeholder="9XXXXXXXX *"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
                {showError('phone') ? <p className="mt-1 text-xs text-pink-300">{showError('phone')}</p> : null}
              </div>

              <div>
                <input
                  ref={fieldRefs.email}
                  className={fieldClass('email', 'w-full rounded-xl border bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3')}
                  value={email}
                  type="email"
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => markTouched('email')}
                  placeholder="Correo electrónico *"
                />
                {showError('email') ? <p className="mt-1 text-xs text-pink-300">{showError('email')}</p> : null}
              </div>

              <div>
                <input
                  ref={fieldRefs.password}
                  className={fieldClass('password', 'w-full rounded-xl border bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3')}
                  value={password}
                  type="password"
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => markTouched('password')}
                  placeholder="Contraseña (mínimo 6 caracteres) *"
                />
                {showError('password') ? <p className="mt-1 text-xs text-pink-300">{showError('password')}</p> : null}
              </div>

              <input
                className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-violet-400"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Empresa / inmobiliaria (opcional)"
              />

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-300">
                  🔒 Tu información está protegida y es privada
                </p>
                <div className="space-y-2">
                  <div>
                    <input
                      ref={fieldRefs.idNumber}
                      className={fieldClass('idNumber', 'w-full rounded-xl border bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3')}
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      onBlur={() => markTouched('idNumber')}
                      placeholder="Cédula de identidad *"
                    />
                    {showError('idNumber') ? <p className="mt-1 text-xs text-pink-300">{showError('idNumber')}</p> : null}
                  </div>
                  <input
                    className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-violet-400"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Licencia Profesional No. 0000 (opcional)"
                  />
                </div>
                <p className="mt-2 text-xs text-text-2">
                  Tus datos se usan solo para verificar tu identidad y se tratan conforme a la LOPDP (Ley Orgánica de
                  Protección de Datos Personales del Ecuador). No se comparten con otros agentes ni terceros, y puedes
                  solicitar su acceso, corrección o eliminación cuando quieras.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Dirección profesional</p>
                <div>
                  <input
                    ref={fieldRefs.direccion}
                    className={fieldClass('direccion', 'w-full rounded-xl border bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3')}
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    onBlur={() => markTouched('direccion')}
                    placeholder="Av. República del Salvador N34-183 y Suiza"
                  />
                  <p className="mt-1 text-xs text-text-3">Aparecerá en tus cartas de presentación y documentos profesionales.</p>
                  {showError('direccion') ? <p className="mt-1 text-xs text-pink-300">{showError('direccion')}</p> : null}
                </div>
                <input
                  className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-violet-400"
                  value={referenciaDireccion}
                  onChange={(e) => setReferenciaDireccion(e.target.value)}
                  placeholder="Edificio, piso, oficina (opcional)"
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      ref={fieldRefs.ciudad}
                      className={fieldClass('ciudad', 'w-full rounded-xl border bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3')}
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      onBlur={() => markTouched('ciudad')}
                      placeholder="Ciudad *"
                    />
                    {showError('ciudad') ? <p className="mt-1 text-xs text-pink-300">{showError('ciudad')}</p> : null}
                  </div>
                  <input
                    className="w-[35%] shrink-0 rounded-xl border border-line-strong bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-violet-400"
                    value={codigoPostal}
                    onChange={(e) => setCodigoPostal(e.target.value)}
                    placeholder="C.P. (opcional)"
                  />
                </div>
                <div>
                  <select
                    ref={fieldRefs.provincia as unknown as React.RefObject<HTMLSelectElement>}
                    className={fieldClass('provincia', 'w-full rounded-xl border bg-surface-2 px-3 py-3 text-sm text-text outline-none transition')}
                    value={provincia}
                    onChange={(e) => setProvincia(e.target.value)}
                    onBlur={() => markTouched('provincia')}
                  >
                    <option className="bg-bg" value="">
                      Provincia *
                    </option>
                    {ECUADOR_PROVINCES.map((p) => (
                      <option key={p} className="bg-bg" value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {showError('provincia') ? <p className="mt-1 text-xs text-pink-300">{showError('provincia')}</p> : null}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Zonas donde operas</p>
                <input
                  className="w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-3 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-violet-400"
                  value={zonesText}
                  onChange={(e) => setZonesText(e.target.value)}
                  placeholder="Separadas por coma (ej: Centro Norte, Cumbayá)"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-2">Tu especialidad</p>
                <div className="flex flex-wrap gap-2">
                  {(['SALE', 'RENT', 'BOTH'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setSpecialty(value)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        specialty === value
                          ? 'gradient-btn border-transparent text-grad-contrast'
                          : 'border-line-strong text-text-2 hover:bg-surface-2'
                      }`}
                    >
                      {value === 'SALE' ? 'Venta' : value === 'RENT' ? 'Alquiler' : 'Ambas'}
                    </button>
                  ))}
                </div>
              </div>

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

              <div>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface p-3">
                  <input
                    ref={fieldRefs.terms}
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      markTouched('terms');
                    }}
                    onBlur={() => markTouched('terms')}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong bg-surface-2 accent-violet-500"
                  />
                  <span className="text-xs text-text">
                    Acepto los{' '}
                    <a href="/legal/terminos" target="_blank" rel="noreferrer" className="font-semibold text-violet-300 underline underline-offset-2">
                      Términos
                    </a>{' '}
                    y la{' '}
                    <a href="/legal/privacidad" target="_blank" rel="noreferrer" className="font-semibold text-violet-300 underline underline-offset-2">
                      Política de Privacidad
                    </a>{' '}
                    de Redinmo.io.
                  </span>
                </label>
                {showError('terms') ? <p className="mt-1 text-xs text-pink-300">{showError('terms')}</p> : null}
              </div>

              <button
                onClick={submit}
                disabled={loading}
                className="gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Registrando...' : `Crear cuenta, prueba gratuita por ${TRIAL_DAYS} días`}
              </button>
              {/* Fase 3, seccion 4.2: el trial es Pro completo, no Basico - debe
                  quedar explicito aqui mismo, antes de que el agente se registre. */}
              <p className="text-center text-xs font-semibold text-accent">
                Empiezas con {TRIAL_DAYS} días de acceso Pro completo, gratis. Sin tarjeta.
              </p>
              <p className="text-center text-xs text-text-3">Luego de tu prueba gratuita: $8,99/mes + IVA. Cancela cuando quieras.</p>

              <a href="/login" className="block text-center text-xs font-semibold text-text-2 underline-offset-4 hover:underline">
                ¿Ya tienes cuenta? Ingresa aquí
              </a>
            </div>
          </section>

          {error ? (
            <div className="mt-6 rounded-2xl border border-pink-400/30 bg-pink-500/10 px-4 py-3 text-sm text-pink-200">
              {error}
            </div>
          ) : null}
      </div>
    </main>
  );
}
