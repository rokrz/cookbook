// Comparação sem acentos e sem maiúsculas: "Pão" encontra "pao".
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()
}
