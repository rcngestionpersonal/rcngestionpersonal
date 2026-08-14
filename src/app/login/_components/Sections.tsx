import Image from 'next/image';
import {
  BarChart3,
  Check,
  Clock,
  EyeOff,
  Handshake,
  IdCard,
  Lock,
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
            <span className={styles.h2Grad}>Tres pasos y la red de tus colegas empieza a trabajar para ti</span>
          </h2>
          <p className={styles.sectionLead}>
            Redinmo.io no es otro portal de anuncios. Es un motor que cruza lo que tienes con lo que tus colegas buscan — y al
            revés.
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
              <div className={styles.bullet}>
                <span className={styles.bulletIcon}>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <p className={styles.bulletText}>
                  <b>Tus clientes siguen siendo tuyos.</b> Los datos de contacto nunca se muestran a nadie. Compartes el
                  negocio, no tu cliente.
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
                <IdCard className="h-[15px] w-[15px]" style={{ color: 'var(--brand)' }} strokeWidth={1.8} />
                <span className={styles.profileStatLabel}>Inmuebles en su inventario</span>
                <span className={styles.profileStatValue}>24</span>
              </div>
              <div className={styles.profileStatRow}>
                <Sparkles className="h-[15px] w-[15px]" style={{ color: 'var(--brand)' }} strokeWidth={1.8} />
                <span className={styles.profileStatLabel}>Matches concretados</span>
                <span className={styles.profileStatValue}>11</span>
              </div>
              <div className={styles.profileStatRow}>
                <Handshake className="h-[15px] w-[15px]" style={{ color: 'var(--brand)' }} strokeWidth={1.8} />
                <span className={styles.profileStatLabel}>Cierres registrados</span>
                <span className={styles.profileStatValue}>18</span>
              </div>
              <div className={styles.profileStatRow}>
                <BarChart3 className="h-[15px] w-[15px]" style={{ color: 'var(--brand)' }} strokeWidth={1.8} />
                <span className={styles.profileStatLabel}>Constancia (12 meses)</span>
                <span className={styles.profileStatValue}>Alta</span>
              </div>
            </div>
            <div className={styles.levelBarWrap}>
              <div className={styles.levelBarLabels}>
                <span>Agente Elite</span>
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
              El dato que nadie publica: a cuánto se cierra de verdad en cada sector, en dólares por metro cuadrado. Lo
              construyen tus colegas de forma anónima y te sirve para tasar con evidencia y ganar la captación frente al
              propietario que pide un precio imposible.
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
              <h3 className={styles.cardH3}>Tus clientes, protegidos</h3>
              <p className={styles.cardP}>
                Ningún colega ve los datos de contacto de tu cliente. Compartes la oportunidad, nunca tu base.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PrecioSection() {
  const valueRows = [
    { text: 'Matches ilimitados con el inventario de tus colegas', strike: '$49/mes' },
    { text: 'Mapa de Precios de Cierre para tasar con datos reales', strike: '$39/mes' },
    { text: 'Carnet de Agente verificable y compartible', strike: '$19/mes' },
    { text: 'Gestión de inmuebles, pedidos y seguimientos', strike: '$29/mes' },
    { text: 'Perfil, niveles y reputación frente a tus colegas', strike: '—' },
  ];

  return (
    <section id="precio" className={styles.pricingSection}>
      <div className={styles.dots} aria-hidden="true" />
      <div className={styles.gv} style={{ width: 420, height: 420, top: 40, right: -140 }} aria-hidden="true" />
      <div className={`${styles.wrap} ${styles.sectionInner}`}>
        <div className={styles.headCenter}>
          <p className={styles.eyebrow}>
            <Zap className="h-[13px] w-[13px]" strokeWidth={2} />
            TU INVERSIÓN
          </p>
          <h2 className={styles.h2}>
            <span className={styles.h2Grad}>Un solo negocio compartido paga tu suscripción por años</span>
          </h2>
          <p className={styles.sectionLead}>Sin contratos, sin porcentajes sobre tus comisiones, sin sorpresas.</p>
        </div>

        <div className={styles.offerCard}>
          <span className={styles.offerPill}>
            <Sparkle className="h-3 w-3" strokeWidth={2} />
            PRECIO FUNDADOR · CONGELADO DE POR VIDA
          </span>
          <div className={styles.offerPrice}>
            <span className={styles.offerPriceValue}>$8,99</span>
            <span className={styles.offerPriceUnit}>+ IVA al mes</span>
          </div>
          <p className={styles.offerPriceNote}>
            Cada semestre el precio sube para los nuevos agentes. El tuyo queda fijo para siempre.
          </p>

          <div className={styles.valueStack}>
            {valueRows.map((row) => (
              <div key={row.text} className={styles.valueRow}>
                <span className={styles.valueCheck}>
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <span className={styles.valueText}>{row.text}</span>
                <span className={styles.valueStrike}>{row.strike}</span>
              </div>
            ))}
          </div>

          <div className={styles.guaranteeBox}>
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <p className={styles.guaranteeText}>
              <b>Pruébalo sin riesgo:</b> 30 días gratis para cargar tu inventario y recibir tus primeros matches. Si no te
              sirve, cancelas desde tu panel en un clic — sin llamadas ni penalidades. Y Redinmo.io nunca toca un centavo de tus
              comisiones.
            </p>
          </div>

          <div className={styles.offerCtaWrap}>
            <a href="/agentes/registro" className={styles.offerCta}>
              Empezar mis 30 días gratis
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
            <p className={styles.offerMicro}>Pago con tarjeta de crédito o débito · Factura electrónica automática</p>
          </div>
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
