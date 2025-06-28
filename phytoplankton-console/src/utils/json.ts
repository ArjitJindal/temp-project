import flatten from 'flat';
import { cloneDeep, cloneDeepWith, isEmpty, isNil, isObject, keys, startCase } from 'lodash';

export function removeNil<T>(object: T): T {
  return JSON.parse(
    JSON.stringify(object, (k, v) => {
      if (v === null || v === false) {
        return undefined;
      }
      return v;
    }),
  );
}

function removeEmptyInplace(object: any) {
  if (!isObject(object)) {
    return;
  }
  keys(object).forEach(function (key) {
    const localObj = object[key];
    if (isObject(localObj)) {
      if (isEmpty(localObj)) {
        delete object[key];
        return;
      }
      removeEmptyInplace(localObj);
      if (isEmpty(localObj)) {
        delete object[key];
        return;
      }
    } else if (isNil(localObj) || localObj === false || localObj === '') {
      delete object[key];
      return;
    }
  });
}

export function removeEmpty<T>(o: T): T {
  const object = cloneDeep(o);
  removeEmptyInplace(object);
  return object;
}

export function flattenObject(object: any): any {
  return flatten(object, { safe: false, delimiter: '.' }) as any;
}

export function getFlattenedObjectHumanReadableKey(flattenedKey: string): string {
  return flattenedKey
    .split('.')
    .filter((key) => isNaN(Number(key)))
    .map(startCase)
    .join(' > ');
}

export function getFixedSchemaJsonForm(schema: object) {
  return cloneDeepWith(schema, (value) => {
    /**
     * antd theme doesn't allow clearing the selected enum even the field is nullable.
     * In this case, we concat the "empty" option and it'll be removed by removeNil
     * to be a truly nullable field
     */
    if (value?.enum && value?.type === 'string' && value?.nullable) {
      return {
        ...value,
        enum: [''].concat(value.enum),
      };
    }
  });
}

export function exportJsonlFile(data: object[], fileName: string) {
  const json = data.map((item) => JSON.stringify(item)).join('\n');
  const blob = new Blob([json], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName + '.txt';
  a.click();
}
