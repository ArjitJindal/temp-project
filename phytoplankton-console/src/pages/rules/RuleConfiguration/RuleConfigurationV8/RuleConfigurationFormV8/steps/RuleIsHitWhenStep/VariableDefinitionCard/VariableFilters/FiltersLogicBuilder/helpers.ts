import { ImmutableTree } from '@react-awesome-query-builder/ui';

/**
 * Collects all used variables from the ImmutableTree structure
 * @param tree - The tree to collect variables from
 * @returns An array of used variables
 */
export function collectVarNamesFromTree(tree: ImmutableTree): string[] {
  const result: string[] = [];
  function traverse(tree: unknown): void {
    if (tree == null || typeof tree !== 'object') {
      return;
    }
    if (Array.isArray(tree)) {
      for (const item of tree) {
        traverse(item);
      }
      return;
    }
    if ('properties' in tree && typeof tree.properties === 'object') {
      const properties = tree.properties as Record<string, unknown>;
      if (typeof properties.field === 'string') {
        result.push(properties.field);
      }
    }
    Object.values(tree).forEach(traverse);
  }
  const treeJS = tree.toJS();
  traverse(treeJS);
  return result;
}
