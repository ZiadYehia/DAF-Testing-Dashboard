import { Shield, Layers, BarChart2, Lock, Package, Scale } from 'lucide-react'

/** Every icon name a module may carry — the admin picker's source of truth. */
export const MODULE_ICON_NAMES = ['Layers', 'Shield', 'BarChart2', 'Lock', 'Package', 'Scale'] as const

/** Maps a `ModuleManifest.icon` name to a lucide element; shared by the sidebar and feature UIs. */
export function getModuleIcon(iconName: string, size = 'h-3.5 w-3.5'): React.ReactNode {
  const cls = size
  switch (iconName) {
    case 'Shield':    return <Shield className={cls} />
    case 'Layers':    return <Layers className={cls} />
    case 'BarChart2': return <BarChart2 className={cls} />
    case 'Lock':      return <Lock className={cls} />
    case 'Package':   return <Package className={cls} />
    case 'Scale':     return <Scale className={cls} />
    default:          return <Layers className={cls} />
  }
}
