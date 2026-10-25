import type { ReactNode, ReactElement } from 'react';
import { ActivityLogPreferencesContext as PreferencesContext } from './use-preferences.js';
export function ActivityLogPreferencesProvider({
  children,
  pageSize,
}: {
  readonly children?: ReactNode;
  readonly pageSize: number;
}): ReactElement {
  return (
    <PreferencesContext value={{ pageSize }}>{children}</PreferencesContext>
  );
}
