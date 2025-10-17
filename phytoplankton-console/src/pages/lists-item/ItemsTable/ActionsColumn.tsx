import { Resource } from '@flagright/lib/utils';
import s from './index.module.less';
import type { TableItem, NewTableItemData } from './index';
import Button from '@/components/library/Button';
import { ItemContext, PublicRowEditApi } from '@/components/library/Table/types';
import { ListHeaderInternal } from '@/apis';

interface ActionsColumnProps {
  entity: TableItem;
  context: ItemContext<TableItem>;
  requiredWriteResources: Resource[];
  listHeader: ListHeaderInternal | null;
  isEditSaveDisabled: (
    rowApi: PublicRowEditApi | undefined,
    entity: TableItem,
    columns: NonNullable<ListHeaderInternal['metadata']>['columns'] | undefined,
  ) => boolean;
}

function isNewDraft(value: unknown): value is NewTableItemData {
  if (typeof value !== 'object' || value == null) {
    return false;
  }
  const v: any = value;
  return Array.isArray(v.value) && typeof v.reason === 'string' && typeof v.meta === 'object';
}

function isNewItem(value: unknown): value is TableItem & { type: 'NEW' } {
  return typeof value === 'object' && value != null && (value as any).type === 'NEW';
}

/**
 * Validates if the draft is valid for submission.
 * For custom lists: validates all required meta fields have values.
 * For non-custom lists: validates that the value array is not empty.
 */
function isMetaValid(
  draft: NewTableItemData | TableItem,
  columns: NonNullable<ListHeaderInternal['metadata']>['columns'] | undefined,
): boolean {
  const hasColumns = (columns ?? []).length > 0;
  if (hasColumns && columns) {
    const metaValid = columns.every((c) => {
      const key = c.key || '';
      const meta = 'meta' in draft ? draft.meta : {};
      const val = (meta ?? {})[key];
      return val != null && String(val).trim() !== '';
    });
    if (!metaValid) {
      return false;
    }
  }

  if (!hasColumns) {
    const values = Array.isArray(draft.value) ? draft.value : [draft.value];
    const hasNonEmptyValue = values.some((v) => v != null && String(v).trim() !== '');
    if (!hasNonEmptyValue) {
      return false;
    }
  }

  return true;
}

/**
 * Renders the Actions column for list items table.
 * Handles three states: createRow (Add), editing (Save/Cancel), and view mode (Edit/Remove).
 */
export function renderActionsColumn(props: ActionsColumnProps): JSX.Element {
  const { entity, context, requiredWriteResources, listHeader, isEditSaveDisabled } = props;
  const rowApi = context.rowApi;

  // State 1: Create Row - Show "Add" button
  if (rowApi?.isCreateRow) {
    const maybe = rowApi.getDraft?.();
    const draft: NewTableItemData = isNewDraft(maybe)
      ? maybe
      : isNewItem(entity)
      ? { value: entity.value as string[], reason: entity.reason, meta: entity.meta }
      : { value: [], reason: '', meta: {} };

    const isValid = isMetaValid(draft, listHeader?.metadata?.columns);

    return (
      <div className={s.actions}>
        <Button
          type="PRIMARY"
          isLoading={rowApi?.isBusy}
          isDisabled={!isValid}
          onClick={() => rowApi?.save?.()}
          requiredResources={requiredWriteResources}
        >
          Add
        </Button>
      </div>
    );
  }

  // State 2: Edit Mode - Show "Save" and "Cancel" buttons
  if (rowApi?.isEditing) {
    return (
      <div className={s.actions}>
        <Button
          size="SMALL"
          type="PRIMARY"
          onClick={() => rowApi?.save?.()}
          isDisabled={isEditSaveDisabled(rowApi, entity, listHeader?.metadata?.columns)}
          isLoading={Boolean(rowApi?.isBusy)}
          requiredResources={requiredWriteResources}
        >
          Save
        </Button>
        <Button
          size="SMALL"
          type="SECONDARY"
          onClick={() => rowApi?.cancelEdit?.()}
          isLoading={Boolean(rowApi?.isBusy)}
          requiredResources={requiredWriteResources}
        >
          Cancel
        </Button>
      </div>
    );
  }

  // State 3: View Mode - Show "Edit" and "Remove" buttons
  return (
    <div className={s.actions}>
      <Button
        size="SMALL"
        type="SECONDARY"
        onClick={() => rowApi?.startEdit?.()}
        isLoading={Boolean(rowApi?.isBusy)}
        requiredResources={requiredWriteResources}
      >
        Edit
      </Button>
      <Button
        size="SMALL"
        type="SECONDARY"
        onClick={() => rowApi?.delete?.()}
        isLoading={Boolean(rowApi?.isBusy)}
        requiredResources={requiredWriteResources}
      >
        Remove
      </Button>
    </div>
  );
}
