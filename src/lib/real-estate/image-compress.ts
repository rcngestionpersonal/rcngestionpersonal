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
