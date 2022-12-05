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
