import styles from './login.module.css';
import Navbar from './_components/Navbar';
import Hero from './_components/Hero';
import { PainSection, HowItWorksSection, ColegasSection, BeneficiosSection, PrecioSection, FaqSection } from './_components/Sections';
import CarnetSection from './_components/CarnetSection';
import LoginSection from './_components/LoginSection';
import Footer from './_components/Footer';
import SmoothScroll from './_components/SmoothScroll';

export default function LoginPage() {
  return (
    <main className={styles.root}>
      <SmoothScroll />
      <Navbar />
      <Hero />
      <PainSection />
      <HowItWorksSection />
      <ColegasSection />
      <BeneficiosSection />
      <CarnetSection />
      <PrecioSection />
      <FaqSection />
      <LoginSection />
      <Footer />
    </main>
  );
}
