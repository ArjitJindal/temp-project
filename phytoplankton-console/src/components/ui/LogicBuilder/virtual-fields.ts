import {
  Fields,
  ImmutableTree,
  JsonLogicResult,
  JsonLogicTree,
  Utils as QbUtils,
} from '@react-awesome-query-builder/ui';
import { mapValues } from 'lodash';
import { QueryBuilderConfig } from './types';

/*
    This file contains the logic for the virtual fields that are created to support converting text fields to number fields.
    Ideally, it should be done by applying functions to nested fields, but, unfortunately, "@react-awesome-query-builder" doesn't support it.
*/

/**
 * A suffix for the virtual fields that are created to support converting text fields to number fields.
 */
export const VIRTUAL_STRING_TO_NUMBER_SUFFIX = ':STRING_TO_NUMBER';

/**
 * A suffix for the virtual fields that are created to support converting text fields to timestamp fields.
 */
export const VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX = ':STRING_TO_TIMESTAMP';

export const STRING_TO_NUMBER_FIELDS = ['key', 'value'];
export const STRING_TO_TIMESTAMP_FIELDS = ['value'];

export function jsonLogicParse(
  jsonLogic: unknown,
  config: QueryBuilderConfig,
): ImmutableTree | undefined {
  const preparedLogic = parseVirtualFields(jsonLogic);
  const tree = QbUtils.loadFromJsonLogic(preparedLogic as object, config);
  return tree;
}

export function jsonLogicFormat(tree: ImmutableTree, config: QueryBuilderConfig): JsonLogicResult {
  const rawJsonLogic = QbUtils.jsonLogicFormat(tree, config);
  return {
    ...rawJsonLogic,
    logic: reduceVirtualFields(rawJsonLogic.logic) as JsonLogicTree | undefined,
  };
}

/*
    Helper functions
*/
export function parseVirtualFields(jsonLogic: unknown): unknown {
  function traverse(jsonLogic: unknown, enableUnwrapping: boolean): unknown {
    if (
      jsonLogic == null ||
      typeof jsonLogic === 'string' ||
      typeof jsonLogic === 'number' ||
      typeof jsonLogic === 'boolean'
    ) {
      return jsonLogic;
    }
    if (Array.isArray(jsonLogic)) {
      return jsonLogic.map((value) => traverse(value, enableUnwrapping));
    }
    if (typeof jsonLogic === 'object') {
      if (enableUnwrapping) {
        if ('string_to_number' in jsonLogic) {
          const functionBody = jsonLogic['string_to_number'];
          if (functionBody != null && Array.isArray(functionBody) && functionBody.length === 1) {
            const functionArg = functionBody[0];
            if (
              functionArg != null &&
              typeof functionArg === 'object' &&
              'var' in functionBody[0]
            ) {
              const varName = functionArg['var'];
              if (varName != null) {
                return {
                  var: `${varName}${VIRTUAL_STRING_TO_NUMBER_SUFFIX}`,
                };
              }
            }
          }
        }
        if ('string_to_timestamp' in jsonLogic) {
          const functionBody = jsonLogic['string_to_timestamp'];
          if (functionBody != null && Array.isArray(functionBody) && functionBody.length === 1) {
            const functionArg = functionBody[0];
            if (
              functionArg != null &&
              typeof functionArg === 'object' &&
              'var' in functionBody[0]
            ) {
              const varName = functionArg['var'];
              if (varName != null) {
                return {
                  var: `${varName}${VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX}`,
                };
              }
            }
          }
        }
      }
      if (
        ['some', 'every', 'all', 'any', 'none', 'map', 'filter', 'reduce'].some(
          (key) => key in jsonLogic,
        )
      ) {
        return mapValues(jsonLogic, (value) => traverse(value, true));
      }
    }

    return mapValues(jsonLogic, (value) => traverse(value, enableUnwrapping));
  }
  return traverse(jsonLogic, false);
}

/**
 * Turns virtual fields into proper JSON logic
 */
export function reduceVirtualFields(jsonLogic: unknown): unknown {
  if (
    jsonLogic == null ||
    typeof jsonLogic === 'string' ||
    typeof jsonLogic === 'number' ||
    typeof jsonLogic === 'boolean'
  ) {
    return jsonLogic;
  }
  if (Array.isArray(jsonLogic)) {
    return jsonLogic.map(reduceVirtualFields);
  }
  if (typeof jsonLogic === 'object' && 'var' in jsonLogic && typeof jsonLogic.var === 'string') {
    if (isVirtualFieldVarName(jsonLogic.var)) {
      if (jsonLogic.var.endsWith(VIRTUAL_STRING_TO_NUMBER_SUFFIX)) {
        return {
          string_to_number: [
            {
              var: jsonLogic.var.slice(0, -VIRTUAL_STRING_TO_NUMBER_SUFFIX.length),
            },
          ],
        };
      }
      if (jsonLogic.var.endsWith(VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX)) {
        return {
          string_to_timestamp: [
            {
              var: jsonLogic.var.slice(0, -VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX.length),
            },
          ],
        };
      }
    }
  }
  return mapValues(jsonLogic, reduceVirtualFields);
}

export function isVirtualFieldVarName(varName: string): boolean {
  return (
    varName.endsWith(VIRTUAL_STRING_TO_NUMBER_SUFFIX) ||
    varName.endsWith(VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX)
  );
}

export function getVirtualFieldVarName(varName: string): string {
  if (varName.endsWith(VIRTUAL_STRING_TO_NUMBER_SUFFIX)) {
    return varName.slice(0, -VIRTUAL_STRING_TO_NUMBER_SUFFIX.length);
  }
  if (varName.endsWith(VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX)) {
    return varName.slice(0, -VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX.length);
  }
  return varName;
}

export function getVirtualFieldDescription(varName: string): string {
  if (varName.endsWith(VIRTUAL_STRING_TO_NUMBER_SUFFIX)) {
    return 'number';
  }
  if (varName.endsWith(VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX)) {
    return 'datetime';
  }
  return varName;
}

/**
 * Traverse the fields and add a duplicating fields for every nested text field
 */
export function addVirtualFieldsForNestedSubfields(fields: Fields): Fields {
  return mapValues(fields, (field) => {
    if (!('subfields' in field) || field.subfields == null) {
      return field;
    }
    return {
      ...field,
      subfields: addVirtualFieldsForNestedSubfields(addStringToNumberFields(field.subfields)),
    };
  });
}

/**
 * For every text field, add fields with the same properties but with the type `number` and `datetime` and the labels `(as a number)` and `(as a timestamp)`
 * @param fields
 * @returns
 */
export function addStringToNumberFields(fields: Fields): Fields {
  const result = {};
  for (const key of Object.keys(fields)) {
    const field = fields[key];
    result[key] = field;
    if (field.type === 'text' && STRING_TO_NUMBER_FIELDS.includes(key)) {
      result[`${key}${VIRTUAL_STRING_TO_NUMBER_SUFFIX}`] = {
        ...field,
        type: 'number',
        label: `${field.label} (as a number)`,
      };
    }
    if (field.type === 'text' && STRING_TO_TIMESTAMP_FIELDS.includes(key)) {
      result[`${key}${VIRTUAL_STRING_TO_TIMESTAMP_SUFFIX}`] = {
        ...field,
        type: 'datetime',
        label: `${field.label} (as a timestamp)`,
      };
    }
  }

  return result;
}
