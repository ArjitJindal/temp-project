import { useState } from 'react';
import _ from 'lodash';
import s from './style.module.less';
import { SarConfigurationForm } from './SarConfigurationForm';
import Button from '@/components/library/Button';
import Drawer from '@/components/library/Drawer';
import StepButtons from '@/components/library/StepButtons';
import { YEAR_MONTH_DATE_FORMAT, dayjs } from '@/utils/dayjs';

const DEMO_OUTPUT_XML = `<?xml version="1.0" ?><report>
<rentity_id>EIF0590</rentity_id>
<rentity_branch>20</rentity_branch>
<submission_code>E</submission_code>
<report_code>CTR</report_code>
<entity_reference>Bagr�cola</entity_reference>
<fiu_ref_number>None</fiu_ref_number>
<submission_date>2020-02-10T00:00:00</submission_date>
<currency_code_local>PESO                </currency_code_local>
<reporting_person>
    <gender>M</gender>
    <title>Oficial de Cumplimiento</title>
    <first_name>JUAN RAMON</first_name>
    <last_name>SANCHEZ</last_name>
    <birthdate>1972-10-03T00:00:00</birthdate>
    <id_number>034-0007808-9       </id_number>
    <nationality1>DOMINICANA</nationality1>
    <phones>
        <phone>
            <tph_contact_type>fffasf</tph_contact_type>
            <tph_communication_type>asdasdasd</tph_communication_type>
            <tph_country_prefix>None</tph_country_prefix>
            <tph_number>sfasf</tph_number>
            <tph_extension>None</tph_extension>
        </phone>
    </phones>
    <addresses>
        <address>
            <address_type>asdasdasd</address_type>
            <address>fffasf</address>
            <town>Santo domingo</town>
            <city></city>
            <zip>None</zip>
            <country_code>fffasf</country_code>
        </address>
    </addresses>
    <email>N.abreu@bagricola.gob.do</email>
    <occupation>SILVICULTURA Y EXTRACCION DE MADERA</occupation>
</reporting_person>
<location>
    <address_type>4</address_type>
    <address>Calle Ave. George Washington No. 601</address>
    <city></city>
    <country_code>DO</country_code>
</location>
<reason>Sobrepaso el monto de los 15,000.00</reason>
<action>None</action>
<transaction>
    <transactionnumber>TRNWEB0477  10 FEB 20</transactionnumber>
    <internal_ref_number>None</internal_ref_number>
    <transaction_location>20</transaction_location>
    <transaction_description>RECIBO DE INGRESO                                 </transaction_description>
    <date_transaction>2019-09-02 00:00:00</date_transaction>
    <transmode_code>RECIBO DE INGRESO                                 </transmode_code>
    <transmode_comment></transmode_comment>
    <amount_local>831360</amount_local>
    <involved_parties>
        <party>
            <role>B</role>
            <person_my_client>
                <first_name>JUAN RAMON</first_name>
                <middle_name>Maria</middle_name>
                <last_name>SANCHEZ</last_name>
                <birthdate>1970-03-03T00:00:00</birthdate>
                <ssn>n/a</ssn>
                <id_number>034-0007808-9       </id_number>
                <phones>
                    <phone>
                        <tph_contact_type>1</tph_contact_type>
                        <tph_communication_type>M</tph_communication_type>
                        <tph_number>829-000-0000</tph_number>
                    </phone>
                </phones>
                <addresses>
                    <address>
                        <address_type>1</address_type>
                        <address>Calle R�mulo Bentancourt No. 10</address>
                        <city></city>
                        <country_code>DO</country_code>
                    </address>
                </addresses>
                <email>prueba@prueba.com</email>
                <employer_address_id>
                    <address_type>2</address_type>
                    <address>Calle prueba no. 2</address>
                    <city></city>
                    <country_code>DO</country_code>
                </employer_address_id>
                <employer_phone_id>
                    <tph_contact_type>2</tph_contact_type>
                    <tph_communication_type>M</tph_communication_type>
                    <tph_number>829-000-0000</tph_number>
                </employer_phone_id>
                <identification>
                    <type>RNC</type>
                    <number>1-09-01103-5        </number>
                    <issue_date>2020-03-03T00:00:00</issue_date>
                    <expiry_date>2024-03-03T00:00:00</expiry_date>
                    <issue_country>DO</issue_country>
                </identification>
            </person_my_client>
            <funds_code>K</funds_code>
            <funds_comment>No tiene estado de cuenta</funds_comment>
            <country>DO</country>
            <significance>8</significance>
        </party>
    </involved_parties>
    <comments>Solo para pruebas</comments>
</transaction>
</report>
`;

function downloadFile(fileName: string) {
  const file = new Blob([DEMO_OUTPUT_XML]);
  const aElement = document.createElement('a');
  aElement.setAttribute('download', fileName);
  const href = URL.createObjectURL(file);
  aElement.href = href;
  aElement.setAttribute('target', '_blank');
  aElement.click();
  URL.revokeObjectURL(href);
}

export default function SarReportDrawer(props: {
  isVisible: boolean;
  transactionIds: string[];
  onChangeVisibility: (isVisible: boolean) => void;
}) {
  const [activeStepKey, setActiveStepKey] = useState('1');
  const [reportReady, setReportReady] = useState<boolean | undefined>();
  const activeStepIndex = Number(activeStepKey);
  return (
    <Drawer
      isVisible={props.isVisible}
      onChangeVisibility={props.onChangeVisibility}
      title={'Suspicious activity report filing'}
      footer={
        <div className={s.footer}>
          <StepButtons
            nextDisabled={activeStepIndex === 4}
            prevDisabled={activeStepIndex === 1}
            onNext={() => {
              setActiveStepKey(String(activeStepIndex + 1));
            }}
            onPrevious={() => {
              setActiveStepKey(String(activeStepIndex - 1));
            }}
          />
          <div className={s.footerButtons}>
            <Button
              type="PRIMARY"
              onClick={() => {
                if (reportReady) {
                  const reportName = `SAR-report-${dayjs().format(YEAR_MONTH_DATE_FORMAT)}.xml`;
                  downloadFile(reportName);
                } else {
                  setReportReady(false);
                  setTimeout(() => {
                    setReportReady(true);
                  }, 5000);
                }
              }}
            >
              {reportReady === true
                ? 'Download report'
                : reportReady === false
                ? 'Generating...'
                : 'Generate report'}
            </Button>
          </div>
        </div>
      }
    >
      <SarConfigurationForm
        activeStepKey={activeStepKey}
        onSubmit={() => {}}
        onActiveStepKeyChange={setActiveStepKey}
        transactionIds={props.transactionIds}
      />
    </Drawer>
  );
}
