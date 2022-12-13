import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import _ from 'lodash';
import s from './style.module.less';
import { RiskLevel } from '@/apis';
import { RISK_LEVELS, RISK_LEVEL_LABELS, RISK_LEVEL_COLORS } from '@/utils/risk-levels';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import COLORS from '@/components/ui/colors';

interface Props {
  value: RiskLevel[];
  onConfirm: (riskLevel: RiskLevel[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;

  return (
    <div className={s.root}>
      <div id="scrollableDiv" className={s.scrollable}>
        <List
          dataSource={RISK_LEVELS}
          loading={false}
          rowKey={(item) => item}
          renderItem={(item: RiskLevel) => (
            <List.Item
              className={cn(s.item, value.includes(item) && s.isActive)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onConfirm(
                  !value.includes(item) ? [...value, item] : value.filter((x) => x !== item),
                );
              }}
            >
              <div className={s.itemContainer}>
                <div className={s.riskContainer}>
                  <div
                    className={s.riskColor}
                    style={{ backgroundColor: RISK_LEVEL_COLORS[item].primary }}
                  />
                  <div className={s.riskLabel}>
                    <div>{RISK_LEVEL_LABELS[item]}</div>
                  </div>
                </div>
                <div className={s.checkContainer}>
                  <div style={{ width: '100%', height: '100%' }}>
                    {value.includes(item) && (
                      <CheckLineIcon
                        style={{ width: '1rem', height: '1rem', color: COLORS.brandBlue.base }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
