import { InternalFieldsMeta } from '@/components/library/Form/types';

import { DiffPath } from '@/pages/risk-levels/risk-factors/RiskFactorConfiguration/diff';

export const CHANGED_FIELD_MESSAGE = 'This field has changes';

export function makeMetaFromChangedFields(
  changedPathList: DiffPath[] | undefined,
): InternalFieldsMeta {
  if (!changedPathList) {
    return {};
  }
  const result: InternalFieldsMeta = {};
  for (const path of changedPathList) {
    let currentMeta: InternalFieldsMeta = result;
    for (let i = 0; i < path.length; i++) {
      const pathElement = path[i];
      if (i === path.length - 1) {
        currentMeta[pathElement] = {
          highlight: CHANGED_FIELD_MESSAGE,
        };
      } else {
        if (currentMeta[pathElement] == null) {
          currentMeta[pathElement] = {
            highlight: CHANGED_FIELD_MESSAGE,
            children: {},
          };
        }
        currentMeta = currentMeta[pathElement].children as InternalFieldsMeta;
      }
    }
  }
  return result;
}
