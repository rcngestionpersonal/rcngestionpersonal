'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { AccesoInput } from '@/lib/real-estate/access';
import RequiereFeature from '../RequiereFeature';
import { ModuleHeader } from '../CardKit';
import { IconLetter } from '../icons';
import NuevaCartaAsistente from '../cartas/NuevaCartaAsistente';
import CartaEditor from '../cartas/CartaEditor';
import type { CartaCompleta, CartaResumen, DatosPantallaCartas } from '../cartas/tipos-cliente';

// Modulo "Cartas" (Fase 4). Pestaña propia al nivel de los demas modulos de
// trabajo, nunca enterrada en el perfil (punto 0.2). En plan Basico la entrada
// se ve igual y aterriza en el bloqueo de RequiereFeature.

type Vista = { modo: 'lista' } | { modo: 'nueva' } | { modo: 'editor'; carta: CartaCompleta };

export default function CartasTab({ suscripcion }: { suscripcion: AccesoInput | null }) {
  const { t } = useLanguage();

  return (
    <div className="min-w-0">
      <ModuleHeader
        icon={<IconLetter className="h-[17px] w-[17px]" strokeWidth={1.8} />}
        title={t('cartas.title')}
        subtitle={t('cartas.subtitle')}
      />
      {suscripcion ? (
        <RequiereFeature suscripcion={suscripcion} feature="carta_presentacion">
          <PanelCartas t={t} />
        </RequiereFeature>
      ) : (
        <p className="text-sm text-text-2">{t('cartas.cargando')}</p>
      )}
    </div>
  );
}

function PanelCartas({ t }: { t: (k: string) => string }) {
  const [datos, setDatos] = useState<DatosPantallaCartas | null>(null);
  const [vista, setVista] = useState<Vista>({ modo: 'lista' });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [avisoPlantilla, setAvisoPlantilla] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/real-estate/cartas', { cache: 'no-store' });
      if (!r.ok) {
        setError(t('cartas.error.cargar'));
        return;
      }
      setDatos((await r.json()) as DatosPantallaCartas);
    } catch {
      setError(t('cartas.error.cargar'));
    } finally {
      setCargando(false);
    }
  }, [t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function abrir(id: string) {
    const r = await fetch(`/api/real-estate/cartas/${id}`, { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    setVista({ modo: 'editor', carta: d.carta as CartaCompleta });
  }

  async function eliminar(id: string) {
    await fetch(`/api/real-estate/cartas/${id}`, { method: 'DELETE' });
    void cargar();
  }

  async function duplicar(carta: CartaResumen) {
    const nombre = window.prompt(t('cartas.duplicar.pedirNombre'), '');
    if (!nombre || nombre.trim().length < 2) return;
    const r = await fetch(`/api/real-estate/cartas/${carta.id}/duplicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatarioNombre: nombre.trim() }),
    });
    if (!r.ok) return;
    const d = await r.json();
    await cargar();
    setVista({ modo: 'editor', carta: d.carta as CartaCompleta });
  }

  if (cargando) return <p className="text-sm text-text-2">{t('cartas.cargando')}</p>;
  if (error) return <p className="rounded-xl border border-danger bg-danger-dim px-3.5 py-2.5 text-sm text-danger">{error}</p>;
  if (!datos) return null;

  if (vista.modo === 'editor') {
    return (
      <CartaEditor
        carta={vista.carta}
        cuota={datos.cuota}
        tieneCorreo={datos.agente.tieneCorreo}
        t={t}
        onVolver={() => {
          void cargar();
          setVista({ modo: 'lista' });
        }}
        onCambio={() => void cargar()}
      />
    );
  }

  if (vista.modo === 'nueva') {
    return (
      <NuevaCartaAsistente
        datos={datos}
        t={t}
        onCancelar={() => setVista({ modo: 'lista' })}
        onCreada={(carta, usoPlantilla) => {
          setAvisoPlantilla(usoPlantilla);
          void cargar();
          setVista({ modo: 'editor', carta });
        }}
      />
    );
  }

  const sinCuota = datos.cuota.restantes <= 0;
  // La fecha de reinicio se calcula en UTC (primer dia del mes siguiente).
  // Sin timeZone: 'UTC' aca, en Ecuador (UTC-5) se renderiza como el ultimo dia
  // del mes actual: '1 de octubre' se leia '30 de septiembre'.
  const renuevaEl = new Date(datos.cuota.reiniciaEl).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  return (
    <div className="space-y-5">
      {/* Aviso del punto 2.3: conecta la calidad de la carta con cargar mas
          inventario, que es justamente lo que la feature busca incentivar. */}
      {datos.inventarioEscaso ? (
        <p className="rounded-2xl border border-accent-line bg-accent-dim px-4 py-3 text-sm leading-relaxed text-accent">
          {t('cartas.avisoEscaso')}
        </p>
      ) : null}

      {avisoPlantilla ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-text-2">
          {t('cartas.avisoPlantilla')}
        </p>
      ) : null}

      {/* Tope alcanzado: es informacion, no un fallo. Tono neutro, fecha de
          renovacion, y se aclara que lo ya generado sigue disponible. */}
      {sinCuota ? (
        <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
          <p className="text-sm font-semibold text-text">
            {t('cartas.limiteAlcanzado')
              .replace('{limite}', String(datos.cuota.limite))
              .replace('{fecha}', renuevaEl)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-2">{t('cartas.limiteAlcanzado.detalle')}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-2">
          {t('cartas.cuota').replace('{usadas}', String(datos.cuota.usadas)).replace('{limite}', String(datos.cuota.limite))}
        </p>
        <button
          onClick={() => setVista({ modo: 'nueva' })}
          disabled={sinCuota}
          className="gradient-btn min-h-[44px] rounded-xl px-5 text-sm font-bold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sinCuota ? t('cartas.cuotaAgotada').replace('{limite}', String(datos.cuota.limite)) : t('cartas.nueva')}
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-text">{t('cartas.historial')}</h3>
        {datos.cartas.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-text-2">
            {t('cartas.sinCartas')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {datos.cartas.map((carta) => (
              <li key={carta.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-text">{carta.destinatarioNombre}</p>
                    <p className="mt-0.5 text-xs text-text-2">
                      {t(`cartas.destinatario.${carta.destinatarioTipo}`)} ·{' '}
                      {new Date(carta.createdAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      carta.estado === 'ENVIADA'
                        ? 'border-accent-line bg-accent-dim text-accent'
                        : 'border-line bg-surface-2 text-text-2'
                    }`}
                  >
                    {t(`cartas.estado.${carta.estado}`)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void abrir(carta.id)}
                    className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
                  >
                    {t('cartas.abrir')}
                  </button>
                  {carta.revisadaAt ? (
                    <a
                      href={`/api/real-estate/cartas/${carta.id}/archivo?formato=pdf`}
                      className="flex min-h-[40px] items-center rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
                    >
                      {t('cartas.descargarPdf')}
                    </a>
                  ) : null}
                  <button
                    onClick={() => void duplicar(carta)}
                    className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text-2 transition hover:bg-surface-2"
                  >
                    {t('cartas.duplicar')}
                  </button>
                  <button
                    onClick={() => void eliminar(carta.id)}
                    className="min-h-[40px] rounded-lg border border-line px-3 text-xs font-semibold text-text-3 transition hover:text-danger"
                  >
                    {t('cartas.eliminar')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
