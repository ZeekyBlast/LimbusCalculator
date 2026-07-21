import { useEffect, useState } from 'react'
import type { Identity } from '../types'

export function useIdentities() {
  const [identities, setIdentities] = useState<Identity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/gamedata/identities.json')
      .then(res => res.json())
      .then((data: Identity[]) => setIdentities(data))
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  return { identities, loading, error }
}
