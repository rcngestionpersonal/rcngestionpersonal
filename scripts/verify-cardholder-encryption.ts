// Verifica encryptCardHolder() (fase de cierre, punto 1.4) usando la
// PAYPHONE_CODING_PASSWORD REAL configurada en este entorno - a diferencia de
// payphone.test.ts (que prueba el algoritmo contra claves de prueba fijas,
// corre siempre y ya esta en la bateria automatica), este script existe para
// la unica pregunta que un test con clave de prueba no puede contestar: "la
// clave de produccion, tal cual quedo guardada, ¿cifra bien?" - un espacio o
// salto de linea invisible al copiarla del panel de Payphone rompe el cifrado
// en silencio, y Payphone no señala esa causa en su respuesta de error a un
// cobro tokenizado fallido.
//
// Cruza el resultado contra `openssl enc -aes-256-cbc` (linea de comandos, un
// binario distinto al modulo crypto de Node - la misma tecnica del test,
// pero aca con la clave real). La clave real solo se pasa como argumento al
// proceso hijo de openssl; nunca se imprime, ni ella ni el resultado
// intermedio (la clave de 32 bytes derivada), solo el ciphertext final.
//
// Correr con: npx tsx scripts/verify-cardholder-encryption.ts ["Nombre a probar"]
import { execFileSync } from 'node:child_process';
import { encryptCardHolder } from '../src/lib/real-estate/payments/payphone';

function opensslReference(plaintext: string, codingPassword: string): string | null {
  try {
    const key = Buffer.alloc(32);
    Buffer.from(codingPassword, 'utf8').copy(key);
    const ivHex = '0'.repeat(32);
    const out = execFileSync(
      'openssl',
      ['enc', '-aes-256-cbc', '-K', key.toString('hex'), '-iv', ivHex, '-nosalt', '-base64', '-A'],
      { input: plaintext },
    );
    return out.toString('utf8').trim();
  } catch {
    return null; // openssl no esta disponible en este equipo - no es un error del cifrado en si
  }
}

function main() {
  const codingPassword = process.env.PAYPHONE_CODING_PASSWORD;
  if (!codingPassword) {
    console.error('Falta PAYPHONE_CODING_PASSWORD en el entorno. No hay nada que verificar.');
    process.exitCode = 1;
    return;
  }

  // "User Name" es el ejemplo literal de https://docs.payphone.app/tokenizacion
  // (asi aparece en sus ejemplos de PHP y CryptoJS) - se puede pasar otro
  // nombre por argumento si se prefiere probar con uno real.
  const name = process.argv[2] ?? 'User Name';

  const ours = encryptCardHolder(name, codingPassword);
  const reference = opensslReference(name, codingPassword);

  console.log(`\nNombre usado: ${JSON.stringify(name)}`);
  console.log(`Coding password: (oculta a proposito, ${codingPassword.length} caracteres)`);
  console.log(`\nResultado de encryptCardHolder():      ${ours}`);

  if (reference === null) {
    console.log('Referencia openssl CLI: no disponible en este equipo (omitido).');
    console.log('\nSin la referencia local no se puede confirmar automaticamente. Compara el resultado de arriba');
    console.log('contra el ejemplo oficial de la documentacion corriendo esto en un entorno con PHP:\n');
  } else {
    console.log(`Referencia (openssl CLI, independiente):  ${reference}`);
    if (ours === reference) {
      console.log('\nOK - coinciden byte a byte. La clave real, tal cual esta configurada, cifra correctamente.\n');
    } else {
      console.error('\nNO COINCIDEN. No sigas: un cardHolder mal cifrado hace fallar todos los cobros tokenizados.');
      console.error('Revisa primero espacios/saltos de linea invisibles en PAYPHONE_CODING_PASSWORD (la causa mas');
      console.error('comun es copiarla del panel de Payphone con un salto de linea al final) y que la clave se');
      console.error('rellene a 32 bytes exactos con el IV en cero (ver encryptCardHolder en payphone.ts).\n');
      process.exitCode = 1;
    }
  }

  console.log('Para una segunda verificacion manual contra el ejemplo oficial (PHP), con la clave leida del');
  console.log('mismo entorno (nunca pegada en la terminal):\n');
  console.log(
    `  php -r '$n=${JSON.stringify(name)};$p=getenv("PAYPHONE_CODING_PASSWORD");echo base64_encode(openssl_encrypt($n,"AES-256-CBC",$p,OPENSSL_RAW_DATA,""));echo PHP_EOL;'\n`,
  );
}

main();
