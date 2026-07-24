'use client';

import { levelColorFor } from '@/lib/real-estate/points';
import type { RankingLevelClient } from './types';

// Celebracion de subida de nivel: se muestra UNA vez por evento level_up (el
// padre ya filtro por getUnseenLevelUp / solo el nivel mas alto alcanzado) y
// nunca para bajadas o recalculos de admin, porque esos nunca generan un
// evento LEVEL_UP en points-log.ts. Sin confetti: solo un pulso sutil en el
// chip de nivel, que respeta prefers-reduced-motion via la clase
// motion-reduce.
export default function LevelUpCelebrationModal({
  level,
  lang,
  t,
  subscriptionActive,
  onShare,
  onViewCarnet,
  onDismiss,
}: {
  level: RankingLevelClient;
  lang: 'es' | 'en';
  t: (k: string) => string;
  subscriptionActive: boolean;
  onShare: () => void;
  onViewCarnet: () => void;
  onDismiss: () => void;
}) {
  const levelLabel = lang === 'es' ? level.labelEs : level.labelEn;
  const levelColor = levelColorFor(level.key);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onClick={onDismiss}>
      <div
        className="w-full max-w-[360px] rounded-[16px] border-t-2 bg-[#141722] p-5 text-center shadow-2xl"
        style={{ borderTopColor: '#2dd4bf' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('levelUp.titulo')}
      >
        <p className="text-[15px] font-bold text-white">🎉 {t('levelUp.titulo')}</p>

        <p className="mt-3 text-xs text-[#9296b0]">{t('levelUp.ahoraEres')}</p>
        <span
          className="mt-2 inline-flex animate-[levelup-pulse_2.5s_ease-in-out_1] items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-bold motion-reduce:animate-none"
          style={{ borderColor: `${levelColor}55`, background: `${levelColor}1f`, color: levelColor }}
        >
          ● {levelLabel}
        </span>

        <p className="mt-4 text-[13px] leading-relaxed text-[#9296b0]">{t('levelUp.mensaje')}</p>

        {!subscriptionActive ? <p className="mt-2 text-[11.5px] text-[#62667f]">{t('levelUp.reactivar')}</p> : null}

        <div className="mt-5 space-y-2">
          {subscriptionActive ? (
            <button
              onClick={onShare}
              className="w-full rounded-[10px] bg-[#2dd4bf] py-2.5 text-sm font-bold text-[#04201c] transition-opacity hover:opacity-90"
            >
              {t('levelUp.compartir')}
            </button>
          ) : null}
          <button
            onClick={onViewCarnet}
            className="w-full rounded-[10px] border border-white/10 py-2.5 text-sm font-semibold text-[#9296b0] transition-colors hover:text-white"
          >
            {t('levelUp.verCarnet')}
          </button>
          <button onClick={onDismiss} className="w-full py-1.5 text-xs font-semibold text-[#62667f] transition-colors hover:text-white/70">
            {t('levelUp.ahoraNo')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes levelup-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0); }
          50% { box-shadow: 0 0 0 6px rgba(45, 212, 191, 0.18); }
        }
      `}</style>
    </div>
  );
}
