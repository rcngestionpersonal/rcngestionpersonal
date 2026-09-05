# Procedimiento de brechas de seguridad — Redinmo.io

> Documento interno, no público (fase de cierre, punto 2.4). Qué hacer, a
> quién notificar y en qué plazo si se filtran o comprometen datos
> personales tratados por Redinmo.io. Un abogado debe confirmar los plazos
> exactos que exige la LOPDP y su reglamento antes de que este documento se
> use como referencia operativa real ante un incidente.

## Qué cuenta como brecha

Cualquier evento que exponga, altere sin autorización, destruya o vuelva inaccesible un dato personal tratado por Redinmo.io. Ejemplos concretos dado el sistema actual:

- Acceso no autorizado a la base de datos (Neon) o a las variables de entorno de producción (Vercel).
- Filtración del valor de `ENCRYPTION_KEY` (compromete todos los tokens de tarjeta cifrados en reposo — ver `src/lib/real-estate/payments/encryption.ts`) o de `PAYPHONE_CODING_PASSWORD`.
- Un endpoint que exponga datos de un agente a otro por error (por ejemplo, un fallo de autorización en una API).
- Pérdida o robo de un dispositivo con acceso a credenciales de producción.
- Un tercero (Payphone, Neon, Vercel, Resend) reporta su propia brecha que involucra datos de Redinmo.io.

## Pasos inmediatos (primeras horas)

1. **Contener**: revocar o rotar la credencial comprometida de inmediato (ejemplos: `vercel env rm` + `vercel env add` con un valor nuevo para la variable afectada; forzar cierre de sesión de los agentes afectados si es una fuga de sesión; desactivar el `PaymentMethod` afectado con `active=false` si el token de tarjeta está en duda).
2. **Evaluar alcance**: qué tabla(s)/modelo(s) de `prisma/schema.prisma` están involucrados, cuántos registros, y si incluye datos financieros (token de tarjeta) o solo datos de contacto.
3. **Registrar internamente**: fecha y hora de detección, cómo se detectó, qué se hizo para contener, y el alcance estimado. Este registro es lo que después se usa para notificar.

## Notificación

**A la autoridad (Superintendencia de Protección de Datos Personales, Ecuador)**: la LOPDP exige notificar una brecha que suponga un riesgo para los derechos de los titulares. **Confirmar con el abogado el plazo exacto** (el reglamento de la ley, vigente desde noviembre de 2023, lo especifica) antes de que ocurra un incidente real — no en medio de uno.

**A los titulares afectados**: si la brecha implica un riesgo alto para sus derechos (por ejemplo, exposición de tokens de tarjeta o de cédulas), se les notifica directamente por correo electrónico, describiendo: qué pasó, qué datos están involucrados, qué se hizo para contenerlo, y qué pueden hacer ellos (por ejemplo, cambiar su contraseña, estar atentos a movimientos no reconocidos en su tarjeta con su banco).

**A los procesadores involucrados**: si la brecha se originó o involucra a Payphone, Neon, Vercel o Resend, notificarles también, ya que pueden tener sus propias obligaciones de reporte.

## Responsable interno

**Rigoberto Carrera Negrete** es quien decide, en última instancia, si un incidente califica como brecha reportable y coordina la notificación. Quien detecte el incidente debe escalárselo de inmediato en vez de decidir unilateralmente si se notifica o no.

## Después del incidente

- Documentar la causa raíz y la corrección aplicada.
- Revisar si el incidente revela que hace falta actualizar el [RAT](./RAT.md) (por ejemplo, si expuso una actividad de tratamiento que no estaba bien acotada) o la [evaluación de DPO](./evaluacion-dpo.md) (un incidente grave puede cambiar esa conclusión).
- Si la brecha involucró datos de tarjeta, evaluar con Payphone si corresponde algún paso adicional de su parte (por ejemplo, invalidar el `ctoken` comprometido).
