import type { Metadata } from 'next';
import LeadChatWidget from '@/components/chat/LeadChatWidget';

export const metadata: Metadata = {
  title: 'Cuéntanos qué propiedad buscas | BrokerHub AI',
  description: 'Cuéntale a nuestro asistente qué propiedad buscas y te conectamos con el agente inmobiliario indicado para ti.',
};

export default function ContactoPage() {
  return (
    <main className="violet-ambient-bg min-h-screen px-4 py-8 text-white sm:py-10">
      <div className="mx-auto max-w-3xl">
        <section className="grain-overlay relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-violet-600/25 blur-2xl" />
          <div className="absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-cyan-500/20 blur-2xl" />
          <div className="relative z-10 space-y-3">
            <p className="inline-flex rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              BrokerHub AI
            </p>
            <h1 className="gradient-text text-3xl font-bold leading-tight sm:text-4xl">Cuéntanos qué propiedad buscas</h1>
            <p className="max-w-2xl text-sm text-white/70">
              Responde unas preguntas rápidas y te conectamos con un agente inmobiliario especializado en tu zona.
            </p>
          </div>
        </section>

        <LeadChatWidget />
      </div>
    </main>
  );
}
