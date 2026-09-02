// Todos los tests del motor de recurrencias son de integracion contra la
// base real (no hay base de test separada) - fuerzan USE_REAL_ESTATE_MOCK a
// 'false' sin importar lo que traiga el entorno, porque Vite/Vitest carga
// .env automaticamente (donde este proyecto lo tiene en 'true' para
// desarrollo local) y varias rutas ramifican en un mock-store que ignora
// por completo el fetch simulado de estos tests si mock queda activo.
process.env.USE_REAL_ESTATE_MOCK = 'false';
