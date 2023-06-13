import { useState, useEffect } from 'react';
import Drawer from '@/components/library/Drawer';
import { Report } from '@/apis';
import { JsonSchemaForm } from '@/components/JsonSchemaForm';
import { useApi } from '@/api';

export default function SarReportDrawer(props: {
  caseId: string;
  schemaId: string;
  transactionIds: string[];
  isVisible: boolean;
  onChangeVisibility: (isVisible: boolean) => void;
}) {
  const api = useApi();
  const { caseId, schemaId, transactionIds } = props;
  const [reportTemplate, setReportTemplate] = useState<Report>();

  useEffect(() => {
    api
      .getReportsTemplate({
        caseId,
        schemaId,
        transactionIds,
      })
      .then(setReportTemplate);
  }, [api, caseId, schemaId, transactionIds]);

  return (
    <Drawer
      isVisible={props.isVisible}
      onChangeVisibility={props.onChangeVisibility}
      title={'Report Generator'}
    >
      {reportTemplate && reportTemplate.schema && (
        <JsonSchemaForm
          schema={reportTemplate.schema.schema}
          formData={reportTemplate?.parameters}
          liveValidate={false}
          onChange={() => console.log('onChange')}
        />
      )}
    </Drawer>
  );
}
