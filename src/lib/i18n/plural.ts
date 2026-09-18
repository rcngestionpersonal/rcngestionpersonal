// Textos con una cantidad variable: "1 match" / "2 matches".
//
// En el diccionario, la clave base lleva el plural y la misma clave con
// ".uno" el singular, las dos con {n} donde va el número:
//   'x.titulo':     'Tienes {n} matches sin contactar'
//   'x.titulo.uno': 'Tienes {n} match sin contactar'
// El 0 va en plural, como se dice en español ("0 matches").
export function tCantidad(t: (clave: string) => string, clave: string, n: number): string {
  return t(n === 1 ? `${clave}.uno` : clave).replace('{n}', String(n));
}
