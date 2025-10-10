import React, { useMemo, useRef, useState } from 'react';
import FieldsPicker, { FieldPickerValue, getInitialKeys } from './FieldsPicker';
import { buildDataStructure, generateTableExportData } from './helpers';
import s from './index.module.less';
import Alert from '@/components/library/Alert';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import Modal from '@/components/library/Modal';
import { iterateItems } from '@/components/library/Table/Header/Tools/DownloadButton/helpers';
import { PaginatedParams, TableColumn, TableData } from '@/components/library/Table/types';
import RadioGroup from '@/components/ui/RadioGroup';
import { downloadAsCSV } from '@/utils/csv';
import { ExportData, MAXIMUM_EXPORT_ITEMS } from '@/utils/data-export';
import { getErrorMessage, iterateChunks } from '@/utils/lang';
import { PaginationParams } from '@/utils/queries/hooks';
import { downloadAsXLSX } from '@/utils/xlsx';
import Checkbox from '@/components/library/Checkbox';
import { DEFAULT_EXPORT_PAGE_SIZE } from '@/components/library/Table/consts';

type FormValues = {
  exportType: 'CURRENT' | 'ALL';
  exportFormat: 'CSV' | 'XSLX';
  exportFields: FieldPickerValue;
  includeEmptyColumns: boolean;
};

interface Props<T extends object, Params extends object> {
  onPaginateData: (params: PaginationParams) => Promise<TableData<T>>;
  params: PaginatedParams<Params>;
  isOpen: boolean;
  onClose: () => void;
  columns: TableColumn<T>[];
}

export default function AdvancedExportModal<T extends object, Params extends object>(
  props: Props<T, Params>,
) {
  const { isOpen, onClose, columns } = props;

  const formRef = useRef<FormRef<FormValues>>(null);

  const dataStructure = useMemo(() => buildDataStructure(columns), [columns]);
  const initialValues: FormValues = useMemo(
    () => ({
      exportType: 'CURRENT',
      exportFormat: 'CSV',
      exportFields: getInitialKeys(dataStructure),
      includeEmptyColumns: false,
    }),
    [dataStructure],
  );

  const isCancelledRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<{ page: number; totalPages?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (values: FormValues) => {
    isCancelledRef.current = false;
    setIsBusy(true);
    setError(null);
    let error;
    try {
      const itemsGenerator = iterateItems({
        pagesMode: values.exportType === 'ALL' ? 'ALL' : 'CURRENT',
        onPaginateData: props.onPaginateData,
        params: props.params,
        setProgress: (progress) => {
          setProgress(progress);
        },
      });

      let exportData: ExportData = {
        headers: [],
        rows: [],
      };
      try {
        for await (const chunk of iterateChunks(itemsGenerator, DEFAULT_EXPORT_PAGE_SIZE)) {
          if (isCancelledRef.current) {
            return;
          }
          const batchExportData: ExportData = generateTableExportData(
            chunk,
            columns,
            values.exportFields,
            props.params,
          );
          exportData.headers = batchExportData.headers;
          exportData.rows.push(...batchExportData.rows);
          if (exportData.rows.length >= MAXIMUM_EXPORT_ITEMS) {
            throw new Error(
              `The limit of ${new Intl.NumberFormat().format(MAXIMUM_EXPORT_ITEMS)} was reached`,
            );
          }
        }
      } catch (e) {
        error = `Unable to export all of the data. ${getErrorMessage(e)}.`;
      }

      if (!values.includeEmptyColumns) {
        const emptyColumns: number[] = [];
        for (let i = 0; i < exportData.headers.length; i++) {
          const isEmpty = exportData.rows.every((row) => {
            return row[i].value == null || row[i].value === '-' || row[i].value === '';
          });
          if (isEmpty) {
            emptyColumns.push(i);
          }
        }
        exportData = {
          headers: exportData.headers.filter((_, i) => !emptyColumns.includes(i)),
          rows: exportData.rows.map((row) => {
            return row.filter((_, i) => !emptyColumns.includes(i));
          }),
        };
      }

      if (isCancelledRef.current) {
        return;
      }

      if (values.exportFormat === 'CSV') {
        await downloadAsCSV(exportData);
      } else if (values.exportFormat === 'XSLX') {
        await downloadAsXLSX(exportData);
      }
      if (error) {
        setError(error);
      } else {
        onClose();
      }
    } catch (error) {
      console.error(error);
      setError(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal
      title="Export data"
      isOpen={isOpen}
      onCancel={() => {
        isCancelledRef.current = true;
        onClose();
      }}
      onOk={() => {
        formRef.current?.submit();
      }}
      okText="Export"
      okProps={{
        isLoading: isBusy,
      }}
      height={'FULL'}
      width={'L'}
      footerExtra={
        <div>
          {progress != null &&
            `Downloading (${progress.page}${
              progress.totalPages ? `/${progress.totalPages}` : ''
            })...`}
        </div>
      }
    >
      <Form<FormValues>
        ref={formRef}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        className={s.root}
      >
        {({ valuesState: [values] }) => (
          <div className={s.content}>
            <div className={s.settingsRow}>
              <InputField<FormValues, 'exportType'> name="exportType" label="Export data from">
                {({ value, onChange }) => (
                  <RadioGroup
                    value={value}
                    orientation="HORIZONTAL"
                    onChange={onChange}
                    options={[
                      { label: 'Current page', value: 'CURRENT', name: 'exportType' },
                      { label: 'All pages', value: 'ALL', name: 'exportType' },
                    ]}
                  />
                )}
              </InputField>
              <InputField<FormValues, 'exportFormat'> name="exportFormat" label="Export format">
                {({ value, onChange }) => (
                  <RadioGroup
                    value={value}
                    orientation="HORIZONTAL"
                    onChange={onChange}
                    options={[
                      { label: 'CSV', value: 'CSV', name: 'exportFormat' },
                      { label: 'XSLX', value: 'XSLX', name: 'exportFormat' },
                    ]}
                  />
                )}
              </InputField>
            </div>
            <InputField<FormValues, 'exportFields'> name="exportFields" label="Export details">
              {({ value, onChange }) => (
                <FieldsPicker dataStructure={dataStructure} value={value} onChange={onChange} />
              )}
            </InputField>
            <div className={s.settingsRow}>
              <InputField<FormValues, 'includeEmptyColumns'>
                name="includeEmptyColumns"
                label="Include empty columns"
                labelProps={{ position: 'RIGHT' }}
              >
                {({ value, onChange }) => <Checkbox value={value} onChange={onChange} />}
              </InputField>
            </div>
            <Alert type="INFO">
              {`All the selected details will be exported as separate columns.`}
              {values.exportType === 'ALL' &&
                ` "All pages" option downloads up to ${new Intl.NumberFormat().format(
                  MAXIMUM_EXPORT_ITEMS,
                )} rows, browser capacity may also impact the download.`}
            </Alert>
            {error && <Alert type="ERROR">{error}</Alert>}
          </div>
        )}
      </Form>
    </Modal>
  );
}
