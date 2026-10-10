import { describe, expect, it } from 'vitest'

import { pinchGrabs, pinchTipY } from './pinch'

describe('the phone pinch', () => {
  it('grabs with realistic fingertip gaps once the pinch closes', () => {
    // Fingertips sit 70 to 130 CSS px apart on a real pinch.
    expect(pinchGrabs(130, 130)).toBe(false)
    expect(pinchGrabs(96, 130)).toBe(true)
    expect(pinchGrabs(120, 170)).toBe(true)
    expect(pinchGrabs(110, 130)).toBe(false)
    // The M3 scripted pinch: 150 px apart closing to 90.
    expect(pinchGrabs(150, 150)).toBe(false)
    expect(pinchGrabs(90, 150)).toBe(true)
  })

  it('lifts the tip 50 CSS px above the fingers at any scale', () => {
    expect(pinchTipY(400, 1)).toBe(350)
    expect(pinchTipY(400, 0.625)).toBe(320)
  })
})
