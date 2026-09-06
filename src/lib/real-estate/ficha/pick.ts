// Selectores de campos para la ficha. Vivian dentro de la ruta
// api/real-estate/listings/[id]/ficha/route.ts, pero la ficha publica del
// mini-sitio (Fase 3) necesita exactamente los mismos, y un route.ts de App
// Router no puede exportar funciones sueltas (Next valida que solo exporte
// handlers HTTP). Se movieron aca tal cual: mismo comportamiento, dos
// consumidores, una sola definicion que mantener.

// Subconjunto de campos de Listing que la ficha puede leer - a proposito
// nunca incluye ownerName/ownerPhone/address (privacidad). id/createdAt/
// commissionSharePercent son seguros (no identifican al propietario) y
// alimentan la referencia, "tiempo publicado" y el bloque de condiciones
// para colegas. Compartido por la rama mock y la rama Prisma.
export function pickListingFields(l: Record<string, unknown>) {
  return {
    id: l.id as string,
    title: l.title as string,
    operationType: l.operationType as 'SALE' | 'RENT' | 'BOTH',
    propertyType: l.propertyType as string,
    city: l.city as string,
    zone: (l.zone as string | null) ?? null,
    price: l.price as number,
    currency: l.currency as string,
    description: (l.description as string | null) ?? null,
    coverPhotoUrl: (l.coverPhotoUrl as string | null) ?? null,
    createdAt: new Date(l.createdAt as string | Date),
    commissionSharePercent: (l.commissionSharePercent as number) ?? 0,
    managingAgentId: l.managingAgentId as string,
    areaM2: (l.areaM2 as number | null) ?? null,
    bedrooms: (l.bedrooms as number | null) ?? null,
    bathrooms: (l.bathrooms as number | null) ?? null,
    mediosBanos: (l.mediosBanos as number | null) ?? null,
    parkingSpaces: (l.parkingSpaces as number | null) ?? null,
    espaciosAdicionales: (l.espaciosAdicionales as number | null) ?? null,
    antiguedad: (l.antiguedad as string | null) ?? null,
    esIndependiente: (l.esIndependiente as boolean | null) ?? null,
    amoblado: (l.amoblado as string | null) ?? null,
    alicuotaMensual: (l.alicuotaMensual as number | null) ?? null,
    piso: (l.piso as number | null) ?? null,
    tieneAscensor: (l.tieneAscensor as boolean | null) ?? null,
    areasComunales: (l.areasComunales as boolean | null) ?? null,
    esquineroOMedianero: (l.esquineroOMedianero as string | null) ?? null,
    usoSueloTerreno: (l.usoSueloTerreno as string | null) ?? null,
    pisosPermitidos: (l.pisosPermitidos as number | null) ?? null,
    serviciosBasicos: (l.serviciosBasicos as string | null) ?? null,
    frenteM: (l.frenteM as number | null) ?? null,
    nivelLocal: (l.nivelLocal as string | null) ?? null,
    distribucionLocal: (l.distribucionLocal as string | null) ?? null,
    estadoOcupacion: (l.estadoOcupacion as string | null) ?? null,
    canonMensualActual: (l.canonMensualActual as number | null) ?? null,
    alturaLibreM: (l.alturaLibreM as number | null) ?? null,
    accesoCamion: (l.accesoCamion as boolean | null) ?? null,
    terrenoTotalM2: (l.terrenoTotalM2 as number | null) ?? null,
    areaLibrePropiaM2: (l.areaLibrePropiaM2 as number | null) ?? null,
    terrenoLibreExclusivoM2: (l.terrenoLibreExclusivoM2 as number | null) ?? null,
    balconOTerraza: (l.balconOTerraza as boolean | null) ?? null,
  };
}

export function pickAgentFields(a: Record<string, unknown>) {
  return {
    fullName: a.fullName as string,
    phone: a.phone as string,
    email: (a.email as string | null) ?? null,
    company: (a.company as string | null) ?? null,
    photoUrl: (a.photoUrl as string | null) ?? null,
    licenseNumber: (a.licenseNumber as string | null) ?? null,
    idNumber: (a.idNumber as string | null) ?? null,
    phoneVerifiedAt: (a.phoneVerifiedAt as string | Date | null) ?? null,
  };
}
