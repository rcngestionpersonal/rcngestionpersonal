'use client';

import { Check, IdCard } from 'lucide-react';
import { BrokerCard, type BrokerCardData } from '@/components/dashboard/BrokerCard';
import styles from '../login.module.css';

// Datos de ejemplo para ilustrar el carnet en la landing. El componente es el
// MISMO BrokerCard que ve un agente real en Ranking - un solo diseño de
// carnet en todo el producto, mantenido en un solo lugar (ver
// src/components/dashboard/BrokerCard.tsx).
const EXAMPLE_CARNET_DATA: BrokerCardData = {
  displayName: 'Roberto Tapia',
  photoUrl: '/landing/agente-rt.jpg',
  verified: true,
  level: { key: 'BROKER_ELITE', labelEs: 'Agente Elite', labelEn: 'Elite Agent', min: 1200 },
  totalPoints: 1620,
  rank: 5,
  cierres: 18,
  listingsActive: 24,
  joinYear: 2022,
  specializationZones: ['CENTRO_NORTE', 'VALLE_CHILLOS'],
  phone: '+593999999999',
  subscriptionActive: true,
  carnetSlug: 'roberto-tapia',
  yearsExperience: 6,
};

// La landing no tiene LanguageProvider (es 100% espanol, ver decision del
// 2026-08-29) - BrokerCard solo necesita estas 4 claves para audience
// "colegas", asi que se resuelven aqui sin depender del dictionary.ts.
const CARNET_STRINGS_ES: Record<string, string> = {
  'ranking.carnet.tipo': '· CARNET DE AGENTE',
  'shell.verificado': 'Verificado',
  'ranking.carnet.cierresLabel': 'CIERRES',
  'ranking.carnet.puntosLabel': 'PUNTOS',
};

function landingCarnetT(key: string): string {
  return CARNET_STRINGS_ES[key] ?? key;
}

export default function CarnetSection() {
  return (
    <section id="carnet" className={styles.carnetSection}>
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.carnetGrid}>
          <div>
            <p className={styles.eyebrow}>
              <IdCard className="h-[13px] w-[13px]" strokeWidth={2} />
              TU CARNET DE AGENTE
            </p>
            <h2 className={styles.h2}>
              <span className={styles.h2Grad}>La forma más rápida de demostrarle a un cliente que eres un agente serio</span>
            </h2>
            <div className={styles.bulletList}>
              <div className={styles.bullet}>
                <span className={styles.bulletIcon}>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <p className={styles.bulletText}>
                  <b>Imposible de falsificar.</b> Tu carnet tiene una página pública donde cualquiera comprueba que está
                  vigente. Una captura de pantalla no sirve.
                </p>
              </div>
              <div className={styles.bullet}>
                <span className={styles.bulletIcon}>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <p className={styles.bulletText}>
                  <b>Se comparte en un toque.</b> Por WhatsApp, en tus redes o impreso. Con código QR que abre un chat contigo
                  y un mensaje ya escrito.
                </p>
              </div>
              <div className={styles.bullet}>
                <span className={styles.bulletIcon}>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <p className={styles.bulletText}>
                  <b>Habla de resultados.</b> Tu nivel, años de experiencia, sectores en los que te especializas y vigencia al
                  día. Deja de prometer profesionalismo: muéstralo.
                </p>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className={styles.carnetCardWrap}>
            <BrokerCard data={EXAMPLE_CARNET_DATA} audience="colegas" lang="es" t={landingCarnetT} />
          </div>
        </div>
      </div>
    </section>
  );
}
