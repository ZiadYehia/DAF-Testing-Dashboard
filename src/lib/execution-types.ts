export const EXECUTION_STATUSES = [
  'new_added', 'ready', 'pass', 'fail', 'blocked', 'under_testing',
] as const

export type ExecutionStatus = typeof EXECUTION_STATUSES[number]
export const DEFAULT_EXECUTION_STATUS: ExecutionStatus = 'new_added'
