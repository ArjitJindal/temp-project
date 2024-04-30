import { ChecklistChart } from './ChecklistChart';
import { useQuery } from '@/utils/queries/hooks';
import { CHECKLIST_TEMPLATES } from '@/utils/queries/keys';
import { useApi } from '@/api';
import { WidgetProps } from '@/components/library/Widget/types';
import { ChecklistTemplatesResponse } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import WidgetBase from '@/components/library/Widget/WidgetBase';

interface Props extends WidgetProps {}

const QaAlertStatsByChecklistReason = (props: Props) => {
  const api = useApi();

  const queryResult = useQuery<ChecklistTemplatesResponse>(CHECKLIST_TEMPLATES(), async () =>
    api.getChecklistTemplates(),
  );

  return (
    <WidgetBase width="FULL" id={`${props.id}-full-widget`}>
      <AsyncResourceRenderer resource={queryResult.data}>
        {({ data }) => {
          return <ChecklistChart {...props} data={data} />;
        }}
      </AsyncResourceRenderer>
    </WidgetBase>
  );
};

export default QaAlertStatsByChecklistReason;
