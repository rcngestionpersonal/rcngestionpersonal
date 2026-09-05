# Registro de Actividades de Tratamiento (RAT) — Redinmo.io

> Documento interno, no público (fase de cierre, punto 2.4). Obligación
> concreta de la Ley Orgánica de Protección de Datos Personales del Ecuador
> (LOPDP) — es lo primero que pide la Superintendencia ante un requerimiento.
> Mantenerlo actualizado cada vez que se agregue un tratamiento de datos
> nuevo (una integración, un campo nuevo en el registro, un proveedor
> nuevo). Un abogado debe revisar la base legal asignada a cada actividad
> antes de considerar este documento definitivo.

**Responsable del tratamiento:** Rigoberto Carrera Negrete, persona natural con RUC 1710804954001, domicilio en Av. República del Salvador N36-109 y Suecia, Edificio Terrasol, Quito, Ecuador. Redinmo.io es el nombre comercial bajo el cual se presta el servicio. Contacto: privacidad@redinmo.io · +593 96 870 7200.

**Última actualización:** 2026-09-02 (corresponde a la versión 2026-09-02 de `/legal/privacidad`, ver `src/lib/real-estate/legal.ts`).

---

## 1. Registro y gestión de cuenta de agente

| Campo | Detalle |
|---|---|
| Finalidad | Crear y administrar la cuenta del agente inmobiliario en la plataforma. |
| Base legal | Ejecución del contrato de servicio (Términos y Condiciones aceptados al registrarse). |
| Categorías de datos | Nombre completo, cédula/RUC, teléfono, correo, contraseña (hash), dirección profesional, número de licencia. |
| Categoría de titulares | Agentes inmobiliarios registrados. |
| Origen del dato | El propio titular, vía el formulario de registro (`/agentes/registro`). |
| Destinatarios/encargados | Neon (base de datos), Vercel (hosting). Sin terceros adicionales. |
| Transferencia internacional | Sí — Neon y Vercel operan con infraestructura en EE.UU. |
| Plazo de conservación | Mientras la cuenta esté activa o en modo lectura; ver política de eliminación de cuenta. |
| Medidas de seguridad | Contraseña con hash (nunca texto plano), acceso restringido por rol, HTTPS en toda la plataforma. |
| Sistema | Modelo `Agent` (`prisma/schema.prisma`). |

## 2. Verificación de identidad del agente

| Campo | Detalle |
|---|---|
| Finalidad | Confirmar que el agente es quien dice ser y que su licencia/actividad es real, para mantener la confianza de la comunidad (carnet de agente, verificación pública). |
| Base legal | Interés legítimo de Redinmo.io y de los demás agentes/clientes de la plataforma. |
| Categorías de datos | Cédula o RUC, número de licencia profesional, años de experiencia (autodeclarados). |
| Categoría de titulares | Agentes inmobiliarios. |
| Destinatarios/encargados | Ninguno externo — tratamiento interno. El carnet público (`/v/[slug]`) muestra únicamente nombre, foto y estado de verificación, nunca la cédula completa. |
| Transferencia internacional | Sí (almacenamiento en Neon, ver actividad 1). |
| Plazo de conservación | Mientras la cuenta esté activa. |
| Sistema | Campos `idNumber`, `licenseNumber`, `carnetSlug` en `Agent`. |

## 3. Publicación de inmuebles

| Campo | Detalle |
|---|---|
| Finalidad | Permitir que el agente publique y gestione sus inmuebles dentro de la plataforma. |
| Base legal | Ejecución del contrato de servicio. |
| Categorías de datos | Dirección, características, fotografías y precio del inmueble. El agente declara en los Términos contar con autorización del propietario para publicarlo. |
| Categoría de titulares | Propietarios de los inmuebles (terceros respecto de Redinmo.io — ver actividad 4 sobre el mismo problema con clientes finales). |
| Destinatarios/encargados | Neon (almacenamiento), Vercel Blob (fotografías). |
| Transferencia internacional | Sí. |
| Plazo de conservación | Mientras el inmueble o la cuenta del agente estén activos. |
| Sistema | Modelo `Listing`. |

## 4. Registro de pedidos de clientes finales (datos de terceros)

| Campo | Detalle |
|---|---|
| Finalidad | Registrar la búsqueda de un cliente del agente para poder cruzarla (match) contra inmuebles disponibles. |
| Base legal | Consentimiento del cliente final, obtenido y declarado por el agente que carga el dato (Términos, sección 4: "el agente declara contar con la autorización de ese cliente"). Redinmo.io no tiene relación directa con este titular. |
| Categorías de datos | Nombre, teléfono y preferencias de búsqueda del cliente del agente. |
| Categoría de titulares | Clientes finales de los agentes — terceros que nunca aceptaron los Términos de Redinmo.io directamente. |
| Destinatarios/encargados | Neon (almacenamiento), y el/los agente(s) con quienes se genere un match. |
| Transferencia internacional | Sí. |
| Plazo de conservación | Mientras el pedido o la cuenta del agente que lo cargó estén activos. |
| Riesgo específico | Es la actividad de mayor riesgo del RAT: el titular no interactúa con Redinmo.io. Mitigación actual: obligación contractual al agente (Términos sección 4) de contar con autorización previa. **Pendiente de evaluar con el abogado**: si conviene además una casilla de confirmación explícita en el formulario de carga de pedidos. |
| Sistema | Modelo `Opportunity`. |

## 5. Matching entre agentes

| Campo | Detalle |
|---|---|
| Finalidad | Cruzar pedidos de un agente contra inmuebles de otro y notificar la coincidencia. |
| Base legal | Ejecución del contrato de servicio (es la función central del producto). |
| Categorías de datos | Referencias a los registros de las actividades 3 y 4 — no se recolecta un dato nuevo, se cruzan los existentes. |
| Categoría de titulares | Agentes y, transitivamente, propietarios/clientes finales. |
| Destinatarios/encargados | Los agentes involucrados en el match (reciben notificación de contacto). |
| Transferencia internacional | Sí (almacenamiento, ver actividad 1). |
| Plazo de conservación | Historial de matches conservado mientras la cuenta esté activa. |
| Sistema | Modelo `AgentMatch`. |

## 6. Procesamiento de pagos y suscripción recurrente

| Campo | Detalle |
|---|---|
| Finalidad | Cobrar la suscripción mensual, incluyendo el cobro automático recurrente autorizado por el agente. |
| Base legal | Ejecución del contrato + consentimiento expreso para el cobro automático (checkbox no premarcado en el checkout, texto guardado verbatim en `SubscriptionEvent`). |
| Categorías de datos | Identificador cifrado de tarjeta (token de Payphone, nunca el número completo), marca y últimos 4 dígitos, cédula/RUC, teléfono, correo, dirección (`billTo`), historial de cobros y montos. |
| Categoría de titulares | Agentes con suscripción paga. |
| Destinatarios/encargados | **Payphone** (procesador de pago — encargado del tratamiento del dato de tarjeta en sí). Neon (almacenamiento del token cifrado y del historial). |
| Transferencia internacional | Sí (Payphone opera en Ecuador; Neon/Vercel en EE.UU.). |
| Plazo de conservación | Historial de cobros conservado indefinidamente por motivos contables/tributarios (Ecuador exige conservar comprobantes; confirmar plazo exacto con el abogado/contador). El token de tarjeta se conserva mientras el método de pago esté activo; se puede desactivar (`PaymentMethod.active=false`) sin borrar el historial de cobros ya realizados. |
| Medidas de seguridad | Token cifrado en reposo con AES-256-GCM, clave propia (`ENCRYPTION_KEY`) distinta de la que usa Payphone para el campo `cardHolder` — ver `src/lib/real-estate/payments/encryption.ts`. Redinmo.io nunca ve ni almacena el número completo de tarjeta. |
| Sistema | Modelos `Subscription`, `PaymentMethod`, `Charge`, `SubscriptionEvent`. |

## 7. Notificaciones transaccionales

| Campo | Detalle |
|---|---|
| Finalidad | Avisos de cobro próximo, cobro aprobado/rechazado, cambios de estado de la cuenta, bienvenida. |
| Base legal | Ejecución del contrato (son avisos operativos, no marketing). |
| Categorías de datos | Correo electrónico, nombre, contenido del aviso (plan, monto, fecha). |
| Categoría de titulares | Agentes. |
| Destinatarios/encargados | **Resend** (proveedor de envío de correo). |
| Transferencia internacional | Sí. |
| Plazo de conservación | No se conserva un histórico de los correos enviados más allá de lo que registre Resend según su propia política. |
| Sistema | `src/lib/real-estate/notifications/notify.ts`, `src/lib/real-estate/email.ts`. |

## 8. Registros técnicos y seguridad

| Campo | Detalle |
|---|---|
| Finalidad | Prevenir fraude, dejar constancia de consentimientos (IP + fecha), depurar errores. |
| Base legal | Interés legítimo (seguridad de la plataforma) y obligación de poder probar un consentimiento ante un reclamo de cobro. |
| Categorías de datos | Dirección IP, fecha/hora, identificador de sesión. |
| Categoría de titulares | Agentes (y, brevemente, visitantes anónimos vía la cookie de sesión). |
| Destinatarios/encargados | Vercel (logs de la plataforma). |
| Transferencia internacional | Sí. |
| Plazo de conservación | La IP asociada a un consentimiento específico (tokenización, aceptación de Términos) se conserva junto con ese registro, por la misma razón que el historial de cobros. |
| Sistema | Campos `consentIp`, `termsAcceptedIp`; logs de Vercel. |

## 9. Mapa de precios de cierre

| Campo | Detalle |
|---|---|
| Finalidad | Mostrar una referencia de mercado (montos y zonas de operaciones cerradas) a la comunidad de agentes. |
| Base legal | Interés legítimo + los datos se aportan voluntariamente por el propio agente sobre sus propias operaciones. |
| Categorías de datos | Monto, zona y fecha de cierre. Sin datos identificables del propietario ni del comprador. |
| Categoría de titulares | Agentes (dato autodeclarado sobre su propia operación). |
| Destinatarios/encargados | Visible para el resto de la comunidad de agentes dentro de la plataforma. |
| Transferencia internacional | Sí (almacenamiento). |
| Plazo de conservación | Mientras la cuenta del agente que lo declaró esté activa. |
| Sistema | Modelo `ClosedDeal`. |

---

## Terceros / encargados de tratamiento (resumen)

| Proveedor | Rol | Datos que procesa |
|---|---|---|
| Payphone | Procesador de pago | Datos de tarjeta completos (Redinmo.io nunca los ve), identidad del pagador |
| Neon | Base de datos | Todos los datos listados arriba |
| Vercel | Hosting + Blob storage | Todos los datos en tránsito; fotografías de inmuebles |
| Resend | Envío de correo | Correo electrónico, nombre, contenido del mensaje |

## Pendientes de este documento

- Confirmar con el abogado el plazo exacto de conservación de comprobantes de pago según normativa tributaria vigente.
- Evaluar si la actividad 4 (datos de clientes finales) necesita una casilla de confirmación explícita adicional en el formulario de carga de pedidos, no solo la declaración contractual del agente.
- Completar los datos de identidad de la empresa en el encabezado de este documento (mismos placeholders que `/legal/terminos` y `/legal/privacidad`).
