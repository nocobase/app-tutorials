import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useOutletContext, useParams } from 'react-router';
import { ApiClientError, useApiClient } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDrawer } from '#components/route-drawer';
import { useRouteOverlay } from '#components/use-route-overlay';
import { LongText } from '#components/long-text';
import { Button } from '#components/ui/button';
import { Skeleton } from '#components/ui/skeleton';
import { TaskError } from '../error.js';
import { TaskActions } from '../actions.js';
import { TaskDate, TaskStatusBadge } from '../display.js';
import type { Task, TasksContext } from '../types.js';

export default function TaskDetailPage() {
  const { taskId = '' } = useParams();
  return <TaskDetail key={taskId} id={taskId} />;
}
function TaskDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const parent = useOutletContext<TasksContext>();
  const parentRef = useRef(parent);
  useEffect(() => {
    parentRef.current = parent;
  }, [parent]);
  const [result, setResult] = useState<{ task?: Task; error?: unknown }>();
  const [revision, setRevision] = useState(0);
  const [gone, setGone] = useState(false);
  const pendingRef = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: Task }>({
        path: `tasks/${id}`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted) setResult({ task: data });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setResult({ error });
          if (error instanceof ApiClientError && error.status === 404) {
            setGone(true);
            parentRef.current.missing(id);
          }
        },
      );
    return () => controller.abort();
  }, [api, id, revision]);
  const context = useMemo<TasksContext>(
    () => ({
      ...parent,
      received: (task) => {
        setResult({ task });
        parent.received(task);
      },
      saved: (task) => {
        setResult({ task });
        parent.saved(task);
      },
      missing: (taskId) => {
        setGone(true);
        parent.missing(taskId);
      },
    }),
    [parent],
  );
  const task = result?.task;
  return (
    <RouteDrawer
      title={task?.title ?? t('tasks.title')}
      beforeClose={() => !pendingRef.current}
      footer={
        <DetailFooter
          task={!gone ? task : undefined}
          context={context}
          onBusyChange={(value) => {
            pendingRef.current = value;
          }}
        />
      }
    >
      {gone ? (
        <TaskError
          error={result?.error}
          message={t('tasks.missing', { title: task?.title ?? id })}
        />
      ) : result?.error ? (
        <TaskError
          error={result.error}
          retry={() => {
            setResult(undefined);
            setRevision((v) => v + 1);
          }}
        />
      ) : task ? (
        <div className='flex flex-col gap-6'>
          <dl className='grid grid-cols-[8rem_1fr] items-start gap-4 text-sm'>
            <dt className='text-muted-foreground'>{t('tasks.status')}</dt>
            <dd>
              <TaskStatusBadge status={task.status} />
            </dd>
            <dt className='text-muted-foreground'>{t('tasks.assignee')}</dt>
            <dd className='break-words'>
              {task.assigneeId
                ? (task.assigneeName ?? t('tasks.unavailable'))
                : '—'}
            </dd>
            <dt className='text-muted-foreground'>{t('tasks.dueDate')}</dt>
            <dd>
              <TaskDate value={task.dueDate} />
            </dd>
            <dt className='text-muted-foreground'>{t('tasks.updatedAt')}</dt>
            <dd>
              <TaskDate value={task.updatedAt} time />
            </dd>
          </dl>
          <section className='flex flex-col gap-2'>
            <h2 className='text-base font-medium'>
              {t('tasks.descriptionField')}
            </h2>
            <LongText>{task.description || '—'}</LongText>
          </section>
        </div>
      ) : (
        <div className='flex flex-col gap-4' aria-label={t('tasks.loading')}>
          {[1, 2, 3, 4].map((v) => (
            <Skeleton key={v} className='h-8 w-full' />
          ))}
        </div>
      )}
      <Outlet context={context} />
    </RouteDrawer>
  );
}
function DetailFooter({
  task,
  context,
  onBusyChange,
}: {
  task?: Task;
  context: TasksContext;
  onBusyChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant='outline' disabled={busy} onClick={() => void close()}>
        {t('tasks.close')}
      </Button>
      {task ? (
        <TaskActions
          task={task}
          context={context}
          detail
          onBusyChange={(value) => {
            setBusy(value);
            onBusyChange(value);
          }}
          onRemoved={() => void close()}
        />
      ) : null}
    </>
  );
}
