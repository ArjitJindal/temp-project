import React, { useCallback } from 'react';
import pluralize from 'pluralize';
import Button from '@/components/library/Button';

interface Props {
  isBottom: boolean;
  unreadResponses: number;
  onScroll: (direction: 'BOTTOM' | 'TOP', smooth: boolean) => void;
}

export default function ScrollButton(props: Props) {
  const { isBottom, unreadResponses, onScroll } = props;

  let scrollButtonTitle;
  if (unreadResponses > 0) {
    scrollButtonTitle = `${unreadResponses} unread ${pluralize('response', unreadResponses)}`;
  } else if (isBottom) {
    scrollButtonTitle = `Back to top`;
  } else {
    scrollButtonTitle = `Go to bottom`;
  }

  const handleScrollButton = useCallback(() => {
    const direction = unreadResponses > 0 || !isBottom ? 'BOTTOM' : 'TOP';
    onScroll(direction, true);
  }, [onScroll, unreadResponses, isBottom]);

  return (
    <Button type="TEXT" onClick={handleScrollButton} size="SMALL">
      {scrollButtonTitle}
    </Button>
  );
}
