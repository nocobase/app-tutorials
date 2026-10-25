import { useState, type Ref } from 'react';
import { CalendarIcon } from 'lucide-react';
import { enUS, zhCN } from 'react-day-picker/locale';
import { useLocale, useTranslation } from '@nocobase/i18n/client';
import { Calendar } from '#components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#components/ui/popover';
import { Button } from '#components/ui/button';

export function DatePicker({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  inputRef,
  disabled,
}: {
  disabled?: boolean;
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: Ref<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
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
            className='w-full justify-start'
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        }
      >
        <CalendarIcon data-icon='inline-start' />
        {selected
          ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
              selected,
            )
          : t('tasks.chooseDate')}
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          locale={locale.startsWith('zh') ? zhCN : enUS}
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(
              date
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                : '',
            );
            setOpen(false);
          }}
        />
        <Button
          type='button'
          variant='ghost'
          onClick={() => {
            onChange('');
            setOpen(false);
          }}
        >
          {t('tasks.clearDate')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
