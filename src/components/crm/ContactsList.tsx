import React, { useState } from 'react';

export default function ContactsList() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      setContacts(data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchContacts();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Contactos</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          + Nuevo Contacto
        </button>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : contacts.length === 0 ? (
        <p className="text-gray-500">No hay contactos</p>
      ) : (
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">Nombre</th>
              <th className="border border-gray-300 p-2 text-left">Email</th>
              <th className="border border-gray-300 p-2 text-left">Teléfono</th>
              <th className="border border-gray-300 p-2 text-left">Estado</th>
              <th className="border border-gray-300 p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact: any) => (
              <tr key={contact.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-2">{contact.firstName} {contact.lastName}</td>
                <td className="border border-gray-300 p-2">{contact.email}</td>
                <td className="border border-gray-300 p-2">{contact.phone}</td>
                <td className="border border-gray-300 p-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {contact.status}
                  </span>
                </td>
                <td className="border border-gray-300 p-2">
                  <button className="text-blue-600 hover:underline">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
