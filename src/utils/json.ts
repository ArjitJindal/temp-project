import flatten from 'flat';
import _ from 'lodash';

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

function removeEmptyInplace(object: any) {
  if (!_.isObject(object)) {
    return;
  }
  _.keys(object).forEach(function (key) {
    const localObj = object[key];
    if (_.isObject(localObj)) {
      if (_.isEmpty(localObj)) {
        delete object[key];
        return;
      }
      removeEmptyInplace(localObj);
      if (_.isEmpty(localObj)) {
        delete object[key];
        return;
      }
    } else if (_.isNil(localObj)) {
      delete object[key];
      return;
    }
  });
}

export function removeEmpty<T>(o: T): T {
  const object = _.cloneDeep(o);
  removeEmptyInplace(object);
  return object;
}

export function flattenObject(object: any): any {
  return flatten(object, { safe: true, delimiter: '.' }) as any;
}

export function getFixedSchemaJsonForm(schema: object) {
  return _.cloneDeepWith(schema, (value) => {
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
