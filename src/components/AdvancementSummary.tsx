import { useTranslation } from 'react-i18next';
import { computeAdvancementPlan, ordinal } from '@/lib/advancement';

interface Props {
  groupSizes: number[];
  advancementCount: number;
  className?: string;
}

/** Plain-English summary of how group standings map onto the knockout bracket. */
export function AdvancementSummary({ groupSizes, advancementCount, className }: Props) {
  const { t, i18n } = useTranslation();
  if (groupSizes.length === 0 || advancementCount < 1) return null;

  const plan = computeAdvancementPlan(groupSizes, advancementCount);
  if (plan.guaranteed === 0) return null;

  const baseKey = plan.groupCount === 1 ? 'groups.advancement.baseOneGroup' : 'groups.advancement.baseMultiGroup';
  const parts: string[] = [
    t(baseKey, { groups: plan.groupCount, count: plan.advancementCount, total: plan.guaranteed }),
  ];

  if (plan.bracketSize > 1) {
    if (plan.extrasNeeded === 0) {
      parts.push(t('groups.advancement.exact', { size: plan.bracketSize }));
    } else {
      if (plan.extrasFilled > 0) {
        parts.push(
          plan.extraRank
            ? t('groups.advancement.extrasRanked', { count: plan.extrasFilled, rank: ordinal(plan.extraRank, i18n.language) })
            : t('groups.advancement.extrasGeneric', { count: plan.extrasFilled }),
        );
      }
      if (plan.byesNeeded > 0) {
        parts.push(t('groups.advancement.byes', { count: plan.byesNeeded }));
      }
      parts.push(t('groups.advancement.toBracket', { size: plan.bracketSize }));
    }
  }

  return <p className={className}>{parts.join(' ')}</p>;
}
