// Compresion en cliente para fotos de portada de inmuebles: redimensiona al maximo
// indicado (manteniendo proporcion) y re-codifica a JPEG antes de subir, para que
// ninguna foto pese mas de unos ~300KB. Solo se ejecuta en el navegador (usa
// Image/canvas), nunca en SSR.
export function compressImage(file: File, maxDim = 800, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas no soportado.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('No se pudo comprimir la imagen.'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = objectUrl;
  });
}

// Compresion para la galeria de fotos del inmueble (Fase 4): redimensiona al
// lado mayor a maxDim (1600px por defecto - mas resolucion que la portada
// simple, porque estas fotos tambien alimentan la grilla de la ficha PDF) y
// re-codifica a JPEG. Los agentes suben fotos de 5-8MB directo de la camara;
// el objetivo es que ninguna quede pesando mas de ~400KB. Un solo pase de
// canvas no lo garantiza siempre (una foto muy detallada puede seguir
// pesando de mas incluso comprimida), asi que si el primer intento se pasa
// del objetivo se reintenta una vez a menor calidad antes de resignarse -
// nunca un bucle de recompresion binario, solo un paso extra que cubre el
// caso comun sin complicar la funcion.
const GALLERY_TARGET_BYTES = 400 * 1024;

async function encodeToBlob(img: HTMLImageElement, maxDim: number, quality: number): Promise<Blob> {
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height / width) * maxDim);
      width = maxDim;
    } else {
      width = Math.round((width / height) * maxDim);
      height = maxDim;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no soportado.');
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo comprimir la imagen.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

export function compressGalleryPhoto(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const first = await encodeToBlob(img, maxDim, quality);
        if (first.size <= GALLERY_TARGET_BYTES) {
          resolve(first);
          return;
        }
        const second = await encodeToBlob(img, maxDim, 0.6);
        resolve(second.size < first.size ? second : first);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('No se pudo comprimir la imagen.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = objectUrl;
  });
}

// Recorte cuadrado centrado (cover-fit) para la foto de perfil del Editar
// Perfil (Fase 7, seccion 3.1): toma el lado mas corto de la imagen original
// y recorta el excedente del lado largo desde el centro, sin pedirle al
// agente que reposicione manualmente - la vista previa que consume este blob
// ya muestra el resultado final antes de guardar.
export function cropImageToSquare(file: File, size = 500, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas no soportado.'));
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('No se pudo recortar la imagen.'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = objectUrl;
  });
}
