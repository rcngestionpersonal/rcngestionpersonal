import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Bateria de pruebas del motor de recurrencias (pedido de recurrencias,
// seccion 9). Los tests bajo src/lib/real-estate/**/*.test.ts que tocan
// Prisma corren contra la base real de Neon (este proyecto no tiene una base
// separada de test) - todos crean su propio Agent con isTestUser:true y lo
// borran en un finally, asi que son seguros de correr en cualquier momento,
// pero SI hacen escrituras reales. Ver la nota al inicio de cada archivo que
// toca la base.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    // Los tests de integracion (subscription-engine, gateway) hacen varias
    // idas y vueltas a Neon en serie - a proposito NO en paralelo entre
    // archivos, para no generar carreras raras entre pruebas que crean y
    // borran filas parecidas al mismo tiempo.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
