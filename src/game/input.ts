export type VirtualControl = 'up' | 'down' | 'left' | 'right' | 'dash' | 'pulse'

const pressed = new Set<VirtualControl>()

export const setVirtualControl = (control: VirtualControl, active: boolean) => {
  if (active) pressed.add(control)
  else pressed.delete(control)
}

export const isVirtualControlDown = (control: VirtualControl) => pressed.has(control)

export const resetVirtualControls = () => pressed.clear()

