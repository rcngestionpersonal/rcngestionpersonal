// Nombres de archivo de los reportes (punto 2 del pedido de adjuntos).
//
// Descriptivos, para que el propietario los encuentre despues en su correo o
// en Descargas: tipo, sector y fecha. Sin identificadores internos, sin
// espacios, sin tildes ni caracteres especiales, porque mas de un cliente de
// correo o sistema de archivos los destroza.

const ZONA = 'America/Guayaquil';

function segmento(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ñ/gi, 'n')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'Inmueble'
  );
}

// AAAA-MM-DD en hora de Ecuador: una visita a las 21:00 no puede salir con la
// fecha del dia siguiente.
export function fechaArchivo(fecha: Date): string {
  return fecha.toLocaleDateString('en-CA', { timeZone: ZONA });
}

export function nombreArchivoVisita(sector: string, fecha: Date, extension = 'pdf'): string {
  return `Visita-${segmento(sector)}-${fechaArchivo(fecha)}.${extension}`;
}

export function nombreArchivoGestion(sector: string, desde: Date, hasta: Date, extension = 'pdf'): string {
  return `Gestion-${segmento(sector)}-${fechaArchivo(desde)}-al-${fechaArchivo(hasta)}.${extension}`;
}

export function nombreArchivoTasacion(sector: string, fecha: Date, extension = 'pdf'): string {
  return `Tasacion-${segmento(sector)}-${fechaArchivo(fecha)}.${extension}`;
}
