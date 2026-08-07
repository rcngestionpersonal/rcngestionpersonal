import Image from 'next/image';
import { ArrowRight, Check, Users } from 'lucide-react';
import styles from '../login.module.css';

function MatchCluster() {
  return (
    <div aria-hidden="true">
      <p className={styles.demoTitle}>ASÍ SE VE UN MATCH</p>
      <div className={styles.cluster}>
        <div className={styles.halfA}>
          <div className={styles.halfTop}>
            <div className={styles.halfIdentity}>
              <Image src="/landing/agente-mj.jpg" alt="" width={34} height={34} className={styles.halfAvatar} style={{ objectFit: 'cover' }} />
              <span>
                <span className={styles.halfName}>María José Andrade</span>
                <span className={styles.halfMeta}>
                  <span className={styles.levelChip}>● AGENTE ELITE</span>
                  <span className={styles.rankNote}>#3 EN LA RED</span>
                </span>
              </span>
            </div>
            <span className={styles.sideLabel}>SU INMUEBLE</span>
          </div>
          <p className={styles.halfHeadline}>
            Depto 2 hab · La Carolina — <span className={styles.halfPrice}>$128.000</span>
          </p>
          <div className={styles.chipsRow}>
            <span className={styles.detailChip}>78 m²</span>
            <span className={styles.detailChip}>2 dorm · 2 baños</span>
            <span className={styles.detailChip}>1 parqueo</span>
          </div>
        </div>

        <div className={styles.mdiv}>
          <span className={styles.mbadge}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5c.6 3.6 2 6.4 4.5 7.7 1 .5 2 .9 3 1.1-1 .2-2 .6-3 1.1-2.5 1.3-3.9 4.1-4.5 7.7-.6-3.6-2-6.4-4.5-7.7-1-.5-2-.9-3-1.1 1-.2 2-.6 3-1.1 2.5-1.3 3.9-4.1 4.5-7.7Z" />
            </svg>
            MATCH · 96%
          </span>
        </div>

        <div className={styles.halfB}>
          <div className={styles.halfTop}>
            <div className={styles.halfIdentity}>
              <Image src="/landing/agente-rt.jpg" alt="" width={34} height={34} className={styles.halfAvatar} style={{ objectFit: 'cover' }} />
              <span>
                <span className={styles.halfName}>Roberto Tapia</span>
                <span className={styles.halfMeta}>
                  <span className={styles.levelChip}>● AGENTE ELITE</span>
                  <span className={styles.rankNote}>#5 EN LA RED</span>
                </span>
              </span>
            </div>
            <span className={styles.sideLabel}>TU PEDIDO</span>
          </div>
          <p className={styles.halfHeadline}>
            Busca depto en La Carolina · hasta <span className={styles.halfPrice}>$135.000</span>
          </p>
          <div className={styles.chipsRow}>
            <span className={styles.detailChip}>70–90 m²</span>
            <span className={styles.detailChip}>2 dorm</span>
            <span className={styles.detailChip}>Crédito hipotecario</span>
          </div>
        </div>
      </div>

      <div className={styles.demoNotes}>
        <p className={styles.demoNote}>
          <Check className="h-3 w-3" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
          Cargas un pedido y el sistema te trae los inmuebles de tus colegas que encajan.
        </p>
        <p className={styles.demoNote}>
          <Check className="h-3 w-3" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
          Cargas un inmueble y te trae los pedidos que tus colegas están buscando.
        </p>
        <p className={styles.demoNote}>
          <Check className="h-3 w-3" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
          Hablas directo con tu colega, acuerdan la comisión y cierran juntos.
        </p>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.dots} aria-hidden="true" />
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.eyebrow}>
              <Users className="h-[13px] w-[13px]" strokeWidth={2} />
              EXCLUSIVO PARA AGENTES INMOBILIARIOS
            </p>
            <h1 className={styles.h1}>
              <span className={styles.h1Grad}>El inmueble que tu cliente busca ya existe.</span>{' '}
              <span className={styles.h1Violet}>Lo tiene un colega y aún no lo sabes.</span>
            </h1>
            <p className={styles.lead}>
              Redinmo.io cruza tu <b>inventario de inmuebles</b> y los <b>pedidos de tus clientes</b> con los de todos tus colegas
              verificados. Cuando hace match, te avisa. Tú solo cargas y cierras.
            </p>
            <div className={styles.heroCtas}>
              <a href="#precio" className={styles.btnGrad}>
                Crear mi cuenta de agente
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </a>
              <a href="#como" className={styles.btnGhost}>
                Ver cómo funciona
              </a>
            </div>
            <div className={styles.heroNotes}>
              <span className={styles.heroNote}>
                <Check className="h-3 w-3" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
                30 días gratis
              </span>
              <span className={styles.heroNote}>
                <Check className="h-3 w-3" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
                Sin comisión sobre tus cierres
              </span>
              <span className={styles.heroNote}>
                <Check className="h-3 w-3" style={{ color: 'var(--teal)' }} strokeWidth={2.5} />
                Cancelas cuando quieras
              </span>
            </div>
          </div>

          <MatchCluster />
        </div>
      </div>
    </section>
  );
}
