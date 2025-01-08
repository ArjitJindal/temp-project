import React from 'react';
import s from './index.module.less';

interface TagsContainerProps {
  children: React.ReactNode;
}

const TagsContainer: React.FC<TagsContainerProps> = ({ children }) => {
  return <div className={s.tagsContainer}>{children}</div>;
};

export default TagsContainer;
