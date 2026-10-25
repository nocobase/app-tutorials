import { useTasks, focusTaskSearch, useTaskOverlayFocus } from './context.js';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';
import { ApiClientError, useApiClient } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDrawer } from '#components/route-drawer';
import { LongText } from '#components/long-text';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Button } from '#components/ui/button';
import { Skeleton } from '#components/ui/skeleton';
import { TaskError, StatusBadge, DateText } from './shared.js';
import { TaskActions } from './task-actions.js';
import type { Task } from './types.js';
export default function TaskDetail() {
  useTaskOverlayFocus();
  const { taskId } = useParams();
  const api = useApiClient();
  const { t } = useTranslation();
  const parent = useTasks();
  const { reload } = parent;
  const navigate = useNavigate();
  const [task, setTask] = useState<Task>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const candidates = [
    parent.updates[taskId ?? ''],
    parent.tasks.find((item) => item.id === taskId),
  ].filter((item): item is Task => !!item);
  const cached = candidates.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0];
  const missing = parent.missingIds.includes(taskId ?? '');
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: Task }>({
        path: `tasks/${taskId}`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted) {
            setTask(data);
            setError(undefined);
          }
        },
        (next: unknown) => {
          if (!controller.signal.aborted) {
            setError(next);
            if (next instanceof ApiClientError && next.status === 404) reload();
          }
        },
      );
    return () => controller.abort();
  }, [api, taskId, revision, reload, parent.refreshVersion]);
  const current =
    cached && task && cached.updatedAt > task.updatedAt ? cached : task;
  return (
    <RouteDrawer
      title={current?.title ?? t('tasks.detail')}
      footer={
        <>
          {current && !error && !missing && (
            <TaskActions task={current} detail />
          )}
          <Button
            variant='outline'
            onClick={() => {
              void navigate(`/tasks${parent.search}`);
              focusTaskSearch();
            }}
          >
            {t('tasks.back')}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-6'>
        <TaskError
          error={error}
          title={current?.title}
          retry={() => setRevision((n) => n + 1)}
        />
        {!current && !error && (
          <div aria-label={t('tasks.loading')} className='flex flex-col gap-4'>
            {[1, 2, 3].map((row) => (
              <div key={row} className='grid grid-cols-[8rem_1fr] gap-3'>
                <Skeleton className='h-5 w-3/4' />
                <Skeleton className='h-5 w-full' />
              </div>
            ))}
          </div>
        )}
        {missing && (
          <Alert variant='destructive'>
            <AlertDescription>
              {t('tasks.namedMissing', { title: current?.title })}
            </AlertDescription>
          </Alert>
        )}
        {current && !error && !missing && (
          <>
            <div className='flex items-center justify-between'>
              <StatusBadge status={current.status} />
            </div>
            <dl className='flex flex-col gap-4 text-sm'>
              {(
                [
                  ['assignee', current.assigneeName ?? '—'],
                  [
                    'dueDate',
                    <DateText key='due' value={current.dueDate} empty='—' />,
                  ],
                  [
                    'updatedAt',
                    <DateText
                      key='updated'
                      value={current.updatedAt}
                      timestamp
                    />,
                  ],
                ] as const
              ).map(([key, value]) => (
                <div
                  key={String(key)}
                  className='grid grid-cols-[8rem_1fr] gap-3'
                >
                  <dt className='mb-1 text-muted-foreground'>
                    {t(`tasks.${key}`)}
                  </dt>
                  <dd className='min-w-0 break-words'>{value}</dd>
                </div>
              ))}
            </dl>
            <section className='flex flex-col gap-2'>
              <h3 className='text-sm font-medium'>{t('tasks.description')}</h3>
              <LongText className='text-sm'>
                {current.description || '—'}
              </LongText>
            </section>
          </>
        )}
      </div>
      <Outlet />
    </RouteDrawer>
  );
}
