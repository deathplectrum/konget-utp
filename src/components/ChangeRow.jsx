import { IonIcon } from '@ionic/react';
import { arrowDown, arrowUp, addCircle, removeCircle } from 'ionicons/icons';
import { formatRub } from '../lib/status';

// Одна строка «что поменялось»: было → стало, со стрелкой и цветом.
// Цена вниз — хорошо для покупателя (зелёный), вверх — красный.
function Delta({ label, was, now, goodWhenUp }) {
  if (was === now) return null;
  const nums = typeof was === 'number' && typeof now === 'number';
  const up = nums && now > was;
  const good = nums ? (up ? goodWhenUp : !goodWhenUp) : null;
  return (
    <div className="delta">
      <span className="delta-label">{label}</span>
      <span className="delta-was">{formatRub(was)}</span>
      <span className={`delta-now ${good === null ? '' : good ? 'good' : 'bad'}`}>
        {nums && <IonIcon icon={up ? arrowUp : arrowDown} />}
        {formatRub(now)}
      </span>
    </div>
  );
}

export default function ChangeRow({ item, site }) {
  return (
    <div className="change-row">
      <div className="change-head">
        <b>{item.model}</b>
        {site && <span className="muted"> · {site}</span>}
        {item.type === 'new' && <span className="tag tag-new"><IonIcon icon={addCircle} />новая модель</span>}
        {item.type === 'gone' && <span className="tag tag-gone"><IonIcon icon={removeCircle} />пропала с сайта</span>}
      </div>
      {item.type === 'changed' && (
        <>
          <Delta label="Цена" was={item.was.price} now={item.now.price} goodWhenUp={false} />
          <Delta label="Выгода" was={item.was.max_benefit} now={item.now.max_benefit} goodWhenUp />
        </>
      )}
      {item.type === 'new' && (
        <div className="delta">
          <span className="delta-label">Цена</span><span className="delta-now">{formatRub(item.now.price)}</span>
          {typeof item.now.max_benefit === 'number' && (
            <span className="benefit-chip">выгода до {formatRub(item.now.max_benefit)}</span>
          )}
        </div>
      )}
    </div>
  );
}
