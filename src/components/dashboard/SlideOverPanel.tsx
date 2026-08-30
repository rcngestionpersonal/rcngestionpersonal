'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Panel deslizante compartido del Mapa de Cierres (Fase 5): bottom sheet en movil,
// modal lateral (drawer de borde derecho) en escritorio - nunca navega a otra pantalla.
// Generaliza el patron que antes vivia hardcodeado por separado en CarnetShareModal y
// LevelUpCelebrationModal (ver nota de exploracion), esta vez con una variante "lateral"
// en vez de centrada para desktop, como pide el punto 1.2 del pedido.
export default function SlideOverPanel({
  open,
  onClose,
  title,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-stretch sm:justify-end"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        className={`flex w-full max-w-[480px] flex-col overflow-hidden rounded-t-[24px] border border-line bg-bg-alt shadow-2xl transition-transform duration-300 ease-out sm:h-full sm:max-h-none sm:max-w-[440px] sm:rounded-t-none sm:rounded-l-[24px] ${
          visible ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full'
        }`}
        style={{ maxHeight: '92vh' }}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="min-w-0 truncate text-[17px] font-bold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
