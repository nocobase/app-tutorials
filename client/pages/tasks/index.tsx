import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useApiClient } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import type { ColumnDef } from '@tanstack/react-table';
import { ListTodo, PlusIcon, SearchIcon } from 'lucide-react';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable } from '#components/data-table';
import { DataTableColumnHeader } from '#components/data-table/column-header';
import { RecordLink } from '#components/record-link';
import { Button } from '#components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '#components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select';
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
import { Alert, AlertDescription } from '#components/ui/alert';
import { useUrlSearch } from '#hooks/use-url-search';
import { useTableUrlState } from '#hooks/use-table-url-state';
import { TaskError } from './error.js';
import { TaskActions } from './actions.js';
import { TaskDate, TaskStatusBadge, TruncatedText } from './display.js';
import { TASK_STATUSES, type Task, type TasksContext } from './types.js';

const PAGE_SIZES = [10, 20, 50] as const;
export default function TasksPage() {
  const { t } = useTranslation();
  const api = useApiClient();
  const location = useLocation();
  const { session } = useAuthentication();
  const userId = session?.user.id;
  const searchRef = useRef<HTMLInputElement>(null);
  const read = useCan({
    resource: { type: 'composite', id: 'tasks' },
    action: 'read',
  });
  const create = useCan({
    resource: { type: 'composite', id: 'tasks' },
    action: 'create',
  });
  const { searchParams, search, inputProps, updateParams, clear } =
    useUrlSearch({ resetParams: ['page'] });
  const status =
    TASK_STATUSES.find((value) => value === searchParams.get('status')) ??
    'all';
  const assignee = searchParams.get('assignee') === 'me' ? 'me' : 'all';
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    rows?: Task[];
    total?: number;
    error?: unknown;
    written?: boolean;
  }>();
  const page =
    Number(searchParams.get('page')) > 0 ? Number(searchParams.get('page')) : 1;
  const pageSize =
    PAGE_SIZES.find((size) => String(size) === searchParams.get('pageSize')) ??
    10;
  const sort = searchParams.get('sort') === 'dueDate' ? 'dueDate' : 'updatedAt';
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const queryKey = JSON.stringify([
    search,
    status,
    assignee,
    page,
    pageSize,
    sort,
    order,
    revision,
  ]);
  const table = useTableUrlState({
    pageSizeOptions: PAGE_SIZES,
    sortColumns: ['updatedAt', 'dueDate'],
    rowCount:
      result?.key === queryKey && !result.error ? result.total : undefined,
  });
  useEffect(() => {
    if (!read.can) return;
    const controller = new AbortController();
    void api
      .request<{ data: Task[]; meta: { total: number } }>({
        path: 'tasks',
        query: { q: search, status, assignee, page, pageSize, sort, order },
        signal: controller.signal,
      })
      .then(
        ({ data, meta }) => {
          if (!controller.signal.aborted)
            setResult({ key: queryKey, rows: data, total: meta.total });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setResult((previous) => ({ ...previous, key: queryKey, error }));
        },
      );
    return () => controller.abort();
  }, [
    api,
    read.can,
    search,
    status,
    assignee,
    page,
    pageSize,
    sort,
    order,
    queryKey,
  ]);
  const reload = useCallback(
    () => setRevision((value) => value + 1),
    [setRevision],
  );
  const focusList = useCallback(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);
  const context = useMemo<TasksContext>(
    () => ({
      reload,
      focusList,
      missing: (id) => {
        setResult((previous) =>
          previous
            ? {
                ...previous,
                rows: previous.rows?.filter((row) => row.id !== id),
                total: Math.max(
                  0,
                  (previous.total ?? 0) -
                    (previous.rows?.some((row) => row.id === id) ? 1 : 0),
                ),
              }
            : previous,
        );
        reload();
        setTimeout(focusList, 100);
      },
      saved: (task, created) => {
        if (!read.can) return;
        setResult((previous) => {
          const matches =
            created ||
            ((!search ||
              task.title
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase())) &&
              (status === 'all' || task.status === status) &&
              (assignee === 'all' || task.assigneeId === userId));
          const old = previous?.rows ?? [];
          const rows = old.filter((row) => row.id !== task.id);
          const inserted = matches ? [task, ...rows] : rows;
          if (!created)
            inserted.sort((a, b) => {
              const comparison =
                (a[sort] ?? '').localeCompare(b[sort] ?? '') ||
                a.id.localeCompare(b.id);
              return order === 'asc' ? comparison : -comparison;
            });
          return {
            ...previous,
            key: queryKey,
            rows: inserted.slice(0, pageSize),
            total: (previous?.total ?? 0) + (created ? 1 : 0),
            written: true,
            error: undefined,
          };
        });
        reload();
      },
    }),
    [
      reload,
      focusList,
      setResult,
      read.can,
      search,
      status,
      assignee,
      userId,
      sort,
      order,
      queryKey,
      pageSize,
    ],
  );
  const newButton = (
    <Button
      nativeButton={false}
      render={<Link to={{ pathname: 'new', search: location.search }} />}
    >
      <PlusIcon data-icon='inline-start' />
      {t('tasks.new')}
    </Button>
  );
  const hasFilters = Boolean(search) || status !== 'all' || assignee !== 'all';
  const loading = read.can && result?.key !== queryKey;
  const empty = read.can && result?.total === 0 && !hasFilters && !loading;
  const showCreate =
    create.can && (!read.can || Boolean(result?.rows)) && !empty;
  function filter(name: string, value: string | null) {
    updateParams((params) => {
      if (value && value !== 'all') params.set(name, value);
      else params.delete(name);
      params.delete('page');
    });
  }
  function clearFilters() {
    clear((params) => {
      params.delete('status');
      params.delete('assignee');
      params.delete('page');
    });
  }
  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'title',
      header: t('tasks.titleField'),
      enableSorting: false,
      cell: ({ row }) => (
        <div className='flex w-64 flex-col gap-1 sm:w-80'>
          <TruncatedText text={row.original.title}>
            <RecordLink
              to={{ pathname: row.original.id, search: location.search }}
            >
              {row.original.title}
            </RecordLink>
          </TruncatedText>
          {row.original.description ? (
            <div className='text-xs text-muted-foreground'>
              <TruncatedText text={row.original.description} />
            </div>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: t('tasks.status'),
      enableSorting: false,
      cell: ({ row }) => <TaskStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'assigneeName',
      header: t('tasks.assignee'),
      enableSorting: false,
      cell: ({ row }) => (
        <div className='max-w-40'>
          <TruncatedText
            text={
              row.original.assigneeId
                ? (row.original.assigneeName ?? t('tasks.unavailable'))
                : t('tasks.unassigned')
            }
          />
        </div>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tasks.dueDate')} />
      ),
      cell: ({ row }) => (
        <div className='whitespace-nowrap'>
          <TaskDate value={row.original.dueDate} />
        </div>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('tasks.updatedAt')} />
      ),
      cell: ({ row }) => (
        <span className='whitespace-nowrap text-muted-foreground'>
          <TaskDate value={row.original.updatedAt} time />
        </span>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row }) => <TaskActions task={row.original} context={context} />,
    },
  ];
  const statuses = [
    { value: 'all', label: t('tasks.allStatuses') },
    ...TASK_STATUSES.map((value) => ({ value, label: t(`tasks.${value}`) })),
  ];
  const people = [
    { value: 'all', label: t('tasks.allTasks') },
    { value: 'me', label: t('tasks.mine') },
  ];
  return (
    <PageContainer>
      <PageHeader
        title={t('tasks.title')}
        description={t('tasks.description')}
        actions={showCreate ? newButton : undefined}
      />
      {read.can ? (
        <>
          <div className='flex flex-wrap items-center gap-2'>
            <InputGroup className='w-full sm:max-w-xs'>
              <InputGroupInput
                ref={searchRef}
                {...inputProps}
                maxLength={120}
                placeholder={t('tasks.search')}
                aria-label={t('tasks.search')}
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
            {[
              {
                name: 'status',
                value: status,
                items: statuses,
                label: t('tasks.status'),
              },
              {
                name: 'assignee',
                value: assignee,
                items: people,
                label: t('tasks.assignee'),
              },
            ].map((item) => (
              <Select
                key={item.name}
                items={item.items}
                value={item.value}
                onValueChange={(value) => filter(item.name, value)}
              >
                <SelectTrigger
                  className='w-full sm:w-40'
                  aria-label={item.label}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className='w-auto max-w-[min(var(--container-sm),var(--available-width))] min-w-(--anchor-width) [&_[data-slot=select-item]>:first-child]:whitespace-normal'>
                  <SelectGroup>
                    {item.items.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ))}
            {hasFilters ? (
              <Button variant='ghost' onClick={clearFilters}>
                {t('tasks.clear')}
              </Button>
            ) : null}
            {loading && result?.rows ? <Spinner /> : null}
          </div>
          {result?.error ? (
            <TaskError
              error={result.error}
              retry={reload}
              message={result.written ? t('tasks.refreshFailed') : undefined}
            />
          ) : null}
          {!result?.rows && !result?.error ? (
            <div
              className='flex flex-col gap-2'
              aria-label={t('tasks.loading')}
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <Skeleton key={v} className='h-12 w-full' />
              ))}
            </div>
          ) : empty ? (
            <Empty className='min-h-48 border border-dashed'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <ListTodo />
                </EmptyMedia>
                <EmptyTitle>{t('tasks.empty')}</EmptyTitle>
                <EmptyDescription>
                  {t(create.can ? 'tasks.emptyHelp' : 'tasks.emptyReadOnly')}
                </EmptyDescription>
              </EmptyHeader>
              {create.can ? <EmptyContent>{newButton}</EmptyContent> : null}
            </Empty>
          ) : result?.rows ? (
            <DataTable
              columns={columns}
              data={result.rows}
              manualPagination
              rowCount={result.total ?? 0}
              paginationState={table.paginationState}
              onPaginationChange={table.onPaginationChange}
              pageSizeOptions={PAGE_SIZES}
              manualSorting
              sortingState={[{ id: sort, desc: order === 'desc' }]}
              onSortingChange={table.onSortingChange}
              loading={loading}
              showSelectedCount={false}
              getRowId={(row) => row.id}
              emptyMessage={
                <div className='flex flex-col items-center gap-2 py-6'>
                  <p className='font-medium'>{t('tasks.noResults')}</p>
                  <p className='text-muted-foreground'>
                    {t('tasks.noResultsHelp')}
                  </p>
                  <Button variant='outline' onClick={clearFilters}>
                    {t('tasks.clear')}
                  </Button>
                </div>
              }
            />
          ) : null}
        </>
      ) : read.isPending ? (
        <Skeleton className='h-32 w-full' />
      ) : (
        <Alert>
          <AlertDescription>{t('tasks.noRead')}</AlertDescription>
        </Alert>
      )}
      <Outlet context={context} />
    </PageContainer>
  );
}
