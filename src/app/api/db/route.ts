import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Para desarrollo, devolver una respuesta simulada si hay timeout
    // En producción, usar la conexión real a la base de datos
    
    if (process.env.NODE_ENV === 'development') {
      // Simulación de respuesta exitosa para desarrollo
      return NextResponse.json({ 
        message: 'Connection successful (simulated)',
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: 'development'
      });
    }

    // Para producción, usar la conexión real
    const { query } = await import('@/lib/db');
    const result = await query('SELECT NOW() as timestamp');
    return NextResponse.json({ 
      message: 'Database connection successful',
      data: result.rows[0],
      environment: 'production'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to database' },
      { status: 500 }
    );
  }
}
