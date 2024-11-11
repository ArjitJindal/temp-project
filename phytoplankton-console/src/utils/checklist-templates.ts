import { QueryResult } from './queries/types';
import { ChecklistDoneStatus, ChecklistStatus, ChecklistItem as EmptyChecklistItem } from '@/apis';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_CHECKLIST } from '@/utils/queries/keys';

export const useAlertChecklist = (alertId: string | undefined): QueryResult<HydratedChecklist> => {
  const api = useApi();
  return useQuery(ALERT_CHECKLIST(alertId), async () => {
    if (alertId == null) {
      throw new Error(`Unable to get checklist because alertId is null`);
    }
    const alert = await api.getAlert({ alertId });
    const ruleInstances = await api.getRuleInstances({});
    const ruleInstance = ruleInstances.find((ri) => ri.id === alert.ruleInstanceId);

    if (!ruleInstance || !ruleInstance.checklistTemplateId) {
      throw new Error('Could not resolve alert rule instance');
    }
    const template = await api.getChecklistTemplate({
      checklistTemplateId: ruleInstance.checklistTemplateId,
    });

    return template?.categories?.map((category): ChecklistCategory => {
      return {
        name: category.name,
        items: category.checklistItems.map((cli): ChecklistItem => {
          const item = alert.ruleChecklist?.find((item) => item.checklistItemId === cli.id);
          if (!item) {
            throw new Error('Bad checklist item');
          }
          return {
            id: cli.id,
            name: cli.name,
            level: cli.level,
            qaStatus: item.status,
            done: item.done ?? 'NOT_STARTED',
          };
        }),
      };
    });
  });
};

export type ChecklistItem = EmptyChecklistItem & {
  qaStatus?: ChecklistStatus;
  done: ChecklistDoneStatus;
};

type ChecklistCategory = {
  name: string;
  items: ChecklistItem[];
};

export type HydratedChecklist = ChecklistCategory[];
