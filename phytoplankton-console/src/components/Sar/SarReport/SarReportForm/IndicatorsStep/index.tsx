import { useCallback, useMemo, useState } from 'react';
import { Report, ReportSchemaIndicators } from '@/apis';
import TextInput from '@/components/library/TextInput';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import * as Card from '@/components/ui/Card';

const columnHelper = new ColumnHelper<ReportSchemaIndicators>();

interface Props {
  report: Report;
  value?: string[] | undefined;
  onChange?: (value: string[] | undefined) => void;
}

export default function IndicatorsStep(props: Props) {
  const { report, value = [], onChange } = props;

  const [search, setSearch] = useState<string>();

  const handeSelect = useCallback(
    (ids) => {
      onChange?.(ids);
    },
    [onChange],
  );
  const filteredIndicators = useMemo(() => {
    const result: ReportSchemaIndicators[] = report?.schema?.indicators ?? [];
    if (search == null || search === '') {
      return result;
    }
    return result.filter(
      ({ key, description }) =>
        key.toLowerCase().includes(search.toLowerCase()) ||
        description.toLowerCase().includes(search.toLowerCase()),
    );
  }, [report?.schema?.indicators, search]);
  return (
    <Card.Root>
      <Card.Section>
        <TextInput
          value={search}
          onChange={setSearch}
          placeholder="Search for indicator code, description"
        />
        <div>
          <Table<ReportSchemaIndicators>
            rowKey="key"
            data={{ items: filteredIndicators }}
            selection={true}
            selectedIds={value ?? []}
            onSelect={handeSelect}
            toolsOptions={false}
            columns={[
              columnHelper.simple({
                key: 'key',
                title: 'Code',
              }),
              columnHelper.simple({
                key: 'description',
                title: 'Indicator',
                defaultWidth: 400,
              }),
            ]}
            fitHeight={800}
          />
        </div>
      </Card.Section>
    </Card.Root>
  );
}
