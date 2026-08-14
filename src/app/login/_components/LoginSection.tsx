'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ShieldCheck, Sparkle } from 'lucide-react';
import styles from '../login.module.css';

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className={styles.fieldLabel}>
      {children}
    </label>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [agentPhone, setAgentPhone] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [showAgentPassword, setShowAgentPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loginAdmin() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo iniciar sesión admin.');
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de login admin');
    } finally {
      setLoading(false);
    }
  }

  async function loginAgent() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/agent-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: agentPhone, password: agentPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo iniciar sesión agente.');
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de login agente');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="login" className={styles.loginSection}>
      <div className={styles.gv} style={{ width: 420, height: 420, bottom: -160, left: -140 }} aria-hidden="true" />
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.loginGrid}>
          <div>
            <p className={styles.eyebrow}>
              <Sparkle className="h-[13px] w-[13px]" strokeWidth={2} />
              ÚLTIMO PASO
            </p>
            <h2 className={styles.h2}>
              <span className={styles.h2Grad}>Tu próximo match está a un ingreso de distancia</span>
            </h2>
            <p className={styles.sectionLead} style={{ margin: '12px 0 0', textAlign: 'left' }}>
              Entra, carga tu primer inmueble o el pedido de tu cliente, y deja que la red de tus colegas haga el resto.
            </p>
            <div className={styles.trustRow}>
              <span className={styles.trustChip}>
                <ShieldCheck className="h-3 w-3" style={{ color: 'var(--accent)' }} strokeWidth={2} />
                Agentes Verificados
              </span>
              <span className={styles.trustChip}>
                <Lock className="h-3 w-3" style={{ color: 'var(--accent)' }} strokeWidth={2} />
                Datos Protegidos · LOPDP
              </span>
            </div>
          </div>

          <div className={styles.loginCard}>
            <button onClick={() => setAdminOpen((v) => !v)} className={`${styles.linkHover}`} style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14 }}>
              Admin
            </button>

            {adminOpen ? (
              <div className={styles.adminPanel}>
                <p className="mb-3 text-xs" style={{ color: 'var(--text-3)' }}>
                  Control total de plataforma, agentes, facturación y configuración.
                </p>
                <div className="space-y-3">
                  <div>
                    <FieldLabel htmlFor="admin-email">Email</FieldLabel>
                    <input
                      id="admin-email"
                      className={styles.input}
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@redinmo.io"
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="admin-password">Contraseña</FieldLabel>
                    <div className="relative">
                      <input
                        id="admin-password"
                        className={styles.input}
                        style={{ paddingRight: 64 }}
                        value={adminPassword}
                        type={showAdminPassword ? 'text' : 'password'}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Contraseña"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword((v) => !v)}
                        className={`${styles.linkHover} absolute right-3 top-1/2 -translate-y-1/2 text-xs`}
                        style={{ color: 'var(--text-3)' }}
                        aria-label={showAdminPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showAdminPassword ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </div>
                  <button onClick={loginAdmin} disabled={loading} className={styles.loginBtn} style={{ marginTop: 4, padding: '10px' }}>
                    {loading ? '...' : 'Ingresar'}
                  </button>
                </div>
              </div>
            ) : null}

            <p className={styles.loginEyebrow}>BIENVENIDO DE VUELTA</p>
            <h3 className={styles.loginTitle}>Login Agente</h3>
            <p className={styles.loginSubtitle}>Entra, carga tu inmueble o pedido y recibe tu match.</p>

            <div>
              <FieldLabel htmlFor="agent-phone">Teléfono</FieldLabel>
              <input
                id="agent-phone"
                className={styles.input}
                value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value)}
                placeholder="+593 9XXXXXXXX"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <FieldLabel htmlFor="agent-password">Contraseña</FieldLabel>
              <div className="relative">
                <input
                  id="agent-password"
                  className={styles.input}
                  style={{ paddingRight: 64 }}
                  value={agentPassword}
                  type={showAgentPassword ? 'text' : 'password'}
                  onChange={(e) => setAgentPassword(e.target.value)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowAgentPassword((v) => !v)}
                  className={`${styles.linkHover} absolute right-3 top-1/2 -translate-y-1/2 text-xs`}
                  style={{ color: 'var(--text-3)' }}
                  aria-label={showAgentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showAgentPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <a href="/recuperar-acceso" className={`${styles.linkHover} ${styles.forgotLink}`}>
              ¿Olvidaste tu contraseña?
            </a>

            <button onClick={loginAgent} disabled={loading} aria-label="Ingresar como agente" className={styles.loginBtn}>
              {loading ? 'Ingresando...' : 'Ingresar como agente'}
            </button>

            {loading ? (
              <div className={styles.loadingBarTrack} role="status" aria-label="Validando acceso">
                <div className={styles.loadingBarFill} />
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-3 rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'rgba(251,113,133,0.1)', border: '1px solid rgba(251,113,133,0.3)', color: '#fca5b1' }}
              >
                {error}
              </div>
            ) : null}

            <p className={styles.inviteLine}>
              Puedes acceder con el link de invitación de un colega o{' '}
              <a href="/agentes/registro" className={styles.registerLink}>
                Regístrate aquí
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LoginSection() {
  return (
    <Suspense fallback={<section id="login" className={styles.loginSection} />}>
      <LoginForm />
    </Suspense>
  );
}
