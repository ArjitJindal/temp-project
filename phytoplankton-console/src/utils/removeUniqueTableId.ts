export function removeUniqueTableId(ids: string[]): string[] {
  return ids.map((str) => {
    const hyphenIndex = str.indexOf('-');
    return hyphenIndex !== -1 ? str.substring(hyphenIndex + 1) : str;
  });
}
