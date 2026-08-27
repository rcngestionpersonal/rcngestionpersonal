// Normalizacion de telefono - un solo lugar para nunca repetir esta logica en
// registro, editar perfil, y la migracion de registros existentes. El bug de
// origen: cada formulario armaba el telefono como `${countryCode}${loQueElUsuarioEscriba}`
// sin limpiar nada - si el agente pegaba su numero ya con el +593 (copiado de
// WhatsApp) o con el 0 de marcado local, el telefono guardado quedaba roto
// (ej. "+593+593962718557"), lo que Payphone rechaza al cobrar.

// Arma el E.164 completo a partir del selector de pais + lo que el agente
// escribio en el campo de numero local. Aqui SI es correcto asumir el codigo
// de pais: el usuario lo eligio explicitamente en el dropdown, asi que si el
// campo local no lo trae ya (caso normal) se agrega.
export function buildPhoneE164(countryCode: string, localRaw: string): string {
  const codeDigits = countryCode.replace(/\D/g, '');
  // Se quita TODO caracter no numerico (incluido cualquier '+', este al
  // inicio o pegado en medio de lo que el agente escribio/pego) antes de
  // buscar el codigo duplicado - de lo contrario "+593" en medio del texto
  // rompe la deteccion.
  let local = localRaw.replace(/\D/g, '');
  // El agente pego el numero completo (con codigo) en el campo local en vez
  // de solo el numero - quita el codigo de pais duplicado si aparece al inicio.
  if (local.startsWith(codeDigits)) local = local.slice(codeDigits.length);
  // Cero de marcado local (Ecuador: 09XXXXXXXX se marca afuera como +593 9XXXXXXXX).
  local = local.replace(/^0+/, '');
  return `+${codeDigits}${local}`;
}

// Repara un E.164 ya guardado (posiblemente roto) - usado por la migracion de
// registros existentes y como respaldo server-side. A proposito NUNCA fuerza
// un codigo de pais sobre un numero que no lo tiene ya: podria ser de otro
// pais o un dato que no nos corresponde adivinar. Solo colapsa: (1) una
// repeticion exacta del codigo al inicio ("+593+593..." o "593593..."), y
// (2) un 0 de marcado local pegado justo despues de un codigo YA confirmado.
// Idempotente: aplicarlo a un numero ya correcto no lo cambia.
export function repairPhone(phone: string, countryCode = '+593'): string {
  const codeDigits = countryCode.replace(/\D/g, '');
  // Igual que en buildPhoneE164: se quita TODO caracter no numerico, no solo
  // el '+' inicial, porque el bug de origen puede dejar un '+' pegado en
  // medio del numero (ej. "+593+593962718557").
  let digits = phone.replace(/\D/g, '');

  while (digits.startsWith(codeDigits + codeDigits)) {
    digits = digits.slice(codeDigits.length);
  }
  if (digits.startsWith(codeDigits)) {
    const rest = digits.slice(codeDigits.length).replace(/^0+/, '');
    digits = `${codeDigits}${rest}`;
  }
  return `+${digits}`;
}

export function isValidPhone(phone: string): boolean {
  return /^\+\d{8,15}$/.test(phone);
}
