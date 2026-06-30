export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-blue-50 to-blue-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">
          RCN Gestión Personal
        </h1>
        
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-green-800 font-semibold">✓ GitHub Vinculado</p>
            <p className="text-green-600 text-sm">Repositorio: rcngestionpersonal</p>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800 font-semibold">✓ Vercel Configurado</p>
            <p className="text-blue-600 text-sm">Despliegue automático habilitado</p>
          </div>
          
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-purple-800 font-semibold">✓ Neon Vinculado</p>
            <p className="text-purple-600 text-sm">Base de datos PostgreSQL lista</p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">
            Verificar conexión a base de datos
          </h2>
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/db');
                const data = await response.json();
                alert('Base de datos: ' + JSON.stringify(data, null, 2));
              } catch (error) {
                alert('Error al conectar: ' + error);
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
          >
            Test Conexión
          </button>
        </div>
      </div>
    </main>
  );
}
