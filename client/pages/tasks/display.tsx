import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useLocale, useTranslation } from '@nocobase/i18n/client';
import { StatusBadge } from '#components/status-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#components/ui/tooltip';
import type { TaskStatus } from './types.js';

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      tone={
        status === 'done'
          ? 'success'
          : status === 'inProgress'
            ? 'info'
            : 'neutral'
      }
    >
      {t(`tasks.${status}`)}
    </StatusBadge>
  );
}
export function TaskDate({
  value,
  time = false,
}: {
  value: string | null;
  time?: boolean;
}) {
  const { locale } = useLocale();
  if (!value) return <>—</>;
  return (
    <>
      {new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        ...(time ? ({ timeStyle: 'short' } as const) : { timeZone: 'UTC' }),
      }).format(new Date(time ? value : `${value}T00:00:00Z`))}
    </>
  );
}
export function TruncatedText({
  text,
  children,
}: {
  text: string;
  children?: ReactElement;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setOverflow(node.scrollWidth > node.clientWidth + 1),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);
  const content = (
    <span ref={ref} className='block min-w-0 truncate'>
      {children ?? text}
    </span>
  );
  return (
    <Tooltip disabled={!overflow}>
      <TooltipTrigger render={content} />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
