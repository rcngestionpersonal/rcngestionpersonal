'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, IdCard, MapPin, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import styles from '../login.module.css';

function CarnetCard() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const target = 'https://wa.me/593999999999?text=' + encodeURIComponent('Hola Roberto, vi tu carnet en Redinmo.io y quisiera conversar contigo.');
    QRCode.toDataURL(target, { width: 176, margin: 0, color: { dark: '#04201c', light: '#00000000' } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div aria-hidden="true" className={styles.carnetCardWrap}>
      <div className={styles.carnetCard}>
        <p className={styles.carnetHeader}>
          <b>REDINMO.IO</b> - CARNET DE AGENTE
        </p>
        <div className={styles.carnetIdentity}>
          <Image src="/landing/agente-rt.jpg" alt="Foto de Roberto Tapia" width={60} height={60} className={styles.carnetAvatar} style={{ objectFit: 'cover' }} />
          <div>
            <p className={styles.carnetName}>Roberto Tapia</p>
            <div className={styles.profileChips}>
              <span className={styles.chipTeal}>✓ VERIFICADO</span>
              <span className={styles.chipViolet}>● AGENTE ELITE</span>
            </div>
          </div>
        </div>
        <p className={styles.carnetZones}>
          <MapPin className="h-3 w-3" strokeWidth={1.8} />
          Centro Norte · Valles · Residencial y comercial
        </p>
        <div className={styles.carnetStats}>
          <div className={styles.carnetStat}>
            <p className={styles.carnetStatValue}>#5</p>
            <p className={styles.carnetStatLabel}>En la red</p>
          </div>
          <div className={styles.carnetStat}>
            <p className={styles.carnetStatValue}>18</p>
            <p className={styles.carnetStatLabel}>Cierres</p>
          </div>
          <div className={styles.carnetStat}>
            <p className={styles.carnetStatValue}>2026</p>
            <p className={styles.carnetStatLabel}>Vigente</p>
          </div>
        </div>
        <div className={styles.carnetQr}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qrDataUrl ? <img src={qrDataUrl} alt="" className={styles.carnetQrImg} /> : <div className={styles.carnetQrImg} />}
          <div>
            <p className={styles.carnetQrText}>Escáneame y hablemos</p>
            <p className={styles.carnetQrSubtext}>Abre WhatsApp con un mensaje listo</p>
          </div>
        </div>
        <button type="button" className={styles.carnetShareBtn}>
          <Share2 className="h-3 w-3" strokeWidth={2} />
          COMPARTIR CON MI CLIENTE
        </button>
        <p className={styles.carnetFooter}>Verificable en redinmo.io/v/roberto-tapia</p>
      </div>
    </div>
  );
}

export default function CarnetSection() {
  return (
    <section id="carnet" className={styles.carnetSection}>
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.carnetGrid}>
          <div>
            <p className={styles.eyebrow}>
              <IdCard className="h-[13px] w-[13px]" strokeWidth={2} />
              TU CREDENCIAL DE AGENTE
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
                  <b>Habla de resultados.</b> Nivel, cierres registrados y vigencia al día. Deja de prometer profesionalismo:
                  muéstralo.
                </p>
              </div>
            </div>
          </div>

          <CarnetCard />
        </div>
      </div>
    </section>
  );
}
