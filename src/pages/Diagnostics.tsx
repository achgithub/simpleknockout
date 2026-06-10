import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { Capacitor } from '@capacitor/core';

const APP_VERSION = '0.1.0';

export function Diagnostics() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const rows: { label: string; value: string }[] = [
    { label: t('diagnostics.appVersion'), value: APP_VERSION },
    { label: t('diagnostics.platform'),   value: Capacitor.getPlatform() },
    { label: t('diagnostics.isNative'),   value: String(Capacitor.isNativePlatform()) },
    { label: t('diagnostics.userAgent'),  value: navigator.userAgent.slice(0, 60) + '…' },
  ];

  return (
    <Layout title={t('diagnostics.title')} back>
      <div className="flex flex-col gap-4">
        <Card className="p-0 overflow-hidden divide-y divide-gray-100">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-start px-4 py-3 gap-3">
              <p className="text-sm font-medium text-gray-700 w-28 shrink-0">{label}</p>
              <p className="text-sm text-gray-500 break-all">{value}</p>
            </div>
          ))}
        </Card>

        <button
          onClick={() => navigate(-1)}
          className="text-sm text-brand-600 text-center py-2"
        >
          {t('common.close')}
        </button>
      </div>
    </Layout>
  );
}
