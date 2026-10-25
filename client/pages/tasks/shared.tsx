import { Link } from 'react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiClientError } from '@nocobase/app-client';
import { useTranslation, useLocale } from '@nocobase/i18n/client';
import { Circle, CircleCheck, CircleDashed } from 'lucide-react';
import { Badge } from '#components/ui/badge';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Button } from '#components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#components/ui/tooltip';
import type { TaskStatus } from './types.js';
export function StatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation();
  const Icon =
    status === 'done'
      ? CircleCheck
      : status === 'inProgress'
        ? CircleDashed
        : Circle;
  return (
    <Badge variant={status === 'done' ? 'secondary' : 'outline'}>
      <Icon />
      {t(`tasks.${status}`)}
    </Badge>
  );
}
export function DateText({
  value,
  timestamp = false,
  empty,
}: {
  value: string | null;
  timestamp?: boolean;
  empty?: string;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  return value
    ? new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(timestamp ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
      }).format(new Date(timestamp ? value : `${value}T12:00:00`))
    : (empty ?? t('tasks.noDate'));
}
export function TaskError({
  error,
  title,
  retry,
  reload,
  reset,
}: {
  error: unknown;
  title?: string;
  retry?: () => void;
  reload?: () => void;
  reset?: () => void;
}) {
  const { t } = useTranslation();
  if (!error) return null;
  const status = error instanceof ApiClientError ? error.status : 0;
  return (
    <Alert variant='destructive'>
      <AlertDescription>
        {t(
          status === 400 && reset
            ? 'tasks.invalidQuery'
            : status === 404
              ? title
                ? 'tasks.namedMissing'
                : 'tasks.missing'
              : status === 409
                ? 'tasks.conflict'
                : status === 403
                  ? 'tasks.denied'
                  : status === 401
                    ? 'tasks.sessionEnded'
                    : 'tasks.failed',
          { title },
        )}
        {status === 400 && reset && (
          <Button variant='outline' size='sm' onClick={reset}>
            {t('tasks.clear')}
          </Button>
        )}
        {status === 401 && (
          <Button
            variant='outline'
            nativeButton={false}
            render={<Link to='/login' />}
          >
            {t('settings.signInAgain')}
          </Button>
        )}
        {status === 409 && reload && (
          <Button variant='outline' size='sm' onClick={reload}>
            {t('tasks.reloadLatest')}
          </Button>
        )}
        {!(status === 400 && reset) &&
          ![401, 403, 404, 409].includes(status) &&
          retry && (
            <Button variant='outline' size='sm' onClick={retry}>
              {t('tasks.retry')}
            </Button>
          )}
      </AlertDescription>
    </Alert>
  );
}
export function TruncatedTitle({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() =>
      setOverflows(node.scrollWidth > node.clientWidth),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [children]);
  // Bound text columns to 16rem so long names cannot push row actions out of reach.
  const text = (
    <span ref={ref} className='block max-w-64 truncate'>
      {children}
    </span>
  );
  return (
    <Tooltip disabled={!overflows}>
      <TooltipTrigger render={text} />
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
