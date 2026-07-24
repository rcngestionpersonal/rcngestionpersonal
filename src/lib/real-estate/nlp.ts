import { OperationType, PropertyType } from '@prisma/client';

export type ParsedOpportunity = {
  operationType: OperationType;
  propertyType: PropertyType;
  city: string;
  zone?: string;
  address?: string;
  budgetMin?: number;
  budgetMax?: number;
  areaM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  summary: string;
  extractedData: Record<string, unknown>;
};

const CITY_HINTS = [
  'quito',
  'guayaquil',
  'cuenca',
  'samborondon',
  'daule',
  'cumbaya',
  'tumbaco',
  'manta',
  'ambato',
  'latacunga',
  'loja',
];

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function detectOperationType(text: string): OperationType {
  if (/\b(renta|alquiler|arriendo|arrendar)\b/i.test(text)) return OperationType.RENT;
  if (/\b(venta|vendo|comprar|compra)\b/i.test(text)) return OperationType.SALE;
  return OperationType.BOTH;
}

function detectPropertyType(text: string): PropertyType {
  if (/\b(casa|casas)\b/i.test(text)) return PropertyType.HOUSE;
  if (/\b(departamento|departamentos|apartamento|apartamentos|depto)\b/i.test(text)) return PropertyType.APARTMENT;
  if (/\b(suite|suites)\b/i.test(text)) return PropertyType.SUITE;
  if (/\b(oficina|oficinas|consultorio)\b/i.test(text)) return PropertyType.OFFICE;
  if (/\b(terreno|lote|solar)\b/i.test(text)) return PropertyType.LAND;
  if (/\b(local|comercial|bodega|galpon)\b/i.test(text)) return PropertyType.COMMERCIAL;
  return PropertyType.OTHER;
}

function extractCity(text: string): string {
  const normalized = normalizeText(text);
  const match = CITY_HINTS.find((city) => normalized.includes(city));
  return match ? match.charAt(0).toUpperCase() + match.slice(1) : 'No especificada';
}

function extractZone(text: string): string | undefined {
  const zoneMatch = text.match(/\b(zona|sector|urbanizacion|barrio)\s*[:\-]?\s*([a-zA-Z0-9\s]+)/i);
  return zoneMatch?.[2]?.trim();
}

function extractNumber(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match?.[1]) return undefined;
  const numericValue = match[1].replace(/\./g, '').replace(',', '.');
  const parsed = Number(numericValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractBudget(text: string): { budgetMin?: number; budgetMax?: number } {
  const rangeMatch = text.match(/(?:\$|usd)?\s*([\d.,]+)\s*(?:-|a|hasta)\s*(?:\$|usd)?\s*([\d.,]+)/i);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const min = Number(rangeMatch[1].replace(/\./g, '').replace(',', '.'));
    const max = Number(rangeMatch[2].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(min) && Number.isFinite(max)) return { budgetMin: min, budgetMax: max };
  }

  const singleMatch = text.match(/(?:\$|usd)\s*([\d.,]+)/i);
  if (singleMatch?.[1]) {
    const amount = Number(singleMatch[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(amount)) return { budgetMin: amount * 0.9, budgetMax: amount * 1.1 };
  }

  return {};
}

export function parseOpportunityFromMessage(messageText: string): ParsedOpportunity {
  const budget = extractBudget(messageText);
  const areaM2 = extractNumber(messageText, /([\d.,]+)\s*m2/i);
  const bedrooms = extractNumber(messageText, /(\d+)\s*(?:hab|habitaciones|dormitorios)/i);
  const bathrooms = extractNumber(messageText, /(\d+)\s*(?:banos|ba\u00f1os)/i);
  const parkingSpaces = extractNumber(messageText, /(\d+)\s*(?:parqueaderos|garajes|estacionamientos)/i);

  return {
    operationType: detectOperationType(messageText),
    propertyType: detectPropertyType(messageText),
    city: extractCity(messageText),
    zone: extractZone(messageText),
    address: undefined,
    budgetMin: budget.budgetMin,
    budgetMax: budget.budgetMax,
    areaM2,
    bedrooms,
    bathrooms,
    parkingSpaces,
    summary: messageText.slice(0, 240),
    extractedData: {
      source: 'rules',
      originalText: messageText,
    },
  };
}

export async function enrichOpportunityWithOpenAI(messageText: string): Promise<Partial<ParsedOpportunity>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return {};

  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const prompt = [
    'Analiza el siguiente mensaje inmobiliario y responde SOLO JSON valido.',
    'Campos: operationType(SALE|RENT|BOTH), propertyType(HOUSE|APARTMENT|SUITE|OFFICE|LAND|COMMERCIAL|OTHER), city, zone, budgetMin, budgetMax, areaM2, bedrooms, bathrooms, parkingSpaces, summary.',
    `Mensaje: ${messageText}`,
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) return {};
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return {};

  try {
    const parsed = JSON.parse(content) as Partial<ParsedOpportunity>;
    return parsed;
  } catch {
    return {};
  }
}
