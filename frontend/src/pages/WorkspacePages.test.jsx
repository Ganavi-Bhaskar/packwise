import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import api from '../services/api.js'
import Compare from './Compare.jsx'
import History from './History.jsx'
import Insights from './Insights.jsx'
import Materials from './Materials.jsx'

vi.mock('../services/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const catalogue = [
  { name: 'PET', otr: 90, wvtr: 4, cost_level: 'medium', recyclability: 78, biodegradability: 0, sustainability_score: 68, pros: ['Clear and strong'], cons: ['Not biodegradable'] },
  { name: 'Glass', otr: 0, wvtr: 0, cost_level: 'high', recyclability: 90, biodegradability: 0, sustainability_score: 75, pros: ['Excellent barrier'], cons: ['Heavy'] },
]

const comparedMaterials = catalogue.map((item, index) => ({
  material: item.name,
  probability: index ? 0.21 : 0.64,
  predicted_shelf_life_days: 18,
  suitability_score: index ? 65 : 82,
  cost_level: item.cost_level,
  sustainability_score: item.sustainability_score,
  recyclability: item.recyclability,
  biodegradability: item.biodegradability,
  pros: item.pros,
  cons: item.cons,
  explanation: `${item.name} fits the test profile.`,
  warnings: [],
}))

function renderPage(page) {
  return render(<MemoryRouter>{page}</MemoryRouter>)
}

describe('workspace pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
  })

  test('compare selects two materials and submits them to the compare endpoint', async () => {
    api.get.mockResolvedValue({ data: { materials: catalogue } })
    api.post.mockResolvedValue({ data: { materials: comparedMaterials } })
    renderPage(<Compare />)

    const checkboxes = await screen.findAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByRole('button', { name: /compare selected/i }))

    expect(await screen.findByRole('heading', { name: /material scorecard/i })).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/compare', expect.objectContaining({ material_names: ['PET', 'Glass'] }))
    expect(screen.getByRole('table', { name: /comparison of selected packaging materials/i })).toBeInTheDocument()
  })

  test('material library filters the grid and its details dialog closes accessibly', async () => {
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/materials' ? { materials: catalogue } : catalogue[0] }))
    renderPage(<Materials />)

    expect(await screen.findByRole('heading', { name: /know what goes into the pack/i })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: /search materials/i }), { target: { value: 'clear' } })
    expect(screen.getByRole('heading', { name: 'PET' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Glass' })).not.toBeInTheDocument()

    const detailsButton = screen.getByRole('button', { name: /view details for PET/i })
    detailsButton.focus()
    fireEvent.click(detailsButton)
    expect(await screen.findByRole('dialog', { name: /PET/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close dialog/i })).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(detailsButton).toHaveFocus()
  })

  test('history shows an empty state and filters by food category', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0, limit: 10, offset: 0 } })
    renderPage(<History />)

    expect(await screen.findByRole('heading', { name: /recommendation history/i })).toBeInTheDocument()
    expect(await screen.findByText(/no saved recommendations yet/i)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: /filter history by food category/i }), { target: { value: 'seafood' } })
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/history', { params: { limit: 10, offset: 0, food_category: 'seafood' } }))
  })

  test('model insights presents evaluation metrics and confusion matrix', async () => {
    api.get.mockResolvedValue({ data: {
      dataset: { rows: 5000, cross_validation_folds: 5, material_classes: ['PET', 'Glass'] },
      material_classifier: { selected_model: 'Logistic Regression', holdout_accuracy: 0.36, holdout_top_3_accuracy: 0.62, holdout_f1_macro: 0.28 },
      shelf_life_regressor: { selected_model: 'Random Forest', holdout_rmse_days: 27.2, holdout_r2: 0.88 },
      comparison: { classification: {}, regression: {} },
      feature_importance: [{ feature: 'fat_content', importance: 0.31 }],
      confusion_matrix: { labels: ['PET', 'Glass'], values: [[8, 2], [3, 7]] },
    } })
    renderPage(<Insights />)

    expect(await screen.findByRole('heading', { name: /performance, in context/i })).toBeInTheDocument()
    expect(screen.getByText('36.0%')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /confusion matrix for material classifier/i })).toBeInTheDocument()
    expect(screen.getByText(/synthetic, rule-generated data/i)).toBeInTheDocument()
  })
})
