import styles from '../login.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.wrap} ${styles.footerInner}`}>
        <p className={styles.footerCopy}>© 2026 | Redinmo.io</p>
        <div className={styles.footerLinks}>
          <a href="/legal/terminos">Términos</a>
          <a href="/legal/privacidad">Privacidad</a>
          <a href="/legal/suscripcion">Suscripción</a>
          <a href="/legal/cookies">Cookies</a>
          <a href="/contacto">Contacto</a>
          <a href="#login">Admin</a>
        </div>
      </div>
    </footer>
  );
}
