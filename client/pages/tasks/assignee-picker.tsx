import { Skeleton } from '#components/ui/skeleton';
import { useEffect, useState, useMemo } from 'react';
import { useApiClient } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '#components/ui/combobox';
import { Button } from '#components/ui/button';
import { TaskError } from './shared.js';
interface Person {
  id: string;
  name: string;
}
export function AssigneePicker({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: Person | null;
  onChange: (value: Person | null) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const api = useApiClient();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>();
  const [settled, setSettled] = useState('');
  const [revision, setRevision] = useState(0);
  const requestKey = `${q}|${page}|${revision}`;
  const loading = settled !== requestKey;
  const none = useMemo(() => ({ id: '', name: t('tasks.unassigned') }), [t]);
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: Person[]; meta: { total: number } }>({
        path: `tasks/assignees?${new URLSearchParams({ q, page: String(page), pageSize: '20' })}`,
        signal: controller.signal,
      })
      .then(
        (result) => {
          if (controller.signal.aborted) return;
          setPeople((old) =>
            page === 1
              ? result.data
              : [
                  ...old,
                  ...result.data.filter(
                    (item) => !old.some((u) => u.id === item.id),
                  ),
                ],
          );
          setTotal(result.meta.total);
          setError(undefined);
          setSettled(requestKey);
        },
        (next: unknown) => {
          if (!controller.signal.aborted) {
            setError(next);
            setSettled(requestKey);
          }
        },
      );
    return () => controller.abort();
  }, [api, q, page, revision, requestKey]);
  const items = [
    none,
    ...(value && !people.some((p) => p.id === value.id) ? [value] : []),
    ...people,
  ];
  return (
    <Combobox
      items={items}
      value={value ?? none}
      itemToStringLabel={(item: Person) => item.name}
      itemToStringValue={(item: Person) => item.id}
      isItemEqualToValue={(a: Person, b: Person) => a.id === b.id}
      filter={null}
      onValueChange={(item: Person | null) => onChange(item?.id ? item : null)}
      onInputValueChange={(text, details) => {
        if (details.reason === 'input-change') {
          setQ(text);
          setPage(1);
          setPeople([]);
        }
      }}
      disabled={disabled}
    >
      <ComboboxInput
        id='task-assignee'
        aria-invalid={invalid}
        aria-describedby={invalid ? 'task-assignee-error' : undefined}
        placeholder={t('tasks.searchPeople')}
      />
      <ComboboxContent>
        <ComboboxList>
          {(item: Person) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
        {loading && (
          <div
            role='status'
            aria-label={t('tasks.loading')}
            className='flex flex-col gap-2 p-3'
          >
            <Skeleton className='h-5 w-full' />
            <Skeleton className='h-5 w-2/3' />
          </div>
        )}
        <TaskError error={error} retry={() => setRevision((n) => n + 1)} />
        {!loading && !error && !people.length && (
          <p className='p-3 text-sm text-muted-foreground'>
            {t(q ? 'tasks.noPeople' : 'tasks.noUsers')}
          </p>
        )}
        {!loading && !error && people.length < total && (
          <Button
            variant='ghost'
            className='w-full'
            onClick={() => setPage((n) => n + 1)}
          >
            {t('tasks.loadMore')}
          </Button>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
