'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { AccesoInput } from '@/lib/real-estate/access';
import RequiereFeature from '../RequiereFeature';
import { ModuleHeader } from '../CardKit';
import { IconContract } from '../icons';
import ContratoFormulario from '../contratos/ContratoFormulario';
import ContratoSeguimiento from '../contratos/ContratoSeguimiento';
import type { AlertaContrato, ContratoResumen, DatosPantallaContratos } from '../contratos/tipos-cliente';
// Esta pantalla ya NO importa el catálogo de tipos a propósito: la etiqueta de
// cada fila la resuelve el servidor. Un tipo que este despliegue no conozca se
// dibuja degradado en vez de lanzar y dejar al agente sin módulo.
import { ENLACE_REVISION_ABOGADO, ENLACE_REVISION_ABOGADO_ETIQUETA } from '@/lib/real-estate/contratos/tipos';

// Modulo "Contratos". Pestaña propia, feature Pro con bloqueo elegante en
// Basico. Genera el documento, lo negocia version por version con aprobacion
// de las partes -primero el cliente del agente, despues la contraparte- y deja
// el recorrido documentado para la notaria.

type Vista =
  | { modo: 'lista' }
  | { modo: 'nuevo' }
  | { modo: 'editar'; id: string; paso?: 'datos' | 'revisar' }
  | { modo: 'seguimiento'; id: string };

// ---------------------------------------------------------------------------
// El contrato abierto también vive en la URL (?vista=&contrato=), junto a la
// pestaña. Así, al volver desde la guía para explicar el documento o desde la
// página del abogado (que son rutas aparte), o al recargar, se reabre el
// mismo contrato en vez de caer en la lista.
//
// Un contrato NUEVO no tiene id hasta que el formulario lo guarda, y el
// formulario no se lo informa a esta pestaña. Por eso, al tocar "Nuevo
// contrato" se anotan los contratos que ya existían; al volver, el borrador
// que apareció después es el que se estaba escribiendo.
// ---------------------------------------------------------------------------
const FOTO_ANTES_DE_NUEVO = 'redinmo:contratos:antes-de-nuevo';

function anotarContratosExistentes(ids: string[]): void {
  try {
    window.sessionStorage.setItem(FOTO_ANTES_DE_NUEVO, JSON.stringify(ids));
  } catch {
    // Sin almacenamiento (modo privado): al volver se abre un formulario nuevo.
  }
}

function borradorCreadoDespues(contratos: ContratoResumen[]): string | null {
  let antes: string[] | null = null;
  try {
    antes = JSON.parse(window.sessionStorage.getItem(FOTO_ANTES_DE_NUEVO) ?? 'null') as string[] | null;
  } catch {
    antes = null;
  }
  if (!antes) return null;
  const nuevos = contratos
    .filter((c) => !antes.includes(c.id) && c.estado === 'BORRADOR' && (c.versionActual ?? 0) === 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return nuevos[0]?.id ?? null;
}

function vistaDesdeUrl(contratos: ContratoResumen[]): Vista {
  const q = new URLSearchParams(window.location.search);
  const modo = q.get('vista');
  const id = q.get('contrato');
  const existe = id !== null && contratos.some((c) => c.id === id);
  if (modo === 'seguimiento' && existe) return { modo: 'seguimiento', id };
  if (modo === 'editar' && existe) return { modo: 'editar', id };
  if (modo === 'nuevo') {
    const creado = borradorCreadoDespues(contratos);
    return creado ? { modo: 'editar', id: creado } : { modo: 'nuevo' };
  }
  return { modo: 'lista' };
}

function escribirVistaEnUrl(vista: Vista): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('vista');
  url.searchParams.delete('contrato');
  if (vista.modo !== 'lista') url.searchParams.set('vista', vista.modo);
  if (vista.modo === 'editar' || vista.modo === 'seguimiento') url.searchParams.set('contrato', vista.id);
  // replaceState: cambiar de contrato no crea entradas en el historial.
  if (url.href !== window.location.href) window.history.replaceState(null, '', url);
}

export default function ContratosTab({ suscripcion }: { suscripcion: AccesoInput | null }) {
  const { t } = useLanguage();
  return (
    <div className="min-w-0">
      <ModuleHeader
        icon={<IconContract className="h-[17px] w-[17px]" strokeWidth={1.8} />}
        title={t('contratos.title')}
        subtitle={t('contratos.subtitle')}
      />
      {suscripcion ? (
        <RequiereFeature suscripcion={suscripcion} feature="contratos">
          <Panel t={t} />
        </RequiereFeature>
      ) : (
        <p className="text-sm text-text-2">{t('contratos.cargando')}</p>
      )}
    </div>
  );
}

const ESTADOS_CONOCIDOS = [
  'BORRADOR',
  'EN_REVISION_PRINCIPAL',
  'APROBADO_PRINCIPAL',
  'EN_REVISION_CONTRAPARTE',
  'APROBADO_FINAL',
  'CAMBIOS_SOLICITADOS_PRINCIPAL',
  'CAMBIOS_SOLICITADOS_CONTRAPARTE',
  'VENCIDO',
  'ANULADO',
];

// "No se pudo cargar" y "todavía no tienes contratos" son cosas distintas y
// antes se veían casi igual. Esto guarda POR QUÉ falló, para poder decirlo.
type FalloCarga = { mensaje: string; detalle: string; reintentable: boolean };

function Panel({ t }: { t: (k: string) => string }) {
  const [datos, setDatos] = useState<DatosPantallaContratos | null>(null);
  const [vista, setVista] = useState<Vista>({ modo: 'lista' });
  const [cargando, setCargando] = useState(true);
  const [reintentando, setReintentando] = useState(false);
  const [fallo, setFallo] = useState<FalloCarga | null>(null);

  const cargar = useCallback(async () => {
    setFallo(null);
    try {
      const r = await fetch('/api/real-estate/contratos', { cache: 'no-store' });
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => ({}));
        // Un módulo mal configurado no se arregla reintentando: no ofrecemos
        // un botón que no puede funcionar.
        const sinCifrado = cuerpo.code === 'sin_cifrado';
        setFallo({
          mensaje: sinCifrado ? t('contratos.error.sinConfigurar') : t('contratos.error.cargar'),
          detalle: sinCifrado
            ? t('contratos.error.sinConfigurar.detalle')
            : (cuerpo.error ?? t('contratos.error.cargar.detalle')),
          reintentable: !sinCifrado,
        });
        return;
      }
      setDatos((await r.json()) as DatosPantallaContratos);
    } catch {
      setFallo({
        mensaje: t('contratos.error.cargar'),
        detalle: t('contratos.error.sinConexion'),
        reintentable: true,
      });
    } finally {
      setCargando(false);
    }
  }, [t]);

  const reintentar = useCallback(async () => {
    setReintentando(true);
    try {
      await cargar();
    } finally {
      setReintentando(false);
    }
  }, [cargar]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Con la lista ya cargada, se abre lo que pida la URL (una sola vez); desde
  // ahí, la URL sigue a la vista.
  const [urlAplicada, setUrlAplicada] = useState(false);
  useEffect(() => {
    if (!datos || urlAplicada) return;
    setVista(vistaDesdeUrl(datos.contratos));
    setUrlAplicada(true);
  }, [datos, urlAplicada]);
  useEffect(() => {
    if (urlAplicada) escribirVistaEnUrl(vista);
  }, [vista, urlAplicada]);

  async function eliminar(id: string) {
    await fetch(`/api/real-estate/contratos/${id}`, { method: 'DELETE' });
    void cargar();
  }

  if (cargando) return <p className="text-sm text-text-2">{t('contratos.cargando')}</p>;

  if (fallo) {
    return (
      <div className="rounded-2xl border border-danger bg-danger-dim p-5">
        <p className="text-sm font-bold text-danger">{fallo.mensaje}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">{fallo.detalle}</p>
        {fallo.reintentable ? (
          <button
            onClick={() => void reintentar()}
            disabled={reintentando}
            className="mt-4 min-h-[44px] rounded-xl border border-danger px-5 text-sm font-bold text-danger transition disabled:opacity-50"
          >
            {reintentando ? t('contratos.reintentando') : t('contratos.reintentar')}
          </button>
        ) : null}
      </div>
    );
  }

  if (!datos) return null;
  // Un instante, mientras se aplica la URL: evita mostrar la lista y saltar
  // enseguida al contrato.
  if (!urlAplicada) return <p className="text-sm text-text-2">{t('contratos.cargando')}</p>;

  if (vista.modo === 'nuevo' || vista.modo === 'editar') {
    return (
      <ContratoFormulario
        t={t}
        listings={datos.listings}
        empresaAgente={datos.agente.empresa}
        plantilla={datos.plantilla}
        contratoId={vista.modo === 'editar' ? vista.id : null}
        pasoInicial={vista.modo === 'editar' ? vista.paso : undefined}
        onCancelar={() => {
          void cargar();
          setVista({ modo: 'lista' });
        }}
        onEnviado={(id) => {
          void cargar();
          setVista({ modo: 'seguimiento', id });
        }}
      />
    );
  }

  if (vista.modo === 'seguimiento') {
    return (
      <ContratoSeguimiento
        t={t}
        contratoId={vista.id}
        onVolver={() => {
          void cargar();
          setVista({ modo: 'lista' });
        }}
        onEditar={(paso) => setVista({ modo: 'editar', id: vista.id, paso })}
      />
    );
  }

  const faltaPerfil = !datos.agente.tieneCedula || !datos.agente.tieneDireccion;

  return (
    <div className="space-y-5">
      {faltaPerfil ? (
        <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-text-2">
          {t('contratos.faltaPerfil')}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-2">
          {t('contratos.plantillasVigentes').replace('{n}', String(datos.plantilla.versiones.length))}
        </p>
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <button
            onClick={() => {
              anotarContratosExistentes(datos.contratos.map((c) => c.id));
              setVista({ modo: 'nuevo' });
            }}
            className="gradient-btn min-h-[44px] rounded-xl px-5 text-sm font-bold text-grad-contrast"
          >
            {t('contratos.nuevo')}
          </button>
          {/* Enlace discreto de orientación (punto 4.6) */}
          <a
            href={ENLACE_REVISION_ABOGADO}
            className="text-center text-[11.5px] text-text-3 underline-offset-2 transition hover:text-text-2 hover:underline"
          >
            {ENLACE_REVISION_ABOGADO_ETIQUETA}
          </a>
        </div>
      </div>

      {(datos.alertas ?? []).length > 0 ? <Alertas t={t} alertas={datos.alertas} onAbrir={(id) => setVista({ modo: 'seguimiento', id })} /> : null}

      {datos.contratos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-text-2">
          {t('contratos.sinContratos')}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {datos.contratos.map((c) => (
            <Fila key={c.id} contrato={c} t={t} onAbrir={setVista} onEliminar={eliminar} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Fila({
  contrato,
  t,
  onAbrir,
  onEliminar,
}: {
  contrato: ContratoResumen;
  t: (k: string) => string;
  onAbrir: (v: Vista) => void;
  onEliminar: (id: string) => void;
}) {
  // La etiqueta viene resuelta del servidor. Nada aquí busca en el catálogo,
  // así que un tipo desconocido no puede lanzar y dejar la lista en blanco.
  const partes = contrato.partes ?? [];
  const decididas = partes.filter((f) => f.estado === (contrato.deFirma ? 'FIRMADO' : 'APROBADO')).length;
  const total = partes.length;
  const soloLectura = contrato.archivado || contrato.deFirma || contrato.estado === 'ANULADO';
  const nuncaEnviado = contrato.estado === 'BORRADOR' && (contrato.versionActual ?? 0) === 0;
  const estado = ESTADOS_CONOCIDOS.includes(contrato.estado) ? contrato.estado : 'BORRADOR';
  const etiquetaEstado = contrato.deFirma ? t('contratos.filaDeFirma.corta') : t(`contratos.estado.${estado}`);

  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text">{contrato.tipoEtiqueta}</p>
          {contrato.ilegible ? <p className="mt-0.5 text-[11px] text-text-3">{t('contratos.filaIlegible')}</p> : null}
          {contrato.archivado && !contrato.deFirma ? <p className="mt-0.5 text-[11px] text-text-3">{t('contratos.filaArchivada')}</p> : null}
          {contrato.deFirma ? <p className="mt-0.5 text-[11px] text-text-3">{t('contratos.filaDeFirma')}</p> : null}
          <p className="mt-0.5 truncate text-xs text-text-2">{partes.map((f) => f.nombre).join(' · ') || t('contratos.sinPartes')}</p>
          <p className="mt-0.5 text-[11px] text-text-3">
            {new Date(contrato.createdAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
            {contrato.versionActual > 0 ? ` · ${t('contratos.version').replace('{n}', String(contrato.versionActual))}` : ''}
            {total > 0 ? ` · ${decididas}/${total} ${t(contrato.deFirma ? 'contratos.firmaron' : 'contratos.aprobaron')}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            contrato.deFirma
              ? 'border-line bg-surface-2 text-text-2'
              : estado === 'APROBADO_FINAL' || estado === 'APROBADO_PRINCIPAL'
                ? 'border-accent-line bg-accent-dim text-accent'
                : estado === 'EN_REVISION_PRINCIPAL' || estado === 'EN_REVISION_CONTRAPARTE'
                  ? 'border-brand-line bg-brand-dim text-brand'
                  : estado.startsWith('CAMBIOS_SOLICITADOS') || estado === 'VENCIDO'
                    ? 'border-danger text-danger'
                    : 'border-line bg-surface-2 text-text-2'
          }`}
        >
          {etiquetaEstado}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {nuncaEnviado && !soloLectura ? (
          <>
            <button
              onClick={() => onAbrir({ modo: 'editar', id: contrato.id })}
              className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
            >
              {t('contratos.continuar')}
            </button>
            <button
              onClick={() => onEliminar(contrato.id)}
              className="min-h-[40px] rounded-lg border border-line px-3 text-xs font-semibold text-text-3 transition hover:text-danger"
            >
              {t('contratos.eliminar')}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onAbrir({ modo: 'seguimiento', id: contrato.id })}
              className="min-h-[40px] rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
            >
              {t('contratos.verSeguimiento')}
            </button>
            {!soloLectura ? (
              <button
                onClick={() => onAbrir({ modo: 'editar', id: contrato.id })}
                className="min-h-[40px] rounded-lg border border-line px-3 text-xs font-semibold text-text-2 transition hover:bg-surface-2"
              >
                {t('contratos.editar')}
              </button>
            ) : null}
          </>
        )}
        <a
          href={`/api/real-estate/contratos/${contrato.id}/archivo`}
          className="flex min-h-[40px] items-center rounded-lg border border-line-strong px-3 text-xs font-semibold text-text transition hover:bg-surface-2"
        >
          {t('contratos.descargarPdf')}
        </a>
      </div>
    </li>
  );
}

// Lo que el agente tiene que atender: su cliente aprobó y falta enviar a la
// contraparte, alguien pidió cambios, un enlace vence en menos de 24 horas o ya
// venció. Solo avisos: nada se envía solo a los clientes.
function Alertas({ t, alertas, onAbrir }: { t: (k: string) => string; alertas: AlertaContrato[]; onAbrir: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-brand-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-text-2">{t('contratos.alertas.titulo')}</p>
      <ul className="mt-2 space-y-2">
        {alertas.map((a, i) => (
          <li key={`${a.contratoId}-${a.tipo}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-text">
              {t(`contratos.alerta.${a.tipo}`)
                .replace('{quien}', a.quien || t('contratos.alguien'))
                .replace('{tipo}', a.tipoEtiqueta.toLowerCase())
                .replace('{etapa}', (a.etapa ?? t('contratos.laContraparte')).toLowerCase())
                .replace('{horas}', String(a.horas ?? ''))}
            </p>
            <button
              onClick={() => onAbrir(a.contratoId)}
              className={`min-h-[40px] shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${
                a.tipo === 'enviar_contraparte' ? 'border-accent-line bg-accent-dim text-accent' : 'border-line-strong text-text hover:bg-surface-2'
              }`}
            >
              {a.tipo === 'enviar_contraparte' ? t('contratos.alerta.enviar') : t('contratos.alerta.abrir')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
