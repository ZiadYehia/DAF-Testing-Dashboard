import { useState, useEffect } from 'react'
import type { AIModel } from '@/lib/ai'

export function useModels(defaultModel = 'gemini-2.5-flash') {
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedModel, setSelectedModel] = useState(defaultModel)

  useEffect(() => {
    fetch('/api/models')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AIModel[] | null) => {
        if (Array.isArray(data)) setModels(data)
      })
      .catch(() => {})
  }, [])

  return { models, selectedModel, setSelectedModel }
}
