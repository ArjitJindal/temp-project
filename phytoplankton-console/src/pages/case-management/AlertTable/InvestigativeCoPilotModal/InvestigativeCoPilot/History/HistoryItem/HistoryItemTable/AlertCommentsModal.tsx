import React, { useState, useMemo } from 'react';
import Modal from '@/components/library/Modal';
import Id from '@/components/ui/Id';
import CommentsCard, { CommentGroup } from '@/components/CommentsCard';
import { useAlertComments } from '@/utils/api/alerts';
import { success, getOr } from '@/utils/asyncResource';

interface AlertCommentsModalProps {
  id: string;
}

export default function AlertCommentsModal(props: AlertCommentsModalProps) {
  const { id } = props;
  const [isOpen, setIsOpen] = useState(false);
  const alertCommentsRes = useAlertComments([id]);

  const commentsQuery = useMemo(() => {
    const commentsData = getOr(alertCommentsRes.data, undefined);
    const matchingItem = commentsData?.items?.find((item) => item.entityId === id);
    const comments: CommentGroup[] = [
      {
        id: id,
        title: 'Alert Comments',
        comments: matchingItem?.comments ?? [],
      },
    ];

    return success(comments);
  }, [alertCommentsRes.data, id]);

  return (
    <>
      <Id onClick={() => setIsOpen(true)}>View</Id>
      <Modal
        isOpen={isOpen}
        onCancel={() => setIsOpen(false)}
        title="Alert Comments"
        width="L"
        hideFooter
      >
        <CommentsCard commentsQuery={commentsQuery} writeResources={[]} hideHeader />
      </Modal>
    </>
  );
}
