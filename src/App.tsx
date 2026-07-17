import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Home } from './pages/Home'
import { Practice } from './pages/Practice'
import { Stats } from './pages/Stats'
import { BottomNav } from './components/BottomNav'

function Shell() {
  const location = useLocation()
  const showNav = location.pathname !== '/practice'

  return (
    <div className="min-h-full bg-white dark:bg-neutral-950">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/stats" element={<Stats />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

export default App
