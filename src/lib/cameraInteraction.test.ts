import { describe, expect, it } from 'vitest'
import {
  closeViewAfterSelection,
  isSelectionClick,
} from './cameraInteraction'

describe('camera interaction', () => {
  it('distinguishes a click from a camera drag', () => {
    expect(isSelectionClick(0)).toBe(true)
    expect(isSelectionClick(2)).toBe(true)
    expect(isSelectionClick(2.1)).toBe(false)
    expect(isSelectionClick(85)).toBe(false)
  })

  it('keeps close view when the focused object is selected again', () => {
    expect(closeViewAfterSelection(true, 'earth', 'earth')).toBe(true)
    expect(closeViewAfterSelection(true, 'earth', 'mars')).toBe(false)
    expect(closeViewAfterSelection(false, 'earth', 'earth')).toBe(false)
  })
})
