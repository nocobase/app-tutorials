export const PLUGIN_NAME: string = '@nocobase/app-plugin-tutorial-activity-log';
export const ACTIVITY_PAGE: string = 'activity-log';
export interface ActivityRecord {
  readonly id: string;
  readonly actorId: string;
  readonly action: string;
  readonly subject: string;
  readonly summary: string;
  readonly occurredAt: string;
}
export interface ActivityInput {
  readonly actorId: string;
  readonly action: string;
  readonly subject: string;
  readonly summary: string;
}
export interface ActivityPage {
  readonly data: ActivityRecord[];
  readonly meta: {
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
  };
}
