import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import type { ReactElement } from 'react'

export function renderWithRouter(ui: ReactElement, { initialRoute = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </MemoryRouter>
  )
}
