import { useState, type ComponentProps } from 'react';
import { format } from 'date-fns';
import type { Locale } from 'react-day-picker';
import { CalendarIcon } from 'lucide-react';
import { Button } from '#components/ui/button';
import { Calendar } from '#components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#components/ui/popover';

type DatePickerProps = Pick<
  ComponentProps<typeof Button>,
  'id' | 'ref' | 'onBlur' | 'disabled' | 'aria-invalid' | 'aria-describedby'
> & {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  locale: Locale;
  placeholder: string;
  clearLabel: string;
};

export function DatePicker({
  value,
  onChange,
  locale,
  placeholder,
  clearLabel,
  ...props
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            className='w-full justify-start font-normal'
            {...props}
          />
        }
      >
        <CalendarIcon aria-hidden='true' data-icon='inline-start' />
        {value ? format(value, 'PPP', { locale }) : placeholder}
      </PopoverTrigger>
      <PopoverContent align='start' className='w-auto p-0'>
        <Calendar
          mode='single'
          locale={locale}
          selected={value}
          defaultMonth={value}
          autoFocus
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
        <Button
          type='button'
          variant='ghost'
          className='mx-2 mb-2'
          disabled={!value}
          onClick={() => {
            onChange(undefined);
            setOpen(false);
          }}
        >
          {clearLabel}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
