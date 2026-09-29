import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Footer from './components/Footer.jsx'
import Navbar from './components/Navbar.jsx'
import { ErrorBoundary, Loader } from './components/ui.jsx'
import { ThemeProvider } from './hooks/ThemeProvider.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const Recommend = lazy(() => import('./pages/Recommend.jsx'))
const Results = lazy(() => import('./pages/Results.jsx'))
const Compare = lazy(() => import('./pages/Compare.jsx'))
const Materials = lazy(() => import('./pages/Materials.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const Insights = lazy(() => import('./pages/Insights.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

export default function App() {
  return (
    <ThemeProvider>
      <div className="app-shell">
        <Navbar />
        <ErrorBoundary>
          <Suspense fallback={<div className="route-loading"><Loader label="Loading page" /></div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/recommend" element={<Recommend />} />
              <Route path="/results" element={<Results />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/materials" element={<Materials />} />
              <Route path="/history" element={<History />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
        <Footer />
      </div>
    </ThemeProvider>
  )
}
