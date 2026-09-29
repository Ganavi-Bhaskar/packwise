import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import App from './App.jsx'

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('application shell', () => {
  test('renders the landing page and primary recommendation action', async () => {
    renderApp()
    expect(await screen.findByRole('heading', { name: /good food deserves a smarter first layer/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /get a recommendation/i }).length).toBeGreaterThan(0)
  })

  test('theme control switches the document to dark mode', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }))
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'))
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test('Escape closes the mobile navigation menu', async () => {
    renderApp()
    const menuButton = screen.getByRole('button', { name: /open navigation menu/i })
    fireEvent.click(menuButton)
    expect(screen.getByRole('button', { name: /close navigation menu/i })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveAttribute('aria-expanded', 'false'))
  })

  test('unknown paths render the not-found route', async () => {
    renderApp('/missing-view')
    expect(await screen.findByRole('heading', { name: /this page isn’t in the pack/i })).toBeInTheDocument()
  })
})
