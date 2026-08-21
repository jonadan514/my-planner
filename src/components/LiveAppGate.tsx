import { useEffect, useState, type ReactNode } from 'react'
import { initializeLiveApp } from '../integrations/liveApp'

interface LiveAppGateProps {
  children: ReactNode
}

type GateState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'switching' }
  | { status: 'error'; message: string }

export default function LiveAppGate({ children }: LiveAppGateProps) {
  const [state, setState] = useState<GateState>({ status: 'loading' })

  const retry = () => {
    setState({ status: 'loading' })
    void initializeLiveApp()
      .then(result => setState(result))
      .catch(error => setState({
        status: 'error',
        message: error instanceof Error ? error.message : '최신 앱을 불러오지 못했습니다.',
      }))
  }

  useEffect(() => {
    let active = true
    void initializeLiveApp()
      .then(result => { if (active) setState(result) })
      .catch(error => {
        if (active) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : '최신 앱을 불러오지 못했습니다.',
          })
        }
      })
    return () => { active = false }
  }, [])

  if (state.status === 'ready') return children

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-green-50 to-emerald-100 px-6 text-emerald-950">
      <section className="w-full max-w-sm rounded-3xl border border-emerald-100 bg-white/85 p-7 text-center shadow-xl shadow-emerald-900/10 backdrop-blur">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500 text-xl font-black">
          P
        </div>
        <h1 className="text-xl font-bold">Prec</h1>
        {state.status === 'error' ? (
          <>
            <p className="mt-3 text-sm leading-6 text-emerald-950/70">{state.message}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-6 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold transition hover:bg-emerald-400"
            >
              다시 시도
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm text-emerald-950/70">
            {state.status === 'switching' ? '최신 앱으로 전환하고 있습니다…' : '기록을 안전하게 준비하고 있습니다…'}
          </p>
        )}
      </section>
    </main>
  )
}
