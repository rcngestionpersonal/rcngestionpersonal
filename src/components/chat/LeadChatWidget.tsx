'use client';

import { useState, type ReactNode } from 'react';

type OperationType = 'SALE' | 'RENT' | 'BOTH';
type PropertyType = 'HOUSE' | 'APARTMENT' | 'SUITE' | 'OFFICE' | 'LAND' | 'COMMERCIAL' | 'OTHER';
type Step = 'operation' | 'property' | 'location' | 'budget' | 'contact' | 'submitting' | 'done' | 'error';

type Answer = { question: string; answer: string };

const OPERATION_OPTIONS: Array<{ value: OperationType; label: string }> = [
  { value: 'SALE', label: 'Comprar' },
  { value: 'RENT', label: 'Alquilar' },
  { value: 'BOTH', label: 'Cualquiera' },
];

const PROPERTY_OPTIONS: Array<{ value: PropertyType; label: string }> = [
  { value: 'HOUSE', label: 'Casa' },
  { value: 'APARTMENT', label: 'Departamento' },
  { value: 'SUITE', label: 'Suite' },
  { value: 'OFFICE', label: 'Oficina' },
  { value: 'LAND', label: 'Terreno' },
  { value: 'COMMERCIAL', label: 'Local comercial' },
  { value: 'OTHER', label: 'Otro' },
];

const STEP_PROGRESS: Record<Step, number> = {
  operation: 1,
  property: 2,
  location: 3,
  budget: 4,
  contact: 5,
  submitting: 5,
  done: 5,
  error: 5,
};
const TOTAL_STEPS = 5;

export default function LeadChatWidget() {
  const [step, setStep] = useState<Step>('operation');
  const [answers, setAnswers] = useState<Answer[]>([]);

  const [operationType, setOperationType] = useState<OperationType | null>(null);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [city, setCity] = useState('');
  const [zone, setZone] = useState('');
  const [budget, setBudget] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [matched, setMatched] = useState(false);

  function pushAnswer(question: string, answer: string) {
    setAnswers((prev) => [...prev, { question, answer }]);
  }

  function chooseOperation(value: OperationType, label: string) {
    setOperationType(value);
    pushAnswer('¿Buscas comprar o alquilar?', label);
    setStep('property');
  }

  function chooseProperty(value: PropertyType, label: string) {
    setPropertyType(value);
    pushAnswer('¿Qué tipo de propiedad buscas?', label);
    setStep('location');
  }

  function submitLocation() {
    if (!city.trim()) return;
    pushAnswer('¿En qué ciudad y zona?', zone.trim() ? `${city.trim()} - ${zone.trim()}` : city.trim());
    setStep('budget');
  }

  function submitBudget(skip: boolean) {
    const amount = !skip && budget.trim() ? budget.trim() : null;
    pushAnswer('¿Cuál es tu presupuesto aproximado?', amount ? `$${amount}` : 'Prefiere no decirlo');
    setStep('contact');
  }

  async function submitContact() {
    if (!contactName.trim() || !contactPhone.trim() || !operationType || !propertyType) return;
    pushAnswer('¿Nombre y teléfono de contacto?', `${contactName.trim()} - ${contactPhone.trim()}`);
    setStep('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/api/real-estate/leads/web-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationType,
          propertyType,
          city: city.trim(),
          zone: zone.trim() || undefined,
          budget: budget.trim() ? Number(budget.trim()) : undefined,
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo enviar tu consulta.');
      }

      setMatched(Boolean(data.matched));
      setStep('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado, intenta de nuevo.');
      setStep('error');
    }
  }

  const progressStep = STEP_PROGRESS[step];

  return (
    <div className="glass-card mx-auto w-full max-w-lg rounded-3xl p-5 sm:p-6">
      {step !== 'done' && step !== 'error' && (
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-text-3">
            <span>Paso {progressStep} de {TOTAL_STEPS}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
              style={{ width: `${(progressStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {answers.map((item, index) => (
          <div key={index} className="space-y-2">
            <BotBubble text={item.question} />
            <UserBubble text={item.answer} />
          </div>
        ))}

        {step === 'operation' && (
          <div className="fade-up space-y-2">
            <BotBubble text="¡Hola! Qué gusto tenerte por aquí. Cuéntame, ¿qué estás buscando: comprar o alquilar?" />
            <OptionButtons options={OPERATION_OPTIONS} onSelect={chooseOperation} />
          </div>
        )}

        {step === 'property' && (
          <div className="fade-up space-y-2">
            <BotBubble text="Perfecto. ¿Y qué tipo de propiedad tienes en mente?" />
            <OptionButtons options={PROPERTY_OPTIONS} onSelect={chooseProperty} />
          </div>
        )}

        {step === 'location' && (
          <div className="fade-up space-y-2">
            <BotBubble text="Genial. ¿En qué ciudad y zona te gustaría?" />
            <div className="space-y-2">
              <input
                className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ciudad (obligatorio)"
              />
              <input
                className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Zona o barrio (opcional)"
              />
              <button
                onClick={submitLocation}
                disabled={!city.trim()}
                className="gradient-btn min-h-[44px] w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 'budget' && (
          <div className="fade-up space-y-2">
            <BotBubble text="¿Cuál es tu presupuesto aproximado?" />
            <div className="space-y-2">
              <input
                type="number"
                min={0}
                className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Monto aproximado en USD"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => submitBudget(false)}
                  className="gradient-btn min-h-[44px] flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-grad-contrast"
                >
                  Siguiente
                </button>
                <button
                  onClick={() => submitBudget(true)}
                  className="min-h-[44px] flex-1 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-text hover:bg-surface-2"
                >
                  Prefiero no decir
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'contact' && (
          <div className="fade-up space-y-2">
            <BotBubble text="¡Ya casi terminamos! Dime tu nombre y tu teléfono para que un agente te contacte." />
            <div className="space-y-2">
              <input
                className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Tu nombre"
              />
              <input
                className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Tu telefono de contacto"
              />
              <input
                className="min-h-[44px] w-full rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-text outline-none transition placeholder:text-text-3 focus:border-brand"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="Email (opcional)"
              />
              <button
                onClick={submitContact}
                disabled={!contactName.trim() || !contactPhone.trim()}
                className="gradient-btn min-h-[44px] w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-grad-contrast disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        )}

        {step === 'submitting' && (
          <div className="fade-up">
            <BotBubble>
              <span className="inline-flex items-center gap-1">
                Buscando el agente ideal para ti
                <TypingDots />
              </span>
            </BotBubble>
          </div>
        )}

        {step === 'done' && (
          <div className="fade-up">
            <BotBubble
              text={
                matched
                  ? 'Listo! Ya te conectamos con un agente especializado en tu zona, te va a escribir muy pronto.'
                  : 'Listo, gracias! Registramos tu consulta y un agente te va a contactar apenas haya disponibilidad.'
              }
            />
          </div>
        )}

        {step === 'error' && (
          <div className="fade-up space-y-2">
            <BotBubble text={errorMessage} />
            <button
              onClick={() => setStep('contact')}
              className="min-h-[44px] w-full rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-text hover:bg-surface-2"
            >
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-grad text-[13px]">
      🤖
    </div>
  );
}

function BotBubble({ text, children }: { text?: string; children?: ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <BotAvatar />
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2.5 text-sm text-text">
        {children ?? text}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-3 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-3 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-3" />
    </span>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-brand-dim px-4 py-2.5 text-right text-sm text-text">
      {text}
    </div>
  );
}

function OptionButtons<T extends string>({
  options,
  onSelect,
}: {
  options: Array<{ value: T; label: string }>;
  onSelect: (value: T, label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value, option.label)}
          className="min-h-[44px] rounded-full border border-line-strong bg-surface-2 px-4 py-2 text-sm font-semibold text-text transition hover:brightness-125"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
