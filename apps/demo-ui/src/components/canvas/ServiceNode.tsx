/**
 * ServiceNode — decorative chip representing one of the three off-canvas
 * services (Operator, KeeperHub, Chain). Eyebrow uppercase label per
 * UI-SPEC §Copywriting Contract; non-interactive (the demo's surface
 * actions live in the footer + Claude Desktop).
 */
export type ServiceId = 'operator' | 'keeperhub' | 'chain';

const LABEL: Record<ServiceId, string> = {
  operator: 'OPERATOR',
  keeperhub: 'KEEPERHUB',
  chain: 'CHAIN',
};

const DETAIL: Record<ServiceId, string> = {
  keeperhub: 'encrypted key workflow',
  operator: 'identity gate',
  chain: 'WalletsDeprecated',
};

export function ServiceNode({ id }: { id: ServiceId }): JSX.Element {
  return (
    <div
      className={`service-node service-node--${id}`}
      role="group"
      aria-label={LABEL[id]}
      data-service={id}
    >
      <span className="service-node-orbit" aria-hidden="true" />
      <div className="service-node-label">{LABEL[id]}</div>
      <div className="service-node-detail">{DETAIL[id]}</div>
    </div>
  );
}
