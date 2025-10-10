import { ExportDataRow } from '@/utils/data-export';

export type ExportParams = {
  dataStructure: ExportDataStructure;
  execute: (keys: ExportKey[]) => ExportDataRow;
};

export type ExportDataStructureField = {
  label: string;
  id: string;
  type: 'string' | 'number' | 'boolean';
};

export type ExportDataStructureFieldGroup = {
  label: string;
  id: string;
  children: ExportDataStructure;
};

export type ExportDataStructure = {
  label?: string;
  fields: (ExportDataStructureField | ExportDataStructureFieldGroup)[];
};

export type ExportKey = string[];

export function removePrefix(key: ExportKey, prefix: ExportKey): ExportKey {
  if (prefix.length > key.length) {
    return key;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== key[i]) {
      return key.slice(i);
    }
  }
  return key.slice(prefix.length);
}

export function isPrefix(key: ExportKey, prefix: ExportKey): boolean {
  if (prefix.length > key.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== key[i]) {
      return false;
    }
  }
  return true;
}

export function isEqual(key: ExportKey, other: ExportKey): boolean {
  if (key.length !== other.length) {
    return false;
  }
  for (let i = 0; i < key.length; i++) {
    if (key[i] !== other[i]) {
      return false;
    }
  }
  return true;
}
