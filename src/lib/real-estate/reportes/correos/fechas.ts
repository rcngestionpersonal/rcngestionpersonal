// Fechas de los correos, siempre en hora de Ecuador. Sin dependencias de
// servidor para que los correos se puedan armar y probar sueltos.

const ZONA = 'America/Guayaquil';

export type EntregaCorreo = { modo: 'adjunto' } | { modo: 'enlace'; url: string; venceAt: Date };

export function fechaLarga(d: Date): string {
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });
}

export function diaYMes(d: Date): string {
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', timeZone: ZONA });
}

export function hora(d: Date): string {
  return d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });
}

export function esMismoDia(a: Date, b: Date): boolean {
  const f = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ZONA });
  return f(a) === f(b);
}

// "del 7 al 14 de septiembre", o con los dos meses si cambian.
export function rangoDias(desde: Date, hasta: Date): string {
  const mes = (d: Date) => d.toLocaleDateString('es-EC', { month: 'long', timeZone: ZONA });
  const dia = (d: Date) => d.toLocaleDateString('es-EC', { day: 'numeric', timeZone: ZONA });
  return mes(desde) === mes(hasta) ? `${dia(desde)} al ${dia(hasta)} de ${mes(hasta)}` : `${diaYMes(desde)} al ${diaYMes(hasta)}`;
}

export function textoVencimiento(venceAt: Date): string {
  return `El enlace estará disponible hasta el ${fechaLarga(venceAt)}.`;
}
