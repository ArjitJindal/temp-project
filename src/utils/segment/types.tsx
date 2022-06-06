export type Event =
  | {
      title: 'Table Loaded';
      time: number;
    }
  | {
      title: 'Button Clicked';
      name: string;
    };

export interface Analytics {
  identify(userId: string): void;
  group(groupId: string): void;
  page(properties: { url: string }): void;
  event(event: Event): void;
}
