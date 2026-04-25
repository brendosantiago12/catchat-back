/**
 * Normaliza um nome em uma tag de túnel.
 * Ex: "João da Silva" → "joao_da_silva"
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Gera uma tag única para um túnel, evitando colisão com tags existentes
 * para o mesmo telefone de origem.
 *
 * Ex: se "joao_silva" já existe, retorna "joao_silva_2"
 */
export function generateTag(recipientName: string, existingTags: string[]): string {
  const base = normalizeName(recipientName);
  if (!existingTags.includes(base)) {
    return base;
  }

  let suffix = 2;
  while (existingTags.includes(`${base}_${suffix}`)) {
    suffix++;
  }
  return `${base}_${suffix}`;
}
