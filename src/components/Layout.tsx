import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface Props {
  title: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  noPad?: boolean;
}

export function Layout({ title, back, right, children, noPad }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-full">
      {/* Nav bar — sticky so it stays visible when content scrolls */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 pt-safe shrink-0">
        <div className="flex items-center h-12 px-4 gap-3">
          {back && (
            <button
              onClick={() => navigate(-1)}
              className="text-brand-600 font-medium text-sm shrink-0"
            >
              {t('common.back')}
            </button>
          )}
          <h1 className="flex-1 text-base font-semibold text-gray-900 truncate">{title}</h1>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      </div>

      {/* Content */}
      <div className={clsx('flex-1', !noPad && 'p-4')}>
        {children}
      </div>
    </div>
  );
}
