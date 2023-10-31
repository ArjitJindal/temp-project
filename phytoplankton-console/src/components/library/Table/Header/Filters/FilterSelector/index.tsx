import React from 'react';
import { BaseFilter } from '../../../types';
import style from './style.module.less';
import QuickFilter from '@/components/library/QuickFilter';
import Label from '@/components/library/Label';
import Checkbox from '@/components/library/Checkbox';
import Button from '@/components/library/Button';
import AddFillIcon from '@/components/ui/icons/Remix/system/add-fill.react.svg';

interface Props {
  filters: BaseFilter[];
  defaultActiveFilters: string[];
  shownFilters: string[];
  onToggleFilter: (key: string, enabled: boolean) => void;
}

export default function FilterSelector(props: Props) {
  const { filters, defaultActiveFilters, shownFilters, onToggleFilter } = props;
  return (
    <QuickFilter title="Add filter" icon={<AddFillIcon />}>
      <div className={style.root}>
        <div className={style.checkboxes}>
          {filters.map((filter) => (
            <Label key={filter.key} level={2} position="RIGHT" label={filter.title}>
              <Checkbox
                testName={filter.key}
                value={shownFilters.includes(filter.key)}
                onChange={(checked) => {
                  onToggleFilter(filter.key, checked ?? false);
                }}
              />
            </Label>
          ))}
        </div>
        <div className={style.buttons}>
          <Button
            type="TETRIARY"
            size="SMALL"
            onClick={() => {
              // Show fitlers which should be shown by default
              defaultActiveFilters
                .filter((x) => !shownFilters.includes(x))
                .forEach((key) => {
                  onToggleFilter(key, true);
                });
              // Hide filters which should be hidden by default
              shownFilters
                .filter((x) => !defaultActiveFilters.includes(x))
                .forEach((key) => {
                  onToggleFilter(key, false);
                });
            }}
          >
            Reset
          </Button>
        </div>
      </div>
    </QuickFilter>
  );
}
