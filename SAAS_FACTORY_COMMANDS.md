#!/bin/bash

# ==============================================================================
# COMANDOS DE SAAS-FACTORY PARA CRM
# ==============================================================================

echo "🚀 Comandos disponibles de saas-factory para tu CRM SaaS"
echo ""

# Setup inicial
echo "📦 SETUP INICIAL:"
echo "─────────────────────────────────────────────────────────"
echo "npm install"
echo "  → Instalar todas las dependencias"
echo ""

# Database
echo "🗄️  BASE DE DATOS:"
echo "─────────────────────────────────────────────────────────"
echo "npx prisma migrate dev --name init"
echo "  → Crear migraciones inicial en Neon"
echo ""
echo "npx prisma generate"
echo "  → Generar cliente Prisma actualizado"
echo ""
echo "npx prisma studio"
echo "  → Abrir Prisma Studio para ver/editar datos"
echo ""

# Development
echo "💻 DESARROLLO:"
echo "─────────────────────────────────────────────────────────"
echo "npm run dev"
echo "  → Iniciar servidor de desarrollo (http://localhost:3000)"
echo ""
echo "npm run build"
echo "  → Compilar para producción"
echo ""
echo "npm run start"
echo "  → Ejecutar build producción"
echo ""
echo "npm run lint"
echo "  → Verificar linting"
echo ""

# Testing
echo "🧪 TESTING:"
echo "─────────────────────────────────────────────────────────"
echo "npm test"
echo "  → Ejecutar tests (Jest configurado)"
echo ""

# Deployment
echo "🚢 DEPLOYMENT:"
echo "─────────────────────────────────────────────────────────"
echo "vercel"
echo "  → Deploy a Vercel (staging)"
echo ""
echo "vercel --prod"
echo "  → Deploy a Vercel (producción)"
echo ""

# API Testing
echo "🔌 TESTING API:"
echo "─────────────────────────────────────────────────────────"
echo "# Get contacts"
echo "curl http://localhost:3000/api/contacts"
echo ""
echo "# Create contact"
echo "curl -X POST http://localhost:3000/api/contacts \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"firstName\":\"Juan\",\"lastName\":\"Pérez\",\"email\":\"juan@example.com\",\"userId\":\"...\",\"organizationId\":\"...\"}'"
echo ""
echo "# Get deals"
echo "curl http://localhost:3000/api/deals"
echo ""
echo "# Get companies"
echo "curl http://localhost:3000/api/companies"
echo ""

# Database Management
echo "🛠️  MANAGEMENT:"
echo "─────────────────────────────────────────────────────────"
echo "npx prisma db push"
echo "  → Sincronizar schema con base de datos"
echo ""
echo "npx prisma db seed"
echo "  → Sembrar datos de prueba (seed script)"
echo ""
echo "npx prisma migrate status"
echo "  → Ver estado de migraciones"
echo ""

# Environment
echo "⚙️  VARIABLES DE ENTORNO:"
echo "─────────────────────────────────────────────────────────"
echo "Vercel:"
echo "  DATABASE_URL (Requerido)"
echo "  NEXTAUTH_SECRET (Para autenticación)"
echo "  NEXTAUTH_URL (Para autenticación)"
echo ""
echo "Local (.env.local):"
echo "  DATABASE_URL=postgresql://..."
echo "  NODE_ENV=development"
echo ""

echo ""
echo "═════════════════════════════════════════════════════════════════"
echo "📚 Para más información, revisa: CRM_SAAS_README.md"
echo "═════════════════════════════════════════════════════════════════"
