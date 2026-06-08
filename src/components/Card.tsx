import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('bg-white rounded-2xl shadow-sm border border-gray-100', className)} {...props}>
      {children}
    </div>
  );
}
