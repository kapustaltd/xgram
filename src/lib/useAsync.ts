import { useCallback, useEffect, useRef, useState } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const run = useRef(0)

  const load = useCallback(() => {
    const id = ++run.current
    setLoading(true)
    setError(null)
    fn().then(
      (d) => {
        if (id !== run.current) return
        setData(d)
        setLoading(false)
      },
      (e: unknown) => {
        if (id !== run.current) return
        setError(e instanceof Error ? e : new Error(String((e as { errorMessage?: string })?.errorMessage ?? e)))
        setLoading(false)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    setData(undefined)
    load()
  }, [load])

  return { data, error, loading, reload: load, setData }
}
