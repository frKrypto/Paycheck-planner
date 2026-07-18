import { useThemeStyles } from '../hooks/useThemeStyles';

const categoryColors: Record<string, string> = {
  housing: '#2d8a5e',
  utilities: '#3a9d6a',
  food: '#e6a817',
  transportation: '#4a90d9',
  insurance: '#8e6ab7',
  healthcare: '#e0555a',
  entertainment: '#d97706',
  other: '#6b7280',
};

const getCategoryColor = (category: string): string => {
  return categoryColors[category.toLowerCase()] || categoryColors.other;
};

export default function CategoryBadge({ category }: { category: string }) {
  const colors = useThemeStyles();
  const bg = getCategoryColor(category);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: '0.72rem',
        fontWeight: 600,
        color: colors.cardBg,
        backgroundColor: bg,
        textTransform: 'capitalize',
      }}
    >
      {category}
    </span>
  );
}
