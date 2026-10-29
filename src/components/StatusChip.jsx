import { IonIcon } from '@ionic/react';
import { statusMeta } from '../lib/status';

// Цветная плашка статуса со значком.
export default function StatusChip({ change, small }) {
  const meta = statusMeta(change);
  return (
    <span className={`pill tone-${meta.tone} ${small ? 'pill-sm' : ''}`}>
      <IonIcon icon={meta.icon} />
      {change}
    </span>
  );
}
