import { statusVariant, statusLabel } from '../../utils';

export function Badge({ status, label, variant }) {
  const v = variant || statusVariant(status);
  const l = label || statusLabel(status);
  return <span className={v}>{l}</span>;
}
