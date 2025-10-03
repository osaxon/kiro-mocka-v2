import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

// Simple test component
function TestApp() {
  return <div>Test App</div>
}

describe('Frontend setup', () => {
  it('should render test component', () => {
    render(<TestApp />)
    expect(screen.getByText('Test App')).toBeInTheDocument()
  })
})
