import path from 'path'

/** Root of the markdown/data tree. Single source of truth — was copy-pasted across lib files. */
export function getDataRoot(): string {
  return process.env.DATA_ROOT ?? path.join(process.cwd(), 'data')
}
