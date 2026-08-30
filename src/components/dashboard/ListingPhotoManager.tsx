'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Star, Trash2, Upload } from 'lucide-react';

export type GalleryItem = {
  key: string;
  previewUrl: string;
  isCover: boolean;
};

// Administrador de la galeria de fotos del inmueble (Fase 4): agregar
// (seleccion multiple), reordenar arrastrando, marcar portada, eliminar. Es
// deliberadamente "tonto" respecto al origen de los datos - el llamador
// decide si `items` viene de fotos ya subidas (edicion) o de archivos locales
// todavia sin inmueble donde subirlos (alta) y que hace cada callback en
// cada caso; este componente solo dibuja la grilla y el drag-and-drop.
export default function ListingPhotoManager({
  items,
  maxPhotos,
  uploading,
  disabled,
  onAddFiles,
  onDelete,
  onSetCover,
  onReorder,
  t,
}: {
  items: GalleryItem[];
  maxPhotos: number;
  uploading?: boolean;
  disabled?: boolean;
  onAddFiles: (files: FileList) => void;
  onDelete: (key: string) => void;
  onSetCover: (key: string) => void;
  onReorder: (newKeyOrder: string[]) => void;
  t: (k: string) => string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const canAddMore = items.length < maxPhotos && !disabled;

  function handleDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null);
      setOverKey(null);
      return;
    }
    const order = items.map((i) => i.key);
    const from = order.indexOf(dragKey);
    const to = order.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, dragKey);
    onReorder(order);
    setDragKey(null);
    setOverKey(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-text-2">{t('inmuebles.fotos.label')}</p>
        <span className="text-xs text-text-3">{items.length}/{maxPhotos}</span>
      </div>
      <p className="mt-1 text-[11px] text-text-3">{t('inmuebles.fotos.ayuda')}</p>

      <div className="mt-2.5 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.key}
            draggable={!disabled}
            onDragStart={() => setDragKey(item.key)}
            onDragOver={(e) => {
              e.preventDefault();
              if (overKey !== item.key) setOverKey(item.key);
            }}
            onDragLeave={() => setOverKey((k) => (k === item.key ? null : k))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(item.key);
            }}
            onDragEnd={() => {
              setDragKey(null);
              setOverKey(null);
            }}
            className={`group relative aspect-square cursor-grab overflow-hidden rounded-[11px] border bg-surface-2 transition-all active:cursor-grabbing ${
              overKey === item.key && dragKey && dragKey !== item.key ? 'border-brand ring-2 ring-brand/40' : 'border-line'
            } ${dragKey === item.key ? 'opacity-40' : ''}`}
          >
            <Image src={item.previewUrl} alt="" fill sizes="140px" className="pointer-events-none object-cover" />

            {item.isCover ? (
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-accent-contrast">
                <Star className="h-2.5 w-2.5 fill-current" strokeWidth={0} />
                {t('inmuebles.fotos.portada')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSetCover(item.key)}
                disabled={disabled}
                aria-label={t('inmuebles.fotos.marcarPortada')}
                title={t('inmuebles.fotos.marcarPortada')}
                className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white opacity-0 transition-opacity duration-150 hover:bg-black/65 group-hover:opacity-100 disabled:cursor-not-allowed"
              >
                <Star className="h-3 w-3" strokeWidth={2} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onDelete(item.key)}
              disabled={disabled}
              aria-label={t('inmuebles.fotos.eliminar')}
              title={t('inmuebles.fotos.eliminar')}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white opacity-0 transition-opacity duration-150 hover:border-danger hover:bg-danger/80 group-hover:opacity-100 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
        ))}

        {canAddMore ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[11px] border border-dashed border-line-strong bg-transparent text-text-3 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            <span className="text-[10.5px] font-semibold">{uploading ? t('inmuebles.fotos.subiendo') : t('inmuebles.fotos.agregar')}</span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onAddFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
