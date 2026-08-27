// Las 24 provincias de Ecuador, para el selector de direccion profesional
// (Fase 7, seccion 8.1). Estructurado como una lista simple de nombres en vez
// de un enum de Prisma a proposito: el campo se guarda como texto libre
// (provincia String?) para poder aceptar provincias/estados de otros paises
// el dia que Redinmo opere fuera de Ecuador, sin una migracion de enum.
export const ECUADOR_PROVINCES: string[] = [
  'Azuay',
  'Bolívar',
  'Cañar',
  'Carchi',
  'Chimborazo',
  'Cotopaxi',
  'El Oro',
  'Esmeraldas',
  'Galápagos',
  'Guayas',
  'Imbabura',
  'Loja',
  'Los Ríos',
  'Manabí',
  'Morona Santiago',
  'Napo',
  'Orellana',
  'Pastaza',
  'Pichincha',
  'Santa Elena',
  'Santo Domingo de los Tsáchilas',
  'Sucumbíos',
  'Tungurahua',
  'Zamora Chinchipe',
];
