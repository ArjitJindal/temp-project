import React, { useMemo } from 'react';
import { Report } from '@/apis';
import Table from '@/components/library/Table';
import { DATE, STRING } from '@/components/library/Table/standardDataTypes';
import { ColumnHelper } from '@/components/library/Table/columnHelper';

export default function VersionHistory({ report }: { report: Report }) {
  const helper = new ColumnHelper<{ version: string; output: string; createdAt: number }>();

  const columns = helper.list([
    helper.simple<'version'>({
      title: 'Version',
      key: 'version',
      type: STRING,
      sorting: true,
    }),
    helper.simple<'createdAt'>({
      title: 'Created at',
      key: 'createdAt',
      type: DATE,
    }),
    helper.display({
      title: 'Link',
      id: 'link',
      render: (revision) => {
        return (
          <a href={`data:text/xml,${revision.output}`} download={`${report.name}.xml`}>
            Download
          </a>
        );
      },
    }),
  ]);
  const revisions = useMemo(() => {
    return report.revisions
      .map((r, i) => ({
        version: `${i + 1}`,
        output: r.output,
        createdAt: r.createdAt,
      }))
      .reverse();
  }, [report]);

  return (
    <Table toolsOptions={false} rowKey={'version'} data={{ items: revisions }} columns={columns} />
  );
}
