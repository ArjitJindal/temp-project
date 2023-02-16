import { useIsFetching } from '@tanstack/react-query';
import _ from 'lodash';
import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import COLORS from '../colors';
import Button from '@/components/library/Button';

interface Props {
  onClickAction: () => void;
}

const PrintButton = ({ onClickAction }: Props) => {
  const isQueriesFetching = useIsFetching() > 0;
  const [print, setPrint] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isQueriesFetching && print) {
      _.delay(() => {
        window.print();
        setPrint(false);
        setLoading(false);
      }, 500); // there still is a delay for waiting to populate all tabs
    }
  }, [isQueriesFetching, print]);

  return (
    <Button
      type={'TEXT'}
      onClick={() => {
        setLoading(true);
        onClickAction();
        _.delay(() => {
          setPrint(true);
          setLoading(false);
        }, 500);
      }}
      style={{
        width: 'max-content',
        margin: '1rem 1.5rem',
        color: COLORS.purpleGray.base,
        borderColor: COLORS.purpleGray.base,
        display: 'relative',
      }}
      isLoading={loading}
    >
      Print
      {loading && (
        <Spin
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          size="small"
        />
      )}
    </Button>
  );
};

export default PrintButton;
