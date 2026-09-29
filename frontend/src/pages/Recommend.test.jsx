import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import api from '../services/api.js'
import Recommend from './Recommend.jsx'
import Results from './Results.jsx'

vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

const recommendation = {
  explanation: 'A useful fit for the profile.',
  safety_filtered_materials: [],
  recommendations: [
    { material: 'PET', probability: 0.62, predicted_shelf_life_days: 18, suitability_score: 83, cost_level: 'medium', sustainability_score: 68, recyclability: 78, biodegradability: 0, pros: ['Clear and strong'], cons: ['Not biodegradable'], explanation: 'PET offers a useful barrier.', warnings: [] },
    { material: 'PP', probability: 0.24, predicted_shelf_life_days: 18, suitability_score: 71, cost_level: 'low', sustainability_score: 55, recyclability: 52, biodegradability: 0, pros: ['Lightweight'], cons: ['Moderate oxygen barrier'], explanation: 'PP fits the budget.', warnings: [] },
    { material: 'Glass', probability: 0.14, predicted_shelf_life_days: 18, suitability_score: 65, cost_level: 'high', sustainability_score: 75, recyclability: 90, biodegradability: 0, pros: ['Excellent barrier'], cons: ['Heavy'], explanation: 'Glass has a strong barrier.', warnings: [] },
  ],
}

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={['/recommend']}>
      <Routes>
        <Route path="/recommend" element={<Recommend />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function reachFinalStep() {
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  expect(await screen.findByRole('heading', { name: /where will it go/i })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
  expect(await screen.findByRole('heading', { name: /what matters most/i })).toBeInTheDocument()
}

describe('recommendation workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { categories: [] } })
  })

  test('submits the profile and opens model results', async () => {
    api.post.mockResolvedValue({ data: recommendation })
    renderFlow()
    await reachFinalStep()
    fireEvent.click(screen.getByRole('button', { name: /get recommendations/i }))

    expect(await screen.findByRole('heading', { name: /three options\. clear trade-offs/i })).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/recommend', expect.objectContaining({
      food_category: 'fruits',
      required_shelf_life_days: 14,
      sustainability_priority: 'high',
    }))
    expect(screen.getByRole('heading', { name: 'PET' })).toBeInTheDocument()
  })

  test('shows a pending state and then an API error', async () => {
    let rejectRequest
    api.post.mockReturnValue(new Promise((_, reject) => { rejectRequest = reject }))
    renderFlow()
    await reachFinalStep()
    fireEvent.click(screen.getByRole('button', { name: /get recommendations/i }))
    expect(screen.getByRole('button', { name: /analysing profile/i })).toBeDisabled()
    rejectRequest({ response: { data: { detail: 'Model is unavailable.' } } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Model is unavailable.')
    await waitFor(() => expect(screen.getByRole('button', { name: /get recommendations/i })).toBeEnabled())
  })
})
