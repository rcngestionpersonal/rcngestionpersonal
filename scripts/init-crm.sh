#!/bin/bash

echo "🚀 Inicializando CRM SaaS con saas-factory..."
echo ""

# Verificar que las variables de entorno están configuradas
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL no está configurado"
    exit 1
fi

echo "✅ DATABASE_URL configurado"
echo ""

# Instalar dependencias de Prisma
echo "📦 Verificando instalación de Prisma..."
npm list @prisma/client prisma > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "📥 Instalando Prisma..."
    npm install @prisma/client prisma --save-dev
fi

echo ""
echo "🗄️  Ejecutando migraciones de Prisma..."

# Ejecutar migraciones
npx prisma migrate deploy 2>/dev/null || {
    echo "📝 Creando migración inicial..."
    npx prisma migrate dev --name init
}

echo ""
echo "🔧 Generando cliente Prisma..."
npx prisma generate

echo ""
echo "✨ CRM SaaS inicializado correctamente"
echo ""
echo "📊 Stack tecnológico:"
echo "  - Frontend: Next.js 15 + TypeScript + Tailwind"
echo "  - Backend: Next.js API Routes"
echo "  - ORM: Prisma"
echo "  - Database: PostgreSQL (Neon)"
echo "  - State: Zustand"
echo ""
echo "🎯 Módulos disponibles:"
echo "  ✓ Gestión de Contactos"
echo "  ✓ Pipeline de Deals"
echo "  ✓ Gestión de Empresas"
echo "  ✓ Task Management"
echo "  ✓ Email Integration"
echo "  ✓ Reports & Analytics"
echo ""
echo "🚀 Próximos pasos:"
echo "  1. npm install"
echo "  2. npm run dev"
echo "  3. Abre http://localhost:3000"
echo ""
