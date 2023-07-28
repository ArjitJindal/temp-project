/*
  Removes unnecessary oneOf, e. g.

  ```
  ActivityNarrativeInformation: {
    oneOf: [
      {
        $ref: '#/definitions/ActivityNarrativeInformationType',
      },
      {
        items: {
          $ref: '#/definitions/ActivityNarrativeInformationType',
        },
        maxItems: 5,
        type: 'array',
      },
    ],
  }
  ```

  becomes

  ```
  ActivityNarrativeInformation: {
    items: {
      $ref: '#/definitions/ActivityNarrativeInformationType',
    },
    maxItems: 5,
    type: 'array',
  }
  ```
 */
import { JSONSchema4 } from 'json-schema'

export function removeUnnecessaryOneOf(localObj: JSONSchema4) {
  if (localObj.oneOf == null || localObj.oneOf.length !== 2) {
    return localObj
  }

  const [type1, type2] = localObj.oneOf
  if (type2.items == null || Array.isArray(type2.items)) {
    return localObj
  }

  if (
    type2.type === 'array' &&
    type1.$ref != null &&
    type1.$ref === type2.items?.$ref
  ) {
    return localObj['oneOf'][1]
  }

  return localObj
}
