export const GAP = 12;

export const DATA_KEY = 'data-key';

export function calcVisibleElements(
  itemIds: string[],
  sizes: { [key: string]: number },
  scrollPosition: number,
) {
  let offset = 0;
  const idToSize = Object.entries(sizes).reverse();
  const hidden: string[] = [];
  for (let i = 0; i < idToSize.length; i += 1) {
    const [id, size] = idToSize[i];
    if (i === 0) {
      offset += GAP;
    }
    if (offset >= scrollPosition) {
      break;
    }
    offset += size;
    hidden.push(id);
  }
  return itemIds.filter((x) => !hidden.includes(x) && sizes[x] != null);
}
