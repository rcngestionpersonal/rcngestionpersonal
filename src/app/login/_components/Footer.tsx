import styles from '../login.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.wrap} ${styles.footerInner}`}>
        <p className={styles.footerCopy}>© 2026 | Redinmo.io</p>
        <div className={styles.footerLinks}>
          <a href="/soporte">Términos</a>
          <a href="/soporte">Privacidad</a>
          <a href="/contacto">Contacto</a>
          <a href="#login">Admin</a>
        </div>
      </div>
    </footer>
  );
}
