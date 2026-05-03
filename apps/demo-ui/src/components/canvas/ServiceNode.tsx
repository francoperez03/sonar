/**
 * ServiceNode — live chip for the Operator identity gate. KeeperHub and Chain
 * are shown in the compact sequence row to avoid extra status lights.
 */
export function ServiceNode({ active = false }: { id?: 'operator'; active?: boolean }): JSX.Element {
  return (
    <div
      className={`service-node service-node--operator${active ? ' service-node--active' : ''}`}
      role="group"
      aria-label="OPERATOR"
      data-service="operator"
      data-active={active ? 'true' : 'false'}
    >
      <span className="service-node-orbit" aria-hidden="true" />
      <div className="service-node-label">OPERATOR</div>
      <div className="service-node-detail">
        {active ? 'runtime event received' : 'awaiting runtime event'}
      </div>
    </div>
  );
}
