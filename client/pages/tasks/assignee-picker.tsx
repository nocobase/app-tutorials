import { useEffect, useRef, useState, type Ref } from 'react';
import { useApiClient } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { ChevronsUpDown, CheckIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#components/ui/popover';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Spinner } from '#components/ui/spinner';
import { TaskError } from './error.js';

type Person = { id: string; name: string };
export function AssigneePicker({
  id,
  value,
  label,
  onChange,
  invalid,
  describedBy,
  inputRef,
  disabled,
}: {
  disabled?: boolean;
  id: string;
  value: string;
  label: string;
  onChange: (person: Person | null) => void;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const composingRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    people?: Person[];
    total?: number;
    error?: unknown;
  }>();
  const key = JSON.stringify([q, page, revision]);
  useEffect(() => {
    if (composingRef.current) return;
    const timer = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void api
      .request<{ data: Person[]; meta: { total: number } }>({
        path: 'tasks/assignees',
        query: { q, page },
        signal: controller.signal,
      })
      .then(
        (response) => {
          if (!controller.signal.aborted)
            setResult({
              key,
              people: response.data,
              total: response.meta.total,
            });
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setResult({ key, error });
        },
      );
    return () => controller.abort();
  }, [api, open, q, page, key]);
  const loading = result?.key !== key;
  const error = loading ? undefined : result?.error;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            disabled={disabled}
            ref={inputRef}
            id={id}
            type='button'
            variant='outline'
            className='w-full justify-between'
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        }
      >
        <span className='truncate'>
          {value ? label : t('tasks.unassigned')}
        </span>
        <ChevronsUpDown data-icon='inline-end' />
      </PopoverTrigger>
      <PopoverContent
        className='w-auto min-w-(--anchor-width) max-w-sm'
        align='start'
      >
        <Input
          aria-label={t('tasks.searchPeople')}
          placeholder={t('tasks.searchPeople')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false;
            setText(event.currentTarget.value);
            setQ(event.currentTarget.value.trim());
            setPage(1);
          }}
        />
        <Button
          variant='ghost'
          type='button'
          className='justify-start'
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          {t('tasks.unassigned')}
        </Button>
        {loading ? (
          <Spinner />
        ) : error ? (
          <TaskError
            error={error}
            message={t('tasks.peopleFailed')}
            retry={() => setRevision((v) => v + 1)}
          />
        ) : (
          <div className='flex max-h-60 flex-col overflow-y-auto'>
            {result?.people?.length ? (
              result.people.map((person) => (
                <Button
                  key={person.id}
                  type='button'
                  variant='ghost'
                  className='h-auto justify-start whitespace-normal text-left'
                  onClick={() => {
                    onChange(person);
                    setOpen(false);
                  }}
                >
                  {value === person.id ? (
                    <CheckIcon data-icon='inline-start' />
                  ) : null}
                  {person.name}
                </Button>
              ))
            ) : (
              <p className='p-2 text-muted-foreground'>{t('tasks.noPeople')}</p>
            )}
          </div>
        )}
        <div className='flex items-center justify-between gap-2'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={page === 1 || loading}
            onClick={() => setPage((v) => v - 1)}
          >
            {t('tasks.previous')}
          </Button>
          <span>{t('tasks.page', { page })}</span>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={loading || page * 20 >= (result?.total ?? 0)}
            onClick={() => setPage((v) => v + 1)}
          >
            {t('tasks.next')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
