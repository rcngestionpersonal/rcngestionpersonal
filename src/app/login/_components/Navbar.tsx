import { Sparkle } from 'lucide-react';
import styles from '../login.module.css';

export default function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={styles.navInner}>
        <div className={styles.navBrand}>
          <Sparkle aria-hidden="true" className="h-[13px] w-[13px]" style={{ color: 'var(--brand)' }} strokeWidth={2} />
          REDINMO.IO
        </div>
        <nav className={styles.navLinks} aria-label="Navegación principal">
          <a href="#como" className={`${styles.linkHover} ${styles.navLink}`}>
            Cómo funciona
          </a>
          <a href="#colegas" className={`${styles.linkHover} ${styles.navLink}`}>
            Tus colegas
          </a>
          <a href="#carnet" className={`${styles.linkHover} ${styles.navLink}`}>
            Carnet
          </a>
          <a href="#precio" className={`${styles.linkHover} ${styles.navLink}`}>
            Precio
          </a>
        </nav>
        <a href="#login" className={styles.navCta}>
          Ingresar
        </a>
      </div>
    </header>
  );
}
