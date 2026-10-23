import { useEffect, useRef, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { Phone, QrCode } from 'lucide-react'
import { Logo, LogoOutline } from '../components/Logo'
import { Button, Modal, ModalClose, Spinner, TextField as Field } from '../components/ui'
import { errorText, liveConfigured, useApp } from '../store'

type Step = 'phone' | 'code' | 'password' | 'qr'

function Flow({ step: initial, onClose }: { step: Step; onClose: () => void }) {
  const { selectMode, finishLogin } = useApp()
  const [step, setStep] = useState<Step>(initial)
  const [phone, setPhone] = useState('+7')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (step !== 'qr') return
    const ctrl = new AbortController()
    selectMode('live')
      .then((api) =>
        api.qrLogin((url) => setQr(url), ctrl.signal).then((res) => {
          if (ctrl.signal.aborted) return
          if (res === 'password') setStep('password')
          else return finishLogin()
        }),
      )
      .catch((e) => !ctrl.signal.aborted && setError(errorText(e)))
    return () => ctrl.abort()
  }, [step, selectMode, finishLogin])

  useEffect(() => {
    if (qr && canvas.current) QRCode.toCanvas(canvas.current, qr, { width: 240, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
  }, [qr])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Step, [string, string?]> = {
    phone: ['Введите номер телефона', 'Мы отправим код подтверждения в Telegram.'],
    code: ['Мы отправили вам код', `Проверьте Telegram на другом устройстве. Код отправлен на ${phone}.`],
    password: ['Введите пароль', 'У аккаунта включена двухэтапная аутентификация.'],
    qr: ['Войдите по QR-коду'],
  }
  const [title, sub] = titles[step]

  let body: ReactNode
  let action: ReactNode
  if (step === 'phone') {
    body = <Field label="Номер телефона" value={phone} onChange={setPhone} type="tel" inputMode="tel" autoFocus />
    action = (
      <Button size="lg" className="w-full" disabled={busy || phone.replace(/\D/g, '').length < 8} onClick={() => run(async () => {
        const api = await selectMode('live')
        await api.sendCode(phone)
        setStep('code')
      })}>
        Далее
      </Button>
    )
  } else if (step === 'code') {
    body = <Field label="Код подтверждения" value={code} onChange={setCode} inputMode="numeric" autoFocus />
    action = (
      <Button size="lg" className="w-full" disabled={busy || code.length < 4} onClick={() => run(async () => {
        const api = await selectMode('live')
        const res = await api.signIn(code)
        if (res === 'password') setStep('password')
        else await finishLogin()
      })}>
        Войти
      </Button>
    )
  } else if (step === 'password') {
    body = <Field label="Пароль" value={password} onChange={setPassword} type="password" autoFocus />
    action = (
      <Button size="lg" className="w-full" disabled={busy || !password} onClick={() => run(async () => {
        const api = await selectMode('live')
        await api.checkPassword(password)
        await finishLogin()
      })}>
        Войти
      </Button>
    )
  } else {
    body = (
      <div className="flex flex-col items-center gap-6">
        <div className="flex size-[256px] items-center justify-center rounded-md bg-white p-2">
          {qr ? <canvas ref={canvas} /> : <Spinner />}
        </div>
        <ol className="flex list-decimal flex-col gap-2 ps-5 text-body text-secondary">
          <li>Откройте Telegram на телефоне</li>
          <li>
            Перейдите в <b className="text-primary">Настройки → Устройства → Подключить устройство</b>
          </li>
          <li>Наведите камеру на этот код</li>
        </ol>
      </div>
    )
  }

  return (
    <>
      <div className="relative flex h-[53px] shrink-0 items-center justify-center px-2">
        <ModalClose onClose={onClose} className="absolute start-2" />
        <Logo className="size-8" />
      </div>
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-8 pt-4 pb-12 sm:px-20">
        <div className="flex flex-col gap-2">
          <h2 className="text-title3 font-extrabold">{title}</h2>
          {sub && <p className="text-body text-secondary">{sub}</p>}
        </div>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            ;(e.currentTarget.querySelector('button:not([disabled])') as HTMLButtonElement | null)?.click()
          }}
        >
          {body}
          {error && <p className="text-subtext1 text-x-red">{error}</p>}
          {action}
        </form>
        {step === 'phone' && (
          <button type="button" className="w-fit text-body text-brand hover:underline" onClick={() => setStep('qr')}>
            Войти по QR-коду
          </button>
        )}
        {step === 'qr' && (
          <button type="button" className="w-fit text-body text-brand hover:underline" onClick={() => setStep('phone')}>
            Войти по номеру телефона
          </button>
        )}
      </div>
    </>
  )
}

export function Login() {
  const { selectMode, finishLogin } = useApp()
  const [flow, setFlow] = useState<Step | null>(null)
  const [demoBusy, setDemoBusy] = useState(false)

  async function demo() {
    setDemoBusy(true)
    const api = await selectMode('demo')
    await api.signIn('')
    await finishLogin()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex items-center p-8 lg:flex-1 lg:justify-center">
          <LogoOutline className="hidden max-h-[380px] w-full max-w-[380px] text-primary/80 lg:block" />
          <Logo className="size-12 lg:hidden" />
        </div>
        <div className="flex flex-col justify-center gap-10 p-8 lg:flex-1 lg:p-4">
          <h1 className="text-[40px] leading-[48px] font-extrabold tracking-tight sm:text-[64px] sm:leading-[76px]">В курсе происходящего.</h1>
          <div className="flex max-w-[380px] flex-col gap-4">
            <Button size="md" className="h-10 w-full" disabled={!liveConfigured} onClick={() => setFlow('phone')}>
              <Phone className="size-[18px]" /> Войти по номеру телефона
            </Button>
            <Button size="md" variant="outline" className="h-10 w-full" disabled={!liveConfigured} onClick={() => setFlow('qr')}>
              <QrCode className="size-[18px]" /> Войти по QR-коду
            </Button>
            <div className="flex items-center gap-2 text-body text-secondary">
              <span className="h-px flex-1 bg-divider" /> или <span className="h-px flex-1 bg-divider" />
            </div>
            <Button size="md" variant="brand" className="h-10 w-full" disabled={demoBusy} onClick={demo}>
              Демо
            </Button>
            {!liveConfigured && (
              <p className="text-subtext2 text-secondary">
                Чтобы войти в настоящий Telegram, получите <b className="text-primary">api_id</b> и <b className="text-primary">api_hash</b> на{' '}
                <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  my.telegram.org
                </a>{' '}
                и укажите их в <code className="rounded-xs bg-hover-subtle px-1">.env</code> (см. .env.example).
              </p>
            )}
          </div>
        </div>
      </div>
      <Modal open={!!flow} onClose={() => setFlow(null)} label="Вход" className="sm:min-h-[650px]">
        {flow && <Flow step={flow} onClose={() => setFlow(null)} />}
      </Modal>
    </div>
  )
}
