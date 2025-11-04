import s from './index.module.less';
import Label from '@/components/library/Label';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { success } from '@/utils/asyncResource';
import * as Card from '@/components/ui/Card';

type TableItem = {
  csvColumnName: string;
  apiData: string;
  csvSampleData: string;
};

const columnHelper = new ColumnHelper<TableItem>();

const columns = columnHelper.list([
  columnHelper.derived<string>({
    id: 'csvColumnName',
    title: 'CSV column names',
    value: () => 'N/A',
  }),
  columnHelper.derived<string>({
    id: 'apiData',
    title: 'API data',
    value: () => 'N/A',
  }),
  columnHelper.derived<string>({
    id: 'csvSampleData',
    title: 'CSV sample data',
    value: () => 'N/A',
  }),
]);

export default function DataMappingStep() {
  return (
    <div className={s.root}>
      <Label
        label="Data mapping"
        description={
          'Match the columns in your CSV file to our API data fields. Auto-mapping suggestions will be provided where possible. Additional columns would be added as Tags.'
        }
        required
      >
        <Card.Root className={s.tableWrapper}>
          <Card.Section>
            <Table<TableItem>
              toolsOptions={false}
              rowKey={'csvColumnName'}
              columns={columns}
              data={success({
                items: [],
              })}
              pagination={false}
            />
          </Card.Section>
        </Card.Root>
      </Label>
    </div>
  );
}
