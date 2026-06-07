const MAX_SELECTION_CLICK_TRAVEL_PX = 2

export function isSelectionClick(pointerTravelPx: number) {
  return pointerTravelPx <= MAX_SELECTION_CLICK_TRAVEL_PX
}

export function closeViewAfterSelection(
  closeView: boolean,
  currentId: string,
  nextId: string,
) {
  return currentId === nextId ? closeView : false
}
