import React from 'react';

export interface StoryProps {}

export interface CategoryComponent {
  key: string;
  story: React.FunctionComponent<StoryProps>;
  alternativeNames?: string[];
  designLink?: string;
}

export interface Category {
  key: string;
  title: string;
  components: CategoryComponent[];
}

export type Config = Category[];
