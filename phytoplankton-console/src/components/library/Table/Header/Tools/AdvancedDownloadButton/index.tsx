import { useState } from 'react';
import { PaginatedParams, TableColumn, TableData } from '../../../types';
import AdvancedExportModal from './AdvancedExportModal';
import s from './styles.module.less';
import { PaginationParams } from '@/utils/queries/hooks';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';

type Props<Item extends object, Params extends object> = {
  onPaginateData: (params: PaginationParams) => Promise<TableData<Item>>;
  columns: TableColumn<Item>[];
  params: PaginatedParams<Params>;
  cursorPagination?: boolean;
  totalPages?: number;
};

export default function AdvancedDownloadButton<T extends object, Params extends object>(
  props: Props<T, Params>,
) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <DownloadLineIcon className={s.icon} onClick={() => setIsModalOpen(true)} />
      <AdvancedExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        columns={props.columns}
        onPaginateData={props.onPaginateData}
        params={props.params}
      />
    </>
  );
}
