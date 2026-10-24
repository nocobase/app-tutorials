import { ApiClientError, useApiClient, useToaster } from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { type ColumnDef } from '@tanstack/react-table';
import { ListTodo, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { DataTable } from '#components/data-table';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Badge } from '#components/ui/badge';
import { Button } from '#components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#components/ui/empty';
import { Skeleton } from '#components/ui/skeleton';
import { Spinner } from '#components/ui/spinner';
import { TaskError } from './error.js';
import { taskErrorKey } from './error-key.js';
import type { Task, TasksContext } from './types.js';

export default function TasksPage() {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const { refresh } = useAuthentication();
  const location = useLocation();
  const createAccess = useCan({
    resource: { type: 'composite', id: 'tutorial.tasks' },
    action: 'create',
  });
  const updateAccess = useCan({
    resource: { type: 'composite', id: 'tutorial.tasks' },
    action: 'update',
  });
  const [result, setResult] = useState<{
    data: Task[];
    meta: { total: number };
  }>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const headingRef = useRef<HTMLSpanElement>(null);
  const previousPathRef = useRef(location.pathname);
  const focusHeading = () => headingRef.current?.focus();
  const reload = () => {
    setLoading(true);
    setError(undefined);
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: Task[]; meta: { total: number } }>({
        path: 'tutorialTasks',
        signal: controller.signal,
      })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, revision]);

  useEffect(() => {
    if (
      previousPathRef.current.endsWith('/create') &&
      !location.pathname.endsWith('/create')
    )
      focusHeading();
    previousPathRef.current = location.pathname;
  }, [location.pathname]);

  function saved(task: Task, created = false) {
    setResult((old) => ({
      data: [
        task,
        ...(old?.data ?? []).filter((row) => row.id !== task.id),
      ].slice(0, 100),
      meta: { total: (old?.meta.total ?? 0) + (created ? 1 : 0) },
    }));
    reload();
  }

  async function setCompleted(task: Task) {
    setPendingIds((old) => new Set(old).add(task.id));
    try {
      const response = await api.request<{ data: Task }>({
        path: `tutorialTasks/${encodeURIComponent(task.id)}`,
        method: 'PATCH',
        json: { completed: !task.completed },
      });
      saved(response.data);
      toaster.show({
        type: 'success',
        title: t('tasks.updated', { title: task.title }),
      });
    } catch (cause: unknown) {
      toaster.show({
        type: 'error',
        title: t(taskErrorKey(cause)),
        ...(cause instanceof ApiClientError && cause.status === 401
          ? {
              action: {
                label: t('tasks.signIn'),
                onClick: () => void refresh(),
              },
            }
          : {}),
      });
      if (cause instanceof ApiClientError && cause.status === 404) {
        focusHeading();
        setResult((old) =>
          old
            ? {
                data: old.data.filter((row) => row.id !== task.id),
                meta: { total: Math.max(0, old.meta.total - 1) },
              }
            : old,
        );
        reload();
      }
    } finally {
      setPendingIds((old) => {
        const next = new Set(old);
        next.delete(task.id);
        return next;
      });
    }
  }

  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: t('tasks.taskTitle'),
      cell: ({ row }) => <TaskTitle title={row.original.title} />,
    },
    {
      accessorKey: 'assigneeName',
      header: t('tasks.assignee'),
      cell: ({ row }) =>
        row.original.assigneeId ? (
          <TaskTitle
            title={row.original.assigneeName ?? t('tasks.assigneeUnavailable')}
          />
        ) : (
          t('tasks.unassigned')
        ),
    },
    {
      accessorKey: 'completed',
      header: t('tasks.status'),
      cell: ({ row }) => (
        <Badge variant='secondary'>
          {t(row.original.completed ? 'tasks.completed' : 'tasks.pending')}
        </Badge>
      ),
    },
    ...(updateAccess.can
      ? [
          {
            id: 'actions',
            header: t('tasks.actions'),
            cell: ({ row }: { row: { original: Task } }) => (
              <Button
                variant='ghost'
                disabled={pendingIds.has(row.original.id)}
                onClick={() => void setCompleted(row.original)}
              >
                {pendingIds.has(row.original.id) ? (
                  <Spinner data-icon='inline-start' />
                ) : null}
                {t(row.original.completed ? 'tasks.reopen' : 'tasks.complete')}
              </Button>
            ),
          },
        ]
      : []),
  ];
  const newTask = createAccess.can ? (
    <Button nativeButton={false} render={<Link to='create' />}>
      <Plus data-icon='inline-start' />
      {t('tasks.new')}
    </Button>
  ) : null;
  const context: TasksContext = { saved, focusHeading };

  return (
    <PageContainer>
      <PageHeader
        title={
          <span ref={headingRef} tabIndex={-1}>
            {t('tasks.title')}
          </span>
        }
        description={t('tasks.description')}
        actions={result?.data.length ? newTask : null}
      />
      {createAccess.error || updateAccess.error ? (
        <TaskError
          error={createAccess.error ?? updateAccess.error}
          retry={() => {
            createAccess.retry();
            updateAccess.retry();
          }}
        />
      ) : null}
      {error ? <TaskError error={error} retry={reload} /> : null}
      {loading && !result ? (
        <div
          role='status'
          aria-label={t('tasks.loading')}
          className='flex flex-col gap-4'
        >
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
        </div>
      ) : null}
      {loading && result ? (
        <div
          role='status'
          className='flex items-center gap-2 text-sm text-muted-foreground'
        >
          <Spinner />
          {t('tasks.loading')}
        </div>
      ) : null}
      {result?.data.length === 0 ? (
        <Empty className='min-h-48 border border-dashed'>
          <EmptyHeader>
            <EmptyMedia variant='icon'>
              <ListTodo />
            </EmptyMedia>
            <EmptyTitle>{t('tasks.emptyTitle')}</EmptyTitle>
            <EmptyDescription>
              {t(
                createAccess.can ? 'tasks.emptyDescription' : 'tasks.askAdmin',
              )}
            </EmptyDescription>
          </EmptyHeader>
          {newTask ? <EmptyContent>{newTask}</EmptyContent> : null}
        </Empty>
      ) : null}
      {result && result.data.length > 0 ? (
        <DataTable
          columns={columns}
          data={result.data}
          pagination={false}
          getRowId={(row) => row.id}
        />
      ) : null}
      {result && result.meta.total > 100 ? (
        <p className='text-sm text-muted-foreground'>{t('tasks.capNotice')}</p>
      ) : null}
      <Outlet context={context} />
    </PageContainer>
  );
}

function TaskTitle({ title }: { title: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setTruncated(node.scrollWidth > node.clientWidth),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [title]);
  return (
    <span
      ref={ref}
      className='block max-w-xs truncate font-medium'
      title={truncated ? title : undefined}
    >
      {title}
    </span>
  );
}
