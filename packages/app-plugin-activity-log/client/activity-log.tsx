import { useEffect, useState, type ReactElement } from 'react';
import { useService } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { PLUGIN_NAME, type ActivityPage } from '../shared/contracts.js';
import { activityLogClientToken } from './service.js';
import { useActivityLogPreferences } from './preferences.js';
import { Button } from './components/ui/button.js';
type State =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly result: ActivityPage };
export function ActivityLog(): ReactElement {
  const service = useService(activityLogClientToken);
  const { t } = useTranslation(PLUGIN_NAME);
  const { pageSize } = useActivityLogPreferences();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    service.list(page, pageSize).then(
      (result) => {
        if (current) setState({ status: 'ready', result });
      },
      () => {
        if (current) setState({ status: 'error' });
      },
    );
    return (): void => {
      current = false;
    };
  }, [service, page, pageSize, revision]);
  function changePage(next: number): void {
    setState({ status: 'loading' });
    setPage(next);
  }
  return (
    <section aria-label={t('title')} className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>{t('description')}</p>
        <Button
          onClick={() => {
            setState({ status: 'loading' });
            setRevision((value) => value + 1);
          }}
        >
          {t('refresh')}
        </Button>
      </div>
      {state.status === 'loading' ? <p role='status'>{t('loading')}</p> : null}
      {state.status === 'error' ? <p role='alert'>{t('failed')}</p> : null}
      {state.status === 'ready' ? (
        <>
          {state.result.data.length === 0 ? (
            <p>{t('empty')}</p>
          ) : (
            <ul className='divide-y rounded-lg border'>
              {state.result.data.map((record) => (
                <li key={record.id} className='space-y-1 p-4'>
                  <p className='font-medium'>{record.summary}</p>
                  <p className='text-sm text-muted-foreground'>
                    {record.action} · {record.subject}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    {t('actor')}: {record.actorId} ·{' '}
                    <time dateTime={record.occurredAt}>
                      {record.occurredAt}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className='flex items-center gap-3'>
            <Button
              variant='outline'
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
            >
              {t('previous')}
            </Button>
            <span>
              {t('page')} {page} · {t('total')} {state.result.meta.total}
            </span>
            <Button
              variant='outline'
              disabled={page * pageSize >= state.result.meta.total}
              onClick={() => changePage(page + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
