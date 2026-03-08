// Simple mock authentication provider for development
import React, { createContext, useContext } from 'react'

const AuthContext = createContext()

// Mock user for development
const mockUser = {
  id: 'dev-user-1',
  email: 'developer@test.com',
  role: 'admin'
}

export function AuthProvider({ children }) {
  const authValue = {
    user: mockUser,
    loading: false,
    login: async () => ({ user: mockUser }),
    logout: async () => {},
    signUp: async () => ({ user: mockUser })
  }

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}