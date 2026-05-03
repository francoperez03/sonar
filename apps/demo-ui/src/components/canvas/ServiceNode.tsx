/**
 * ServiceNode — live chip for the Operator identity gate. The rest of the
 * rotation path sits beside it so the canvas reads left to right.
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
