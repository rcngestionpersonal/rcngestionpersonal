# Evaluación sobre el Delegado de Protección de Datos (DPD/DPO) — Redinmo

> Documento interno, no público (fase de cierre, punto 2.4). El objetivo no
> es concluir con certeza legal si Redinmo necesita un DPO — eso lo decide
> un abogado — sino dejar la pregunta razonada por escrito para que la
> respuesta no sea, simplemente, un olvido.

**Fecha de esta evaluación:** 2026-09-02. Revisar de nuevo si el volumen de agentes activos crece de forma significativa, si se empieza a tratar una categoría de dato sensible que hoy no se trata, o si cambia la actividad principal del negocio.

## Criterios habituales para exigir un DPO (a confirmar con el abogado contra el texto exacto de la LOPDP y su reglamento)

1. **Tratamiento a gran escala de datos personales** como actividad principal del negocio.
2. **Tratamiento sistemático y a gran escala** que requiera observación regular de titulares.
3. **Tratamiento a gran escala de categorías especiales de datos** (salud, datos biométricos, origen étnico, orientación sexual, opiniones políticas, etc.).
4. Ser una entidad pública, o superar los umbrales de volumen de datos/ingresos que fije el reglamento.

## Situación actual de Redinmo frente a estos criterios

- **Volumen**: ver `scripts/audit-billing-state.ts` para el conteo vigente de agentes/suscripciones — al momento de esta evaluación, la base tiene un número reducido de cuentas (ver el resultado de la última corrida del script). Esto está lejos de cualquier umbral razonable de "gran escala".
- **Naturaleza del dato**: los datos tratados (nombre, cédula, teléfono, correo, dirección, dato de inmuebles, token de tarjeta) son datos personales comunes y financieros — **no** se tratan categorías especiales (salud, biometría, ideología, orientación sexual, datos de menores, etc.).
- **Actividad principal**: la actividad principal de Redinmo es la intermediación inmobiliaria entre agentes, no el tratamiento de datos en sí mismo (a diferencia de, por ejemplo, un data broker o una empresa de scoring crediticio).
- **Observación sistemática**: no existe seguimiento de comportamiento a gran escala (no hay tracking de terceros, publicidad ni perfilado — ver `/legal/cookies`).

## Conclusión preliminar (no vinculante — sujeta a revisión legal)

Con el volumen y la naturaleza de datos actuales, Redinmo **probablemente no está obligado** a designar un Delegado de Protección de Datos. Ninguno de los criterios de "gran escala" o "categorías especiales" parece cumplirse hoy.

Esta conclusión debe revisarse — y probablemente cambiar la respuesta — si en el futuro:

- El número de agentes activos crece a un orden de magnitud considerablemente mayor.
- Redinmo empieza a tratar datos de una categoría especial (por ejemplo, si se agregara verificación biométrica de identidad).
- Redinmo cambia de modelo de negocio hacia algo cuya actividad principal sea el tratamiento o la venta de datos.

## Responsable de la decisión final

**Esta es una conclusión preliminar redactada por una herramienta de asistencia técnica, no una opinión legal.** Debe ser confirmada (o corregida) por un abogado especializado en protección de datos antes de comunicarse a la Superintendencia o a cualquier tercero como la postura oficial de la empresa.
