'use client';

import { Inter } from 'next/font/google';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Lock, Sparkle } from 'lucide-react';
import styles from './login.module.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'] });

function LevelBadge({ children }: { children: string }) {
  return (
    <span className={styles.levelBadge}>
      <span aria-hidden="true">●</span>
      {children}
    </span>
  );
}

function MatchCardMock() {
  return (
    <div aria-hidden="true" className={styles.matchCardWrap}>
      <div className={styles.matchHalf}>
        <div className={styles.halfTop}>
          <p className={styles.halfLabel}>Su inmueble</p>
          <span className={styles.halfAgent}>
            <span className={styles.halfAgentName}>María J.</span>
            <LevelBadge>Agente Elite</LevelBadge>
          </span>
        </div>
        <p className={styles.matchTitle}>
          Depto 2 hab · La Carolina — <span className={styles.matchPrice}>$128.000</span>
        </p>
        <p className={styles.matchZone}>Quito – Centro Norte</p>
      </div>

      <span className={styles.matchBadge}>✦ MATCH · 96%</span>

      <div className={styles.matchHalf}>
        <div className={styles.halfTop}>
          <p className={styles.halfLabel}>Tu pedido</p>
          <span className={styles.halfAgent}>
            <span className={styles.halfAgentName}>Roberto T.</span>
            <LevelBadge>Agente Activo</LevelBadge>
          </span>
        </div>
        <p className={styles.matchTitle}>
          Busca depto en La Carolina · hasta <span className={styles.matchPrice}>$135.000</span>
        </p>
        <p className={styles.matchZone}>Quito – Centro Norte</p>
      </div>
    </div>
  );
}

function TrustChips() {
  return (
    <div className={styles.trustRow}>
      <span className={styles.trustChip}>
        <Check aria-hidden="true" className="h-2.5 w-2.5" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
        Agentes verificados
      </span>
      <span className={styles.trustChip}>
        <Lock aria-hidden="true" className="h-2.5 w-2.5" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
        Datos protegidos · LOPDP
      </span>
      <span className={styles.trustChip}>
        <Sparkle aria-hidden="true" className="h-2.5 w-2.5" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
        Hecho para la Red
      </span>
    </div>
  );
}

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
    <main className={`${inter.className} ${styles.root}`}>
      <div className={styles.split}>
        {/* ---- Panel izquierdo: la historia ---- */}
        <section className={styles.storyPanel}>
          <div className={styles.storyGlow} aria-hidden="true" />

          <div className={styles.brandMark}>
            <span aria-hidden="true" className={styles.brandStar}>✦</span>
            <span className={styles.brandWord}>REDINMO</span>
          </div>

          <div className={styles.storyCenter}>
            <h1 className={styles.headline}>
              <span className={styles.gradientText}>Mientras lees esto, en algún grupo de WhatsApp se perdió un pedido. Aquí, se convirtió en </span>
              <span style={{ color: 'var(--teal)' }}>match</span>
              <span className={styles.gradientText}>.</span>
            </h1>
            <p className={styles.subtitle}>
              El hub que conecta <b>inmuebles</b> y <b>pedidos</b> en segundos.
            </p>

            <MatchCardMock />

            <div className={styles.trustDesktopOnly}>
              <TrustChips />
            </div>
          </div>
        </section>

        {/* ---- Panel derecho: riel de acceso ---- */}
        <aside className={styles.accessRail}>
          <button onClick={() => setAdminOpen((v) => !v)} className={`${styles.linkHover} ${styles.railAdminLink}`}>
            Admin
          </button>

          {adminOpen ? (
            <section className={styles.adminPanel}>
              <p className="mb-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
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
                      style={{ color: 'var(--text-tertiary)' }}
                      aria-label={showAdminPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showAdminPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>
                <button onClick={loginAdmin} disabled={loading} className={`${styles.primaryButton} text-sm`} style={{ height: 42 }}>
                  {loading ? '...' : 'Ingresar'}
                </button>
              </div>
            </section>
          ) : null}

          <div className={styles.authBlock}>
            <p className={styles.eyebrow}>Bienvenido de vuelta</p>
            <h2 className={styles.authTitle}>Login Agente</h2>
            <p className={styles.authSubtitle}>Entra, carga tu inmueble o pedido y recibe tu match.</p>

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
                  style={{ color: 'var(--text-tertiary)' }}
                  aria-label={showAgentPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showAgentPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <a href="/agentes/recuperar-contrasena" className={`${styles.linkHover} ${styles.forgotLink}`}>
              ¿Olvidaste tu contraseña?
            </a>

            <button
              onClick={loginAgent}
              disabled={loading}
              aria-label="Ingresar como agente"
              className={styles.primaryButton}
            >
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

            <div className={styles.divider}>
              <span className={styles.dividerText}>¿Nuevo en la Red?</span>
            </div>

            <div className={styles.inviteCard}>
              <p className={styles.inviteTitle}>Entra con la invitación de un colega</p>
              <p className={styles.inviteText}>
                Puede acceder con el link de invitación de un colega o{' '}
                <a href="/agentes/registro" className={`${styles.linkHover} underline`}>
                  regístrate aquí
                </a>
                .
              </p>
            </div>
          </div>
        </aside>

        <div className={styles.trustMobileOnly}>
          <TrustChips />
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', background: '#0b0d14' }} />}>
      <LoginForm />
    </Suspense>
  );
}
