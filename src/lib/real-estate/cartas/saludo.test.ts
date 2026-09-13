import { describe, expect, it } from 'vitest';
import { resolverSaludo } from './saludo';

// El saludo lo arma el codigo, no el modelo. Estas pruebas fijan las reglas:
// formula de tratamiento, titulo delante del nombre, genero solo con certeza,
// empresa en plural, y siempre una coma al final.

describe('saludo de la carta', () => {
  it('nombre femenino: "Estimada"', () => {
    expect(resolverSaludo('Gabriela Muñoz').texto).toBe('Estimada Gabriela Muñoz,');
  });

  it('nombre masculino: "Estimado"', () => {
    expect(resolverSaludo('Patricio Andrade').texto).toBe('Estimado Patricio Andrade,');
  });

  it('nombre ambiguo: "Estimado/a", sin adivinar', () => {
    expect(resolverSaludo('Alex Morán').texto).toBe('Estimado/a Alex Morán,');
    expect(resolverSaludo('Guadalupe Cevallos').texto).toBe('Estimado/a Guadalupe Cevallos,');
  });

  it('nombre que no está en las listas: tampoco adivina por la terminación', () => {
    // "Luca" termina en -a y es de hombre: por eso no se deduce por la letra final.
    expect(resolverSaludo('Luca Bianchi').texto).toBe('Estimado/a Luca Bianchi,');
  });

  it('el caso que salió mal: título, mayúsculas y cargo de puesto', () => {
    const s = resolverSaludo('ING. GABRIELA MUÑOZ', 'GERENTE');
    // El titulo va; el puesto no ("Estimada Gerente..." no es castellano).
    expect(s.texto).toBe('Estimada Ing. Gabriela Muñoz,');
    expect(s.trato).toBe('femenino');
  });

  it('título que marca el género', () => {
    expect(resolverSaludo('Dr. Andrés Salazar').texto).toBe('Estimado Dr. Andrés Salazar,');
    expect(resolverSaludo('Lcda. Paola Ruiz').texto).toBe('Estimada Lcda. Paola Ruiz,');
    // Nombre ambiguo, pero "Dra." lo resuelve.
    expect(resolverSaludo('Dra. Alex Morán').texto).toBe('Estimada Dra. Alex Morán,');
  });

  it('título escrito en el campo de cargo', () => {
    expect(resolverSaludo('María Paz Cordero', 'Ingeniera').texto).toBe('Estimada Ing. María Paz Cordero,');
    // Un cargo de varias palabras es un puesto, no un titulo.
    expect(resolverSaludo('María Paz Cordero', 'Directora comercial').texto).toBe('Estimada María Paz Cordero,');
  });

  it('si título y nombre se contradicen, no elige', () => {
    expect(resolverSaludo('Dr. Gabriela Muñoz').texto).toBe('Estimado/a Dr. Gabriela Muñoz,');
  });

  it('nombres compuestos: decide el primero', () => {
    expect(resolverSaludo('María José Espinosa').texto).toBe('Estimada María José Espinosa,');
    expect(resolverSaludo('José María Egas').texto).toBe('Estimado José María Egas,');
  });

  it('empresa: "Estimados señores de"', () => {
    expect(resolverSaludo('Constructora Andrade S.A.').texto).toBe('Estimados señores de Constructora Andrade S.A.,');
    expect(resolverSaludo('Pronobis Cía. Ltda.').texto).toBe('Estimados señores de Pronobis Cía. Ltda.,');
    expect(resolverSaludo('Uribe & Schwarzkopf').texto).toBe('Estimados señores de Uribe & Schwarzkopf,');
    expect(resolverSaludo('Constructora Andrade S.A.').trato).toBe('empresa');
  });

  it('respeta las mayúsculas que el agente escribió a propósito', () => {
    expect(resolverSaludo('María José de la Torre').texto).toBe('Estimada María José de la Torre,');
    expect(resolverSaludo('maría josé de la torre').texto).toBe('Estimada María José de la Torre,');
  });

  it('siempre termina en coma, nunca en dos puntos ni con paréntesis', () => {
    for (const nombre of ['Gabriela Muñoz:', '(Ing. Gabriela Muñoz)', 'Patricio Andrade,', 'Alex Morán.']) {
      const { texto } = resolverSaludo(nombre);
      expect(texto.endsWith(','), texto).toBe(true);
      expect(texto, texto).not.toMatch(/[():]|,,|\.,/);
    }
  });
});
