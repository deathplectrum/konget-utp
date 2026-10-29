import { IonBadge } from '@ionic/react';
import { statusColor } from '../lib/status';

export default function StatusChip({ change }) {
  return <IonBadge color={statusColor(change)} className="status-chip">{change}</IonBadge>;
}
