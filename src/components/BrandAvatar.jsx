// Кружок с буквами марки. Цвет у каждой марки свой и не меняется.
const PALETTES = [
  ['#6366F1', '#8B5CF6'], ['#0EA5E9', '#22D3EE'], ['#F97316', '#FB7185'], ['#10B981', '#34D399'],
  ['#EC4899', '#F472B6'], ['#F59E0B', '#FBBF24'], ['#3B82F6', '#60A5FA'], ['#14B8A6', '#5EEAD4'],
];

export function brandColors(brand = '') {
  let h = 0;
  for (const ch of brand.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export default function BrandAvatar({ brand, size = 44 }) {
  const [a, b] = brandColors(brand);
  const letters = (brand || '?').replace(/[^A-Za-zА-Яа-я0-9]/g, '').slice(0, 2).toUpperCase();
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {letters}
    </div>
  );
}
