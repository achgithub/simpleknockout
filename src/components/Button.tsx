import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export function Button({ variant = 'primary', fullWidth, className, children, ...props }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-xl font-semibold text-sm px-4 py-3 transition-opacity active:opacity-70 disabled:opacity-40',
        fullWidth && 'w-full',
        variant === 'primary'   && 'bg-brand-600 text-white',
        variant === 'secondary' && 'bg-gray-100 text-gray-900',
        variant === 'danger'    && 'bg-red-500 text-white',
        variant === 'ghost'     && 'bg-transparent text-brand-600',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
