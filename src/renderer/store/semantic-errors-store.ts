import { create } from 'zustand'

export interface SemanticError {
  id: string
  file: string
  phase: string
  message: string
  timestamp: number
}

interface SemanticErrorsState {
  errors: SemanticError[]
  addError: (error: Omit<SemanticError, 'id'>) => void
  clearErrors: () => void
}

let nextId = 0

export const useSemanticErrorsStore = create<SemanticErrorsState>((set) => ({
  errors: [],

  addError: (error) => {
    const id = `sem-err-${++nextId}`
    set((state) => ({
      errors: [{ ...error, id }, ...state.errors]
    }))
  },

  clearErrors: () => {
    set({ errors: [] })
  }
}))
