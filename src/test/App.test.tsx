import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  it('renders the application title', () => {
    render(<App />)
    expect(screen.getByText('Pomodoro Timer')).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    render(<App />)
    expect(screen.getByText('Focus. Work. Rest. Repeat.')).toBeInTheDocument()
  })

  it('renders within the app container', () => {
    const { container } = render(<App />)
    const appDiv = container.querySelector('.app')
    expect(appDiv).toBeInTheDocument()
  })
})
