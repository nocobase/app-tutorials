import { createContext, useContext, type Context } from 'react';
export interface ActivityLogPreferences {
  readonly pageSize: number;
}
export const ActivityLogPreferencesContext: Context<ActivityLogPreferences> =
  createContext<ActivityLogPreferences>({ pageSize: 20 });
export function useActivityLogPreferences(): ActivityLogPreferences {
  return useContext(ActivityLogPreferencesContext);
}
