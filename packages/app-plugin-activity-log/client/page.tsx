import type { ReactElement } from 'react';
import { useTranslation } from '@nocobase/i18n/client';
import { PLUGIN_NAME } from '../shared/contracts.js';
import { ActivityLog } from './activity-log.js';
import { PageContainer } from './components/page-container.js';
import { PageHeader } from './components/page-header.js';
export default function ActivityLogPage(): ReactElement {
  const { t } = useTranslation(PLUGIN_NAME);
  return (
    <PageContainer>
      <PageHeader title={t('title')} />
      <ActivityLog />
    </PageContainer>
  );
}
