# Operación: ENCRYPTION_KEY

Documento de operación, no de arquitectura. Está aquí porque un comentario en
el código no se lee el día que hace falta.

## Qué protege

`ENCRYPTION_KEY` cifra en reposo, con AES-256-GCM, tres cosas:

| Dónde | Qué |
|---|---|
| `Contrato.datosCifrados` | Todos los campos del formulario: nombres, cédulas, direcciones y teléfonos de las partes |
| `ContratoFirmante.cedulaCifrada` | La cédula completa de cada firmante |
| `ContratoFirmante.evidenciaCifrada` | El registro probatorio de cada firma: IP, navegador, si desplazó el documento |
| `PaymentMethod` | El ctoken de Payphone del medio de pago guardado |

Son datos de terceros que nunca aceptaron nuestros términos. Por eso el módulo
de contratos se niega a operar sin la clave, en vez de guardar cédulas en claro.

## Dónde debe vivir

**En Vercel, en los tres entornos: Production, Preview y Development.** No en el
repositorio, no en un archivo del proyecto, no en un mensaje de chat.

```bash
# Generar una clave nueva (solo si no existe ninguna todavía)
openssl rand -hex 32

# Cargarla en los tres entornos
vercel env add ENCRYPTION_KEY production
vercel env add ENCRYPTION_KEY preview
vercel env add ENCRYPTION_KEY development
```

**En local**, en `.env`, que está en `.gitignore`. La forma correcta de
obtenerla es traerla de Vercel, no reescribirla a mano:

```bash
vercel env pull .env.local
```

El formato admitido son 64 caracteres hexadecimales, o cualquier frase, que se
deriva con SHA-256 hasta los 32 bytes que exige AES-256. Da igual cuál uses,
pero **tiene que ser exactamente la misma cadena en todas partes**: una frase y
su equivalente en hexadecimal no producen la misma clave.

**Los tres entornos comparten hoy la misma base de datos.** Mientras eso siga
así, la clave tiene que ser idéntica en los tres, o los contratos creados desde
un entorno no se abrirán desde otro.

## Debe respaldarse fuera del proyecto

Vercel no permite leer el valor de una variable una vez guardada. Si el
respaldo no existe en otro sitio, la clave solo vive dentro de la plataforma.

Guárdala en un gestor de contraseñas, en la bóveda de la empresa o en un sobre
sellado, junto con la fecha en que se puso en servicio. Que sea recuperable por
más de una persona: una clave que solo conoce quien montó el proyecto es un
punto único de fallo con nombre y apellido.

## Qué pasa si se pierde

**Los datos cifrados con ella quedan irrecuperables.** No hay proceso de
recuperación, y no debe haberlo: si existiera, el cifrado no serviría de nada.

Lo peor no es perderla. Lo peor es **reemplazarla sin darse cuenta**, porque el
sistema no protesta:

- `descifrarDatos()` captura el fallo y devuelve un objeto vacío.
- El resultado es un contrato que se abre e imprime **con las partes en blanco**,
  sin un solo error en pantalla ni en el log.
- Un contrato ya firmado pierde así la constancia de quién lo firmó.

Por eso, antes de cargar una clave en un entorno donde ya existen contratos, hay
que verificar que es la misma. Si no lo es, primero se decide qué hacer con esos
contratos: no se carga y ya.

### Cómo comprobar si una clave es la correcta

Intentar descifrar un contrato existente. Si descifra, es la clave. Si no, no lo
es, y cargarla causará el daño silencioso descrito arriba.

## Incidente del 2026-09-09

Queda anotado porque es el caso real que motivó este documento.

`ENCRYPTION_KEY` no estaba cargada en ningún entorno de Vercel. El módulo de
contratos respondía 503 a todo, y la guarda que lo provocaba no dejaba rastro en
el log, así que desde fuera se leía igual que una base de datos caída.

Al mismo tiempo había 6 contratos y 6 firmantes en la base de producción,
creados a las 04:57 hora de Ecuador de ese día desde una sesión local, con una
clave que después no apareció en ningún sitio: ni en los archivos `.env`, ni en
el historial de la terminal, ni en el repositorio, ni en Vercel. Se probaron
todos los candidatos plausibles contra el texto cifrado real y ninguno descifró.

Lo que cambió a raíz de esto:

- La guarda registra el motivo y el agente afectado, en vez de callar.
- `src/instrumentation.ts` comprueba las variables al arrancar el servidor, así
  que una ausencia se ve al desplegar y no cuando un agente abre la pestaña.
- Existe este documento.

Lo que sigue pendiente de decidir: qué se hace con esos 6 contratos si la clave
original no aparece.
