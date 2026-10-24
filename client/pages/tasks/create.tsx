import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiClientError, useApiClient, useToaster } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { Button } from '#components/ui/button';
import { Field, FieldLabel, FieldError } from '#components/ui/field';
import { Input } from '#components/ui/input';
import { Spinner } from '#components/ui/spinner';
import { TaskError } from './error.js';
import type { Task, TasksContext } from './types.js';

const FORM_ID = 'tutorial-task-create';
const fieldErrorPayload = z.object({
  error: z.object({
    fieldViolations: z.array(
      z.object({ field: z.string(), reason: z.string().optional() }),
    ),
  }),
});

export default function CreateTaskPage() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  function submitting(value: boolean) {
    pendingRef.current = value;
    setPending(value);
  }
  return (
    <RouteDialog
      title={t('tasks.new')}
      description={t('tasks.formDescription')}
      className='sm:max-w-md'
      beforeClose={() => !pendingRef.current}
      footer={<Footer pending={pending} />}
    >
      <TaskForm submitting={submitting} />
    </RouteDialog>
  );
}

function TaskForm({ submitting }: { submitting: (value: boolean) => void }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const { close } = useRouteOverlay();
  const { saved } = useOutletContext<TasksContext>();
  const [error, setError] = useState<unknown>();
  const composingRef = useRef(false);
  const form = useForm<{ title: string }>({
    resolver: zodResolver(
      z.object({
        title: z
          .string()
          .trim()
          .min(1, t('tasks.required'))
          .max(120, t('tasks.tooLong')),
      }),
    ),
    defaultValues: { title: '' },
  });

  async function submit(values: { title: string }) {
    if (composingRef.current) return;
    submitting(true);
    setError(undefined);
    try {
      const response = await api.request<{ data: Task }>({
        path: 'tutorialTasks',
        method: 'POST',
        json: values,
      });
      saved(response.data, true);
      toaster.show({
        type: 'success',
        title: t('tasks.created', { title: response.data.title }),
      });
      submitting(false);
      await close();
    } catch (cause: unknown) {
      const parsed =
        cause instanceof ApiClientError && cause.status === 400
          ? fieldErrorPayload.safeParse(cause.payload)
          : undefined;
      const violation = parsed?.success
        ? parsed.data.error.fieldViolations.find(
            (item) => item.field === 'title',
          )
        : undefined;
      if (violation) {
        const key =
          violation.reason === 'too_small'
            ? 'tasks.required'
            : violation.reason === 'too_big'
              ? 'tasks.tooLong'
              : 'tasks.invalidInput';
        form.setError(
          'title',
          { type: 'server', message: t(key) },
          { shouldFocus: true },
        );
      } else {
        setError(cause);
      }
    } finally {
      submitting(false);
    }
  }

  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(submit)(event);
      }}
      className='flex flex-col gap-4'
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          (event.nativeEvent.isComposing || composingRef.current)
        )
          event.preventDefault();
      }}
    >
      {error ? <TaskError error={error} /> : null}
      <Field data-invalid={!!form.formState.errors.title}>
        <FieldLabel htmlFor='tutorial-task-title'>
          {t('tasks.taskTitle')} *
        </FieldLabel>
        <Input
          id='tutorial-task-title'
          autoComplete='off'
          aria-required
          aria-invalid={!!form.formState.errors.title}
          aria-describedby={
            form.formState.errors.title
              ? 'tutorial-task-title-error'
              : undefined
          }
          readOnly={form.formState.isSubmitting}
          {...form.register('title')}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
        />
        {form.formState.errors.title ? (
          <FieldError id='tutorial-task-title-error'>
            {form.formState.errors.title.message}
          </FieldError>
        ) : null}
      </Field>
    </form>
  );
}

function Footer({ pending }: { pending: boolean }) {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  return (
    <>
      <Button
        type='button'
        variant='outline'
        disabled={pending}
        onClick={() => void close()}
      >
        {t('tasks.cancel')}
      </Button>
      <Button type='submit' form={FORM_ID} disabled={pending}>
        {pending ? <Spinner data-icon='inline-start' /> : null}
        {t('tasks.create')}
      </Button>
    </>
  );
}
