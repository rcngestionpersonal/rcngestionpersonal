// fflate 0.7 publica sus tipos en "types" pero no los declara en "exports", y
// con moduleResolution "bundler" TypeScript no los encuentra. Se declara solo lo
// que usa el proyecto (exportación de contratos a Word y sus pruebas).
declare module 'fflate' {
  export function strToU8(str: string, latin1?: boolean): Uint8Array;
  export function strFromU8(dat: Uint8Array, latin1?: boolean): string;
  export function zipSync(data: Record<string, Uint8Array>, opts?: { level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }): Uint8Array;
  export function unzipSync(data: Uint8Array): Record<string, Uint8Array>;
}
