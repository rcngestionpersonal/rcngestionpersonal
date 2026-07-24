// Flags de features en desarrollo activo. SHARE_CARNET_ENABLED: activado por defecto
// (incluye desarrollo); en produccion se puede apagar sin tocar codigo con
// NEXT_PUBLIC_SHARE_CARNET_ENABLED=false en las variables de entorno de Vercel.
export const SHARE_CARNET_ENABLED = process.env.NEXT_PUBLIC_SHARE_CARNET_ENABLED !== 'false';
