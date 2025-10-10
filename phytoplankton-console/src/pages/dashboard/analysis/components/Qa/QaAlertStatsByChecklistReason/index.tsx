import { ChecklistChart } from './ChecklistChart';
import { useQuery } from '@/utils/queries/hooks';
import { CHECKLIST_TEMPLATES } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { WidgetProps } from '@/components/library/Widget/types';
import { ChecklistTemplatesResponse } from '@/apis';
import WidgetBase from '@/components/library/Widget/WidgetBase';
import { map } from '@/utils/asyncResource';

interface Props extends WidgetProps {}

const QaAlertStatsByChecklistReason = (props: Props) => {
  const api = useApi();

  const queryResult = useQuery<ChecklistTemplatesResponse>(CHECKLIST_TEMPLATES(), async () =>
    api.getChecklistTemplates(),
  );

  const dataRes = map(queryResult.data, ({ data }) => data);
  return (
    <WidgetBase width="FULL" id={`${props.id}-full-widget`}>
      <ChecklistChart {...props} data={dataRes} />
    </WidgetBase>
  );
};

export default QaAlertStatsByChecklistReason;
