import React from 'react';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-600">RCN CRM SaaS</h1>
          <nav className="space-x-4">
            <Link href="/dashboard" className="text-gray-700 hover:text-indigo-600">
              Dashboard
            </Link>
            <Link href="/contacts" className="text-gray-700 hover:text-indigo-600">
              Contactos
            </Link>
            <Link href="/deals" className="text-gray-700 hover:text-indigo-600">
              Deals
            </Link>
            <Link href="/companies" className="text-gray-700 hover:text-indigo-600">
              Empresas
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {/* KPI Cards */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Total Contactos</p>
            <p className="text-3xl font-bold text-indigo-600 mt-2">--</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Deals Activos</p>
            <p className="text-3xl font-bold text-green-600 mt-2">--</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Ingresos Potenciales</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">$--</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm">Tareas Pendientes</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">--</p>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold mb-6">Funcionalidades del CRM</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-l-4 border-indigo-600 pl-4">
              <h3 className="font-bold text-lg mb-2">Gestión de Contactos</h3>
              <p className="text-gray-600">
                Organiza y gestiona todos tus contactos en un solo lugar
              </p>
            </div>
            <div className="border-l-4 border-green-600 pl-4">
              <h3 className="font-bold text-lg mb-2">Pipeline de Deals</h3>
              <p className="text-gray-600">
                Visualiza y gestiona tus oportunidades de negocio
              </p>
            </div>
            <div className="border-l-4 border-blue-600 pl-4">
              <h3 className="font-bold text-lg mb-2">Gestión de Empresas</h3>
              <p className="text-gray-600">
                Control centralizado de tus cuentas empresariales
              </p>
            </div>
            <div className="border-l-4 border-purple-600 pl-4">
              <h3 className="font-bold text-lg mb-2">Tareas y Reminders</h3>
              <p className="text-gray-600">
                Nunca olvides un seguimiento importante
              </p>
            </div>
            <div className="border-l-4 border-pink-600 pl-4">
              <h3 className="font-bold text-lg mb-2">Integración de Email</h3>
              <p className="text-gray-600">
                Rastrear y gestionar emails directamente desde el CRM
              </p>
            </div>
            <div className="border-l-4 border-yellow-600 pl-4">
              <h3 className="font-bold text-lg mb-2">Reportes y Analytics</h3>
              <p className="text-gray-600">
                Obtén insights sobre tu desempeño de ventas
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
