import { useState, useEffect } from 'react'

const LOGIN_HISTORY_KEY = 'loginHistory'
const MAX_HISTORY_ITEMS = 5

export interface LoginHistoryItem {
  email?: string
  username?: string
  timestamp: number
}

export const useLoginHistory = () => {
  const [history, setHistory] = useState<LoginHistoryItem[]>([])

  useEffect(() => {
    const savedHistory = localStorage.getItem(LOGIN_HISTORY_KEY)
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setHistory(parsed)
      } catch (error) {
        console.error('Error parsing login history:', error)
      }
    }
  }, [])

  const addToHistory = (item: Omit<LoginHistoryItem, 'timestamp'>) => {
    const newItem: LoginHistoryItem = {
      ...item,
      timestamp: Date.now()
    }

    const updatedHistory = [
      newItem,
      ...history.filter(h => 
        h.email !== item.email && h.username !== item.username
      )
    ].slice(0, MAX_HISTORY_ITEMS)

    setHistory(updatedHistory)
    localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(updatedHistory))
  }

  const getSuggestions = (): string[] => {
    const suggestions: string[] = []
    
    history.forEach(item => {
      if (item.email && !suggestions.includes(item.email)) {
        suggestions.push(item.email)
      }
      if (item.username && !suggestions.includes(item.username)) {
        suggestions.push(item.username)
      }
    })

    return suggestions
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(LOGIN_HISTORY_KEY)
  }

  return {
    history,
    addToHistory,
    getSuggestions,
    clearHistory
  }
}