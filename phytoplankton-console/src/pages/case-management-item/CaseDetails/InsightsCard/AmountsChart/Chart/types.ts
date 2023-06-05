export interface Colors {
  maximum: string;
  minimum: string;
  average: string;
  median: string;
}

export interface DataItem {
  title: string;
  maximum?: number;
  minimum?: number;
  average?: number;
  median?: number;
}

export type Data = DataItem[];
