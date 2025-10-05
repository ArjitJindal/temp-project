import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_CHECKLIST, CHECKLIST_TEMPLATES } from '@/utils/queries/keys';
import { ChecklistDoneStatus, ChecklistStatus } from '@/apis';

export type ChecklistItem = {
  id?: string;
  name?: string;
  level?: string;
  qaStatus?: ChecklistStatus;
  done: ChecklistDoneStatus;
  comment?: string;
};

type ChecklistCategory = {
  name: string;
  items: ChecklistItem[];
};

export type HydratedChecklist = ChecklistCategory[];

export const useAlertChecklist = (alertId: string | undefined) => {
  const api = useApi();
  return useQuery<HydratedChecklist>(ALERT_CHECKLIST(alertId), async () => {
    if (alertId == null) {
      throw new Error(`Unable to get checklist because alertId is null`);
    }
    const alert = await api.getAlert({ alertId });
    const ruleInstances = await api.getRuleInstances({});
    const ruleInstance = ruleInstances.find((ri) => ri.id === alert.ruleInstanceId);

    if (!ruleInstance) {
      throw new Error('Could not resolve alert rule instance');
    }
    if (!ruleInstance.checklistTemplateId) {
      throw new Error('Rule instance doesnt have checklist assigned');
    }
    const template = await api.getChecklistTemplate({
      checklistTemplateId: ruleInstance.checklistTemplateId,
    });

    return (
      template?.categories?.map((category): ChecklistCategory => {
        return {
          name: category.name,
          items: category.checklistItems.map((cli): ChecklistItem => {
            const item = alert.ruleChecklist?.find((item) => item.checklistItemId === cli.id);
            if (!item) {
              throw new Error(
                'Alert is missing checklist status information, please contact support',
              );
            }
            return {
              id: cli.id,
              name: cli.name,
              level: cli.level,
              qaStatus: item.status,
              done: item.done ?? 'NOT_STARTED',
              comment: item.comment,
            };
          }),
        };
      }) ?? []
    );
  });
};

export function useChecklistTemplates(params?: { filterName?: string }) {
  const api = useApi();
  return useQuery(CHECKLIST_TEMPLATES(params), async () =>
    api.getChecklistTemplates(params as any),
  );
}
