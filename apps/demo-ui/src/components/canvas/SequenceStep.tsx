import { motion } from 'framer-motion';

/**
 * SequenceStep — one chip in the OPERATOR/agent/keeperhub/runtime/chain row.
 * Same dimensions for all 5 chips; the only differences are the optional
 * `primary` accent (used for OPERATOR) and the `active` state, which fades
 * the chip + dot to celeste smoothly via framer-motion (CSS transitions
 * felt steppy on the dot's box-shadow halo).
 */

const COLOR = {
  borderIdle: 'rgba(255, 255, 255, 0.07)',
  borderPrimary: 'rgba(63, 184, 201, 0.36)',
  borderActive: 'rgba(125, 211, 252, 0.7)',
  bgIdle: 'rgba(255, 255, 255, 0.028)',
  bgPrimary: 'rgba(63, 184, 201, 0.075)',
  bgActive: 'rgba(125, 211, 252, 0.18)',
  textIdle: 'rgba(250, 250, 250, 0.5)',
  textPrimary: 'rgba(250, 250, 250, 0.84)',
  textActive: '#e0f2fe',
  dotIdle: 'rgba(255, 255, 255, 0.18)',
  dotPrimary: '#3FB8C9',
  dotActive: '#7dd3fc',
  haloIdle: 'rgba(255, 255, 255, 0.04)',
  haloPrimary: 'rgba(63, 184, 201, 0.11)',
  haloActive: 'rgba(125, 211, 252, 0.32)',
} as const;

const TRANSITION = { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as const };

export interface SequenceStepProps {
  id: string;
  label: string;
  active: boolean;
  idleHint: string;
  primary?: boolean;
}

export function SequenceStep({
  id,
  label,
  active,
  idleHint,
  primary = false,
}: SequenceStepProps): JSX.Element {
  const baseClass =
    'sequence-step' +
    (active ? ' sequence-step--active' : '') +
    (primary ? ' sequence-step--primary' : '');

  const borderColor = active
    ? COLOR.borderActive
    : primary
      ? COLOR.borderPrimary
      : COLOR.borderIdle;
  const backgroundColor = active
    ? COLOR.bgActive
    : primary
      ? COLOR.bgPrimary
      : COLOR.bgIdle;
  const color = active ? COLOR.textActive : primary ? COLOR.textPrimary : COLOR.textIdle;
  const dotBg = active ? COLOR.dotActive : primary ? COLOR.dotPrimary : COLOR.dotIdle;
  const dotHalo = active ? COLOR.haloActive : primary ? COLOR.haloPrimary : COLOR.haloIdle;
  const dotHaloRadius = active ? 5 : primary ? 4 : 3;

  return (
    <motion.span
      className={baseClass}
      data-active={active ? 'true' : 'false'}
      data-testid={`sequence-step-${id}`}
      animate={{ borderColor, backgroundColor, color }}
      transition={TRANSITION}
    >
      <motion.span
        className="sequence-step-dot"
        aria-hidden="true"
        animate={{
          backgroundColor: dotBg,
          boxShadow: `0 0 0 ${dotHaloRadius}px ${dotHalo}`,
          scale: active ? [1, 1.18, 1] : 1,
        }}
        transition={
          active
            ? { ...TRANSITION, scale: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } }
            : TRANSITION
        }
      />
      <span className="sequence-step-label">{label}</span>
      <motion.span
        className="sequence-step-state"
        aria-hidden="true"
        animate={{
          color: active
            ? 'rgba(186, 230, 253, 0.95)'
            : 'rgba(250, 250, 250, 0.32)',
        }}
        transition={TRANSITION}
      >
        {active ? 'active' : idleHint}
      </motion.span>
    </motion.span>
  );
}
