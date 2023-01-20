import flatten from 'flat';

export function removeNil<T>(object: T): T {
  return JSON.parse(
    JSON.stringify(object, (k, v) => {
      if (v === null) {
        return undefined;
      }
      return v;
    }),
  );
}

export function flattenObject(object: any): any {
  return flatten(object, { safe: true, delimiter: '.' }) as any;
}
