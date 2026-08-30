import Image from 'next/image';
import {
  BarChart3,
  Check,
  ClipboardList,
  Clock,
  Crown,
  EyeOff,
  FileText,
  Globe,
  Handshake,
  IdCard,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  MessageSquareOff,
  ShieldCheck,
  Sparkle,
  Sparkles,
  Target,
  Upload,
  UserX,
  Zap,
} from 'lucide-react';
import { POINT_ACTIONS } from '@/lib/real-estate/points';
import { PLANES } from '@/config/planes';
import styles from '../login.module.css';

export function PainSection() {
  return (
    <section className={styles.painSection}>
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.headCenter}>
          <p className={styles.eyebrow}>
            <Clock className="h-[13px] w-[13px]" strokeWidth={2} />
            LO QUE HOY TE CUESTA DINERO
          </p>
          <h2 className={styles.h2}>
            <span className={styles.h2Grad}>Trabajas solo, y por eso cierras menos de lo que podrías</span>
          </h2>
        </div>
        <div className={styles.grid3}>
          <div className={styles.card}>
            <span className={styles.sicR}>
              <MessageSquareOff className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h3 className={styles.cardH3}>Tu pedido se hunde en el chat</h3>
            <p className={styles.cardP}>
              Escribes lo que busca tu cliente en los grupos de siempre. En minutos queda sepultado y nadie vuelve a leerlo. El
              colega que tenía el inmueble jamás se enteró.
            </p>
          </div>
          <div className={styles.card}>
            <span className={styles.sicR}>
              <EyeOff className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h3 className={styles.cardH3}>Tasas tus inmuebles con precios irreales</h3>
            <p className={styles.cardP}>
              Los portales muestran lo que la gente pide, no lo que realmente se paga. Sales al mercado con un precio irreal y
              la propiedad se queda meses sin moverse.
            </p>
          </div>
          <div className={styles.card}>
            <span className={styles.sicR}>
              <UserX className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h3 className={styles.cardH3}>No sabes con quién estás tratando</h3>
            <p className={styles.cardP}>
              Compartir un negocio con un colega que no conoces da miedo: no sabes si responde, si es serio ni si va a
              respetar el acuerdo. Y ese miedo te cuesta operaciones.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  const steps = [
    {
      icon: <Upload className="h-5 w-5" strokeWidth={1.8} />,
      title: 'Carga tus inmuebles y pedidos',
      body: 'Registra tu inventario de inmuebles y lo que cada cliente te pidió. Menos de un minuto por ficha, desde el celular.',
      points: `+${POINT_ACTIONS.LISTING_CREATED.points} puntos por cada uno`,
    },
    {
      icon: <Sparkles className="h-5 w-5" strokeWidth={1.8} />,
      title: 'Recibe tus matches',
      body: 'El sistema compara zona, precio, tipo y características con el inventario de todos tus colegas verificados. Cuando hace match, te avisa.',
      points: `+${POINT_ACTIONS.MATCH_RECEIVED.points} puntos por match`,
    },
    {
      icon: <Handshake className="h-5 w-5" strokeWidth={1.8} />,
      title: 'Cierra con tu colega',
      body: 'Hablas con él por WhatsApp, acuerdan cómo reparten la comisión y cierran. Redinmo.io no participa del negocio ni te cobra un porcentaje.',
      points: `Registra el cierre: +${POINT_ACTIONS.CLOSING_REGISTERED.points} puntos`,
    },
  ];

  return (
    <section id="como" className={styles.howSection}>
      <div className={styles.dotsSoft} aria-hidden="true" />
      <div className={styles.gv} style={{ width: 460, height: 460, top: -140, left: '50%', transform: 'translateX(-50%)' }} aria-hidden="true" />
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.headCenter}>
          <p className={styles.eyebrow}>
            <Zap className="h-[13px] w-[13px]" strokeWidth={2} />
            ASÍ FUNCIONA
          </p>
          <h2 className={styles.h2}>
            <span className={styles.h2Grad}>Tres pasos y la red de colegas empieza a trabajar para ti</span>
          </h2>
          <p className={styles.sectionLead}>
            Redinmo.io es un motor que hace <span className={styles.matchHighlight}>MATCH</span> de tus inmuebles con los
            pedidos de tus colegas. Y mucho más.
          </p>
        </div>
        <div className={styles.steps}>
          {steps.map((step, i) => (
            <div key={step.title} className={styles.stepCard}>
              <div className={styles.stepHead}>
                <span className={styles.stepNum}>{i + 1}</span>
                <span className={styles.sic}>{step.icon}</span>
              </div>
              <h3 className={styles.cardH3}>{step.title}</h3>
              <p className={styles.cardP}>{step.body}</p>
              <span className={styles.pointsChip}>
                <Sparkle className="h-[11px] w-[11px]" strokeWidth={2} />
                {step.points}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ColegasSection() {
  return (
    <section id="colegas" className={styles.colegasSection}>
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.colegasGrid}>
          <div>
            <p className={styles.eyebrow}>
              <ShieldCheck className="h-[13px] w-[13px]" strokeWidth={2} />
              EL PROBLEMA DE TRABAJAR CON COLEGAS, RESUELTO
            </p>
            <h2 className={styles.h2}>
              <span className={styles.h2Grad}>Ahora sí puedes saber cómo trabaja el colega antes de compartirle un negocio</span>
            </h2>
            <p className={styles.sectionLead} style={{ margin: '12px 0 0', textAlign: 'left' }}>
              Si nunca te gustó trabajar con otros agentes, casi siempre fue por lo mismo: no los conocías. Aquí cada colega
              tiene una hoja de vida que se construye sola con su propia gestión.
            </p>
            <div className={styles.bulletList}>
              <div className={styles.bullet}>
                <span className={styles.bulletIcon}>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <p className={styles.bulletText}>
                  <b>Identidad verificada.</b> Cada cuenta pasa por validación antes de operar. Sabes que la persona existe y
                  es quien dice ser.
                </p>
              </div>
              <div className={styles.bullet}>
                <span className={styles.bulletIcon}>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <p className={styles.bulletText}>
                  <b>Puntos que no se pueden inventar.</b> Cada inmueble cargado, cada seguimiento y cada cierre registrado
                  suman. Un puntaje alto significa un colega activo y constante.
                </p>
              </div>
              <div className={styles.bullet}>
                <span className={styles.bulletIcon}>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <p className={styles.bulletText}>
                  <b>Niveles visibles.</b> De Agente Inicial a Agente Elite. Antes de escribirle, ya sabes en qué nivel juega.
                </p>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className={styles.profileCard}>
            <div className={styles.profileHead}>
              <Image src="/landing/agente-mj.jpg" alt="" width={54} height={54} className={styles.profileAvatar} style={{ objectFit: 'cover' }} />
              <div>
                <p className={styles.profileName}>María José Andrade</p>
                <div className={styles.profileChips}>
                  <span className={styles.chipTeal}>✓ VERIFICADA</span>
                  <span className={styles.chipViolet}>● AGENTE ELITE</span>
                </div>
              </div>
            </div>
            <div className={styles.profileStats}>
              <div className={styles.profileStatRow}>
                <span className={styles.profileStatIcon}>
                  <IdCard className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className={styles.profileStatLabel}>Inmuebles en su inventario</span>
                <span className={styles.profileStatValue}>24</span>
              </div>
              <div className={styles.profileStatRow}>
                <span className={styles.profileStatIcon}>
                  <Sparkles className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className={styles.profileStatLabel}>Matches generados</span>
                <span className={styles.profileStatValue}>11</span>
              </div>
              <div className={styles.profileStatRow}>
                <span className={styles.profileStatIcon}>
                  <MapPin className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className={styles.profileStatLabel}>Data aportada al Mapa de Precios</span>
                <span className={styles.profileStatValue}>18</span>
              </div>
              <div className={styles.profileStatRow}>
                <span className={styles.profileStatIcon}>
                  <BarChart3 className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className={styles.profileStatLabel}>Constancia (12 meses)</span>
                <span className={styles.chipTeal}>Alta</span>
              </div>
            </div>
            <div className={styles.levelBarWrap}>
              <div className={styles.levelBarLabels}>
                <span>
                  <b>Agente Elite</b>
                </span>
                <span>1.480 puntos</span>
              </div>
              <div className={styles.levelBarTrack}>
                <div className={styles.levelBarFill} style={{ width: '74%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BeneficiosSection() {
  return (
    <section className={styles.benefitsSection}>
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.headCenter}>
          <p className={styles.eyebrow}>
            <Target className="h-[13px] w-[13px]" strokeWidth={2} />
            LO QUE TE LLEVAS
          </p>
          <h2 className={styles.h2}>
            <span className={styles.h2Grad}>Herramientas que ningún portal le da a un agente</span>
          </h2>
        </div>
        <div className={styles.benefitsGrid}>
          <div className={styles.benefitCardBig}>
            <span className={styles.sicT}>
              <MapPin className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h3 className={styles.cardH3}>Mapa de Precios de Cierre</h3>
            <p className={styles.cardP}>
              El dato que nadie publica: a cuánto se cierra de verdad en cada sector, en dólares por metro cuadrado.{' '}
              <span className={styles.cardEm}>Lo construyes con tus colegas</span> de forma anónima y te sirve para tasar con
              evidencia y ganar la captación frente al propietario que pide un precio imposible.
            </p>
            <div className={styles.miniViz}>
              <span className={styles.miniVizValue}>
                $1.640 <span className={styles.miniVizUnit}>/m²</span>
              </span>
              <p className={styles.miniVizLabel}>Promedio real del sector</p>
              <div className={styles.miniBars}>
                {[38, 52, 46, 76, 60, 88, 54, 70].map((h, i) => (
                  <div
                    key={i}
                    className={`${styles.miniBar} ${i === 3 || i === 5 ? styles.miniBarActive : ''}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className={styles.miniVizFoot}>
                <span>Últimos 12 meses</span>
                <span>
                  Se cierra <b>9% bajo</b> lo publicado
                </span>
              </div>
            </div>
          </div>

          <div className={styles.benefitSmallGrid}>
            <div className={styles.card}>
              <span className={styles.sic}>
                <IdCard className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h3 className={styles.cardH3}>Tu inventario, siempre ordenado</h3>
              <p className={styles.cardP}>
                Inmuebles, pedidos, matches y seguimientos en un solo lugar. Deja de buscar en notas, capturas y chats viejos.
              </p>
            </div>
            <div className={styles.card}>
              <span className={styles.sic}>
                <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h3 className={styles.cardH3}>Reputación que se ve</h3>
              <p className={styles.cardP}>
                Tu constancia deja de ser invisible. Cada acción suma puntos, sube tu nivel y tus colegas lo notan cuando
                eligen con quién trabajar.
              </p>
            </div>
            <div className={styles.card}>
              <span className={styles.sic}>
                <Lock className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <h3 className={styles.cardH3}>Tus clientes siguen siendo tuyos</h3>
              <p className={styles.cardP}>
                Los datos de contacto de tus clientes nunca se muestran a nadie. Compartes el negocio, no tu cliente.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.proBenefits}>
          <p className={styles.proBenefitsHead}>
            <span className={styles.proChip}>PRO</span>
            Además, con el plan Pro
          </p>
          <div className={styles.bulletList}>
            <div className={styles.bullet}>
              <span className={styles.bulletIcon}>
                <Globe className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <p className={styles.bulletText}>
                <b>Mini-sitio profesional.</b> Tu página pública con tu inventario, tu carnet verificado y un formulario que te
                trae pedidos directos.
              </p>
            </div>
            <div className={styles.bullet}>
              <span className={styles.bulletIcon}>
                <FileText className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <p className={styles.bulletText}>
                <b>Fichas de inmueble en PDF.</b> Descarga la ficha de cualquier inmueble con tus datos de contacto, lista para
                enviar a tu cliente.
              </p>
            </div>
            <div className={styles.bullet}>
              <span className={styles.bulletIcon}>
                <Mail className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <p className={styles.bulletText}>
                <b>Carta de presentación.</b> Genera cartas profesionales para propietarios, constructoras o colegas, con tu
                experiencia y tu inventario.
              </p>
            </div>
            <div className={styles.bullet}>
              <span className={styles.bulletIcon}>
                <ClipboardList className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <p className={styles.bulletText}>
                <b>Reportes a clientes.</b> Informa a tu propietario cada semana qué hiciste por su propiedad. Con tu marca.
              </p>
            </div>
            <div className={styles.bullet}>
              <span className={styles.bulletIcon}>
                <Crown className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <p className={styles.bulletText}>
                <b>Carnet Pro destacado.</b> Un diseño exclusivo que te distingue frente a tus colegas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PrecioSection() {
  const basico = PLANES.BASICO;
  const pro = PLANES.PRO;

  const basicoFeatures = [
    'Matches ilimitados con tus colegas',
    'Gestión de inmuebles, pedidos y seguimientos',
    'Mapa de Precios de Cierre · lo construimos entre todos',
    'Carnet de agente verificable',
    'Ranking y niveles',
  ];

  const proFeatures = [
    'Todo lo del plan Básico',
    'Mini-sitio profesional con tu inventario',
    'Fichas de inmueble en PDF con tus datos',
    'Cartas de presentación',
    'Reportes a clientes',
    'Carnet Pro destacado',
  ];

  return (
    <section id="precio" className={styles.pricingSection}>
      <div className={styles.dots} aria-hidden="true" />
      <div className={styles.gv} style={{ width: 420, height: 420, top: 40, right: -140 }} aria-hidden="true" />
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.headCenter}>
          <p className={styles.eyebrow}>
            <Zap className="h-[13px] w-[13px]" strokeWidth={2} />
            PLANES
          </p>
          <h2 className={styles.h2}>
            <span className={styles.h2Grad}>Elige cómo quieres trabajar</span>
          </h2>
          <p className={styles.sectionLead}>
            Empieza con 30 días de acceso Pro completo, gratis. Al terminar eliges con qué plan continuar.
          </p>
        </div>

        <div className={styles.plansGrid}>
          <div className={styles.planCard}>
            <p className={styles.planName}>{basico.nombre}</p>
            <div className={styles.planPrice}>
              <span className={styles.planPriceValue}>{basico.etiqueta}</span>
              <span className={styles.planPriceUnit}>al mes</span>
            </div>
            <p className={styles.planTagline}>{basico.bajada}</p>
            <div className={styles.valueStack}>
              {basicoFeatures.map((text) => (
                <div key={text} className={styles.valueRow}>
                  <span className={styles.valueCheck}>
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span className={styles.valueText}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${styles.planCard} ${styles.planCardPro}`}>
            <span className={styles.planRecommended}>Recomendado</span>
            <p className={styles.planName}>{pro.nombre}</p>
            <div className={styles.planPrice}>
              <span className={styles.planPriceValue}>{pro.etiqueta}</span>
              <span className={styles.planPriceUnit}>al mes</span>
            </div>
            <p className={styles.planTagline}>{pro.bajada}</p>
            <div className={styles.valueStack}>
              {proFeatures.map((text) => (
                <div key={text} className={styles.valueRow}>
                  <span className={styles.valueCheck}>
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <span className={styles.valueText}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.offerCtaWrap}>
          <a href="/agentes/registro" className={styles.offerCta}>
            Empezar mis 30 días gratis
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
          <p className={styles.offerMicro}>Sin tarjeta para empezar. Cancela cuando quieras.</p>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  const faqs = [
    {
      q: '¿Un colega puede quedarse con mi cliente?',
      a: 'No. Los datos de contacto de tu cliente no son visibles para nadie más. Tu colega ve únicamente que existe un match con tu pedido o tu inmueble, y te escribe a ti.',
    },
    {
      q: '¿Redinmo.io se queda con parte de mi comisión?',
      a: 'Jamás. Pagas tu suscripción mensual y nada más. Cómo reparten la comisión entre ustedes es un acuerdo entre colegas, no de la plataforma.',
    },
    {
      q: 'Nunca me ha gustado trabajar con otros agentes. ¿Por qué ahora sí?',
      a: 'Porque por primera vez puedes ver cómo trabaja el colega antes de involucrarlo: identidad verificada, nivel alcanzado y puntos que solo se consiguen con gestión real. Ya no dependes de la suerte ni de la recomendación de un tercero.',
    },
    {
      q: 'Si registro un cierre, ¿queda expuesto mi negocio?',
      a: 'No. El Mapa de Precios de Cierre es totalmente anónimo: no se guarda quién cargó el dato, ni el cliente, ni la dirección exacta. Solo el precio y las características, agrupados por sector.',
    },
    {
      q: '¿Los cierres que registro tienen que ser nuevos, desde que entro a Redinmo.io?',
      a: 'No. Puedes registrar cierres que ya lograste hasta 6 meses atrás. Lo que buscamos no es la fecha, es que el dato sea real: mientras más cierres reales carguen tú y tus colegas, más confiable es el Mapa de Precios de Cierre para todos.',
    },
    {
      q: '¿Es un portal más de los que ya pago?',
      a: 'No. Los portales te venden contactos de compradores. Redinmo.io conecta tu inventario con el de otros agentes verificados para que cierren juntos. Es la otra mitad del negocio, la que hoy nadie te resuelve.',
    },
    {
      q: '¿Necesito saber de tecnología?',
      a: 'Funciona desde el celular y cargar una ficha toma menos de un minuto. Si manejas WhatsApp, manejas Redinmo.io.',
    },
    {
      q: '¿Cómo entro si ningún colega me invitó?',
      a: 'Puedes registrarte directamente. Si un colega te compartió su enlace de invitación, úsalo: ambos suman puntos y arrancas con contactos conocidos dentro.',
    },
  ];

  return (
    <section className={styles.faqSection}>
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.headCenter}>
          <p className={styles.eyebrow}>
            <MessageSquare className="h-[13px] w-[13px]" strokeWidth={2} />
            ANTES DE QUE PREGUNTES
          </p>
          <h2 className={styles.h2}>
            <span className={styles.h2Grad}>Las dudas que todo agente tiene</span>
          </h2>
        </div>
        <div className={styles.faqList}>
          {faqs.map((faq) => (
            <div key={faq.q} className={styles.faqCard}>
              <h3 className={styles.faqQ}>{faq.q}</h3>
              <p className={styles.faqA}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
