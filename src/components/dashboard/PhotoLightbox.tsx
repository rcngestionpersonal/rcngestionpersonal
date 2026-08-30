'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// Galeria navegable del inmueble (Fase 4, seccion 3.c) - overlay a pantalla
// completa con flechas y contador, reutilizado desde la miniatura de la
// tarjeta de Inmuebles. Solo lectura: nunca administra las fotos (eso vive
// en ListingPhotoManager, dentro del formulario de edicion).
export default function PhotoLightbox({
  photos,
  initialIndex = 0,
  onClose,
}: {
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0)));

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photos.length, onClose]);

  if (photos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/92 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-xs font-semibold text-white/80">{index + 1} / {photos.length}</span>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 transition-colors hover:bg-white/20"
        >
          <X className="h-4.5 w-4.5" strokeWidth={2} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-3 pb-6">
        {photos.length > 1 ? (
          <button
            onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
            aria-label="Foto anterior"
            className="absolute left-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-4"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[index]}
          alt={`Foto ${index + 1} de ${photos.length}`}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        />

        {photos.length > 1 ? (
          <button
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
            aria-label="Foto siguiente"
            className="absolute right-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {photos.length > 1 ? (
        <div className="flex justify-center gap-1.5 pb-4">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Ir a la foto ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-200 ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/35'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
