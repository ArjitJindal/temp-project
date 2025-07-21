import React, { useEffect, useMemo } from 'react';
import cn from 'clsx';
import { Operators, ImmutableTree } from '@react-awesome-query-builder/core';
import { BuilderProps } from '@react-awesome-query-builder/ui';
import { noop } from 'lodash';
import s from './index.module.less';
import { LogicBuilderValue, QueryBuilderConfig } from './types';
import { makeAsyncComponent } from '@/utils/imports';

export interface Props {
  hideConjunctions?: boolean;
  operators?: Operators;
  config: QueryBuilderConfig;
  value?: LogicBuilderValue; // For pre-processed trees (editable components)
  jsonLogic?: Record<string, unknown>; // For raw JSON logic (read-only components)
  onChange?: (newValue: LogicBuilderValue, config: QueryBuilderConfig) => void;
}

const AsyncLogicBuilder = makeAsyncComponent<Props>(async () => {
  const [module] = await Promise.all([
    import('@react-awesome-query-builder/ui'),
    import('@react-awesome-query-builder/ui/css/styles.css'),
  ]);

  const { Builder, Query, Utils: QbUtils } = module;

  const renderBuilder = (props: BuilderProps) => (
    <div className="query-builder">
      <Builder {...props} />
    </div>
  );

  return {
    default: function LogicBuilderInner({
      value,
      jsonLogic,
      onChange,
      config,
      hideConjunctions = false,
    }: Props) {
      useEffect(() => {
        const handleKeyPress = (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
          }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => {
          window.removeEventListener('keydown', handleKeyPress);
        };
      }, []);

      const EMPTY_VALUE = useMemo(() => {
        const guid1 = QbUtils.uuid();
        const guid2 = QbUtils.uuid();
        return QbUtils.jsToImmutable({
          type: 'group',
          id: guid1,
          children1: {
            [guid2]: {
              type: 'rule',
              id: guid2,
              properties: {
                fieldSrc: 'field',
              },
              path: [guid1, guid2],
            },
          },
          properties: {
            conjunction: 'AND',
            not: false,
          },
          path: [guid1],
        }) as ImmutableTree;
      }, []);

      const mode = config.settings.mode ?? 'EDIT';

      let finalValue: ImmutableTree;

      if (jsonLogic) {
        const [propsTree, errors] = QbUtils._loadFromJsonLogic(jsonLogic, config);
        if (errors.length > 0) {
          console.error('Error loading JSON logic:', errors);
          finalValue = EMPTY_VALUE;
        } else {
          finalValue = propsTree ? QbUtils.checkTree(propsTree, config) : EMPTY_VALUE;
        }
      } else {
        finalValue = value ?? EMPTY_VALUE;
      }

      return (
        <div className={cn(s.root, hideConjunctions && s.hideConjunctions, s[`mode-${mode}`])}>
          <Query
            {...config}
            value={finalValue}
            onChange={onChange ?? noop}
            renderBuilder={renderBuilder}
          />
        </div>
      );
    },
  };
});

export default AsyncLogicBuilder;
