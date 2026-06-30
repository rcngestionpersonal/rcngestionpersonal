# RCN CRM SaaS

Un Customer Relationship Management (CRM) moderno y escalable construido con **Next.js**, **TypeScript**, **Prisma** y **PostgreSQL (Neon)**.

## 🏗️ Stack Tecnológico

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Formularios**: React Hook Form
- **Validación**: Zod

### Backend
- **API**: Next.js API Routes
- **ORM**: Prisma
- **Autenticación**: NextAuth.js (configurado en saas-factory)

### Database
- **Motor**: PostgreSQL
- **Provider**: Neon
- **Conexión**: `postgresql://neondb_owner:npg_mMZ7yAgbls1o@ep-small-forest-atxytwvd-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

### Deployment
- **Plataforma**: Vercel
- **Node.js**: v20+

---

## 🎯 Módulos del CRM

### 1. **Autenticación**
- Email/Password login
- OAuth integration ready
- Two-Factor Authentication ready

### 2. **Dashboard**
- Analytics y KPIs
- Widgets personalizables
- Overview de actividad

### 3. **Gestión de Contactos**
- CRUD completo
- Importación/Exportación
- Segmentación y Tags
- Historial de actividades

### 4. **Pipeline de Deals**
- Gestión de oportunidades
- Stages configurables
- Forecasting
- Análisis de probabilidad

### 5. **Gestión de Empresas**
- Base de datos de clientes
- Relaciones y conexiones
- Campos personalizados

### 6. **Tareas y Reminders**
- Task management
- Seguimiento de actividades
- Notificaciones

### 7. **Integración de Email**
- Email tracking
- Templates
- Seguimiento automático

### 8. **Reportes**
- Reportes personalizables
- Exportación de datos
- Scheduling

### 9. **Settings**
- User Management
- Roles & Permissions
- Organization Settings

---

## 🚀 Instalación y Setup

### Requisitos Previos
- Node.js 20+
- PostgreSQL/Neon account
- Vercel account (para deployment)

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/rcngestionpersonal/rcngestionpersonal.git
cd rcngestionpersonal
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env.local
```

Edita `.env.local` y asegúrate de que DATABASE_URL esté configurado:
```
DATABASE_URL=postgresql://neondb_owner:npg_mMZ7yAgbls1o@ep-small-forest-atxytwvd-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

4. **Ejecutar migraciones de Prisma**
```bash
npx prisma migrate dev --name init
npx prisma generate
```

5. **Ejecutar servidor de desarrollo**
```bash
npm run dev
```

El CRM estará disponible en `http://localhost:3000`

---

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── contacts/        # API de contactos
│   │   ├── deals/           # API de deals
│   │   ├── companies/       # API de empresas
│   │   ├── db/              # Health check DB
│   │   └── tasks/           # API de tareas
│   ├── globals.css          # Estilos globales
│   ├── layout.tsx           # Layout principal
│   └── page.tsx             # Home page
├── components/
│   └── crm/                 # Componentes CRM
│       ├── Dashboard.tsx
│       └── ContactsList.tsx
├── hooks/
│   └── useFetch.ts          # Hook para fetch
├── lib/
│   ├── db.ts                # Conexión directa a DB
│   └── prisma.ts            # Cliente Prisma
└── store/
    └── crm.ts               # Zustand store

prisma/
├── schema.prisma            # Esquema de base de datos
└── migrations/              # Migraciones

saas-factory.json            # Configuración del SaaS
```

---

## 📊 Modelos de Base de Datos

### User
- Email, nombre, teléfono, avatar
- Roles y permisos
- Relacionado con Organization

### Organization
- Información de la empresa
- Owner del workspace
- Múltiples usuarios

### Contact
- Datos de contacto personal
- Empresa asociada
- Estado (lead, customer, etc.)
- Tags y categorización

### Company
- Información empresarial
- Industria, sitio web, contacto
- Múltiples contactos asociados

### Deal
- Oportunidad de venta
- Monto y probabilidad
- Stage del pipeline
- Relacionado a contacto y empresa

### Task
- Tareas pendientes
- Prioridad y fechas
- Relacionadas a contactos/deals

### Email
- Tracking de emails
- Historial de comunicación
- Integración automática

### Activity
- Timeline de actividades
- Tipos: call, email, meeting, note

---

## 🔄 Flujo de Trabajo típico

1. **Crear Contacto** → `/api/contacts` POST
2. **Asocarse a Empresa** → actualizar `companyId` del contacto
3. **Crear Deal** → `/api/deals` POST
4. **Asignar Tareas** → `/api/tasks` POST
5. **Registrar Actividades** → automáticamente
6. **Ver Analytics** → dashboard

---

## 🚢 Deployment a Vercel

1. **Conectar repositorio de GitHub**
   ```
   vercel --prod
   ```

2. **Agregar variables de entorno en Vercel**
   - `DATABASE_URL`: Tu conexión a Neon

3. **Deploy automático**
   - Cada push a `main` se despliega automáticamente

---

## 📝 API Endpoints

### Contacts
- `GET /api/contacts` - Listar contactos
- `POST /api/contacts` - Crear contacto
- `GET /api/contacts/[id]` - Obtener contacto
- `PUT /api/contacts/[id]` - Actualizar contacto
- `DELETE /api/contacts/[id]` - Eliminar contacto

### Deals
- `GET /api/deals` - Listar deals
- `POST /api/deals` - Crear deal

### Companies
- `GET /api/companies` - Listar empresas
- `POST /api/companies` - Crear empresa

---

## 🔐 Variables de Entorno

```
DATABASE_URL=postgresql://...
NODE_ENV=development|production
NEXTAUTH_SECRET=generated-secret
NEXTAUTH_URL=http://localhost:3000
```

---

## 📚 Recursos Útiles

- [Documentación de Prisma](https://www.prisma.io/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Neon PostgreSQL](https://neon.tech)
- [Zustand Store](https://github.com/pmndrs/zustand)

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es privado y propiedad de RCN Gestión Personal.

---

## 📧 Contacto

Para más información: rcngestionpersonal@gmail.com

---

**Generado por saas-factory** ✨
