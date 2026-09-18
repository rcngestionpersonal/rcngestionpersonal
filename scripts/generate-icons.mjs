// Iconos de la PWA y favicons de Redinmo, a partir de los SVG de marca.
//
//   npm run icons
//
// Fuentes (public/brand/):
//   redinmo-icon-master.svg    esquinas redondeadas, fondo transparente fuera
//                              del cuadrado: iconos "any" y favicons.
//   redinmo-icon-maskable.svg  sangrado completo y la letra dentro de la zona
//                              segura: iconos "maskable" y apple-touch-icon.
//
// Salida: public/icons/, más una copia de favicon.ico en public/. Se versionan
// en el repo; este script solo se vuelve a correr cuando cambian los SVG.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = path.join(raiz, 'public', 'brand');
const SALIDA = path.join(raiz, 'public', 'icons');

// El SVG mide 1024 px a 72 dpi. Con 384 dpi se rasteriza a ~5460 px y recién
// ahí se reduce: los bordes de la curva y los círculos salen limpios incluso a
// 16 px, en vez de heredar el escalonado de un render chico.
const DENSIDAD = 384;

// Fondo del apple-touch-icon: iOS no admite transparencia (la pinta de negro).
// Es el primer color del degradado, que ya cubre la esquina superior.
const FONDO_OPACO = '#7C3AED';

async function png(svg, lado, { opaco = false } = {}) {
  let imagen = sharp(svg, { density: DENSIDAD }).resize(lado, lado, { fit: 'contain', kernel: 'lanczos3' });
  if (opaco) imagen = imagen.flatten({ background: FONDO_OPACO });
  return imagen.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function main() {
  const master = await readFile(path.join(BRAND, 'redinmo-icon-master.svg'));
  const maskable = await readFile(path.join(BRAND, 'redinmo-icon-maskable.svg'));
  await mkdir(SALIDA, { recursive: true });

  const salidas = [
    ['icon-192.png', () => png(master, 192)],
    ['icon-512.png', () => png(master, 512)],
    ['icon-maskable-192.png', () => png(maskable, 192)],
    ['icon-maskable-512.png', () => png(maskable, 512)],
    ['apple-touch-icon.png', () => png(maskable, 180, { opaco: true })],
    ['favicon-16.png', () => png(master, 16)],
    ['favicon-32.png', () => png(master, 32)],
  ];

  for (const [nombre, generar] of salidas) {
    const buffer = await generar();
    await writeFile(path.join(SALIDA, nombre), buffer);
    const { width, height, hasAlpha } = await sharp(buffer).metadata();
    console.log(`  ${nombre.padEnd(24)} ${width}×${height}  ${hasAlpha ? 'con alfa' : 'opaco'}  ${buffer.length} B`);
  }

  // favicon.ico con tres tamaños, cada uno rasterizado desde el SVG (no
  // reducido desde otro PNG).
  const capas = await Promise.all([16, 32, 48].map((lado) => png(master, lado)));
  const ico = await pngToIco(capas);
  await writeFile(path.join(SALIDA, 'favicon.ico'), ico);
  console.log(`  ${'favicon.ico'.padEnd(24)} 16, 32, 48  ${ico.length} B`);

  // Copia en la raíz: navegadores, lectores y buscadores piden /favicon.ico
  // directo, sin mirar el <link> de la página. Es el mismo archivo.
  await writeFile(path.join(raiz, 'public', 'favicon.ico'), ico);
  console.log(`  ${'../favicon.ico'.padEnd(24)} copia en /public`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
