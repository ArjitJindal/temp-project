import {
  DerivedColumn,
  DisplayColumn,
  FieldAccessor,
  GroupColumn,
  SimpleColumn,
  TableColumn,
} from '@/components/library/Table/types';
import { denseArray, SparseArray } from '@/utils/lang';

export class ColumnHelper<Item extends object> {
  list(
    columns: SparseArray<
      | SimpleColumn<Item, FieldAccessor<Item>>
      | DisplayColumn<Item>
      | DerivedColumn<Item, any>
      | GroupColumn<Item>
    >,
  ): TableColumn<Item>[] {
    return denseArray(columns);
  }
  derived<Value = unknown>(def: DerivedColumn<Item, Value>): DerivedColumn<Item, Value> {
    return def;
  }
  simple<Accessor extends FieldAccessor<Item>>(
    params: SimpleColumn<Item, Accessor>,
  ): SimpleColumn<Item, Accessor> {
    return params;
  }
  group(params: GroupColumn<Item>): GroupColumn<Item> {
    return params;
  }
  display(params: DisplayColumn<Item>): DisplayColumn<Item> {
    return params;
  }
}
