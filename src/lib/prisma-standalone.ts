import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Cliente Prisma para lo que corre FUERA de Next.js: los tests de integracion
// y los scripts de scripts/. Usa el mismo adaptador de Neon que
// src/lib/prisma.ts - o sea HTTPS/WebSocket por el 443 - en vez del socket TCP
// al 5432 que abre un `new PrismaClient()` pelado.
//
// Por que importa: este entorno (y varios ISP/firewalls) bloquean el 5432
// saliente aunque el 443 este abierto, asi que un cliente plano falla con
// P1001 "Can't reach database server" aunque la base este perfectamente
// arriba. Si algun dia un test vuelve a fallar con P1001, es casi seguro que
// se instancio un PrismaClient a mano en vez de usar esto.
//
// A diferencia de src/lib/prisma.ts: no cachea en global (cada archivo crea el
// suyo y lo cierra) y no loguea queries (inundaria la salida de los tests).
export function createPrismaClient(): PrismaClient {
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaNeon(pool) });
}
