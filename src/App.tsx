import { useCallback, useEffect, useRef, useState } from 'react'
import { CodeEditor } from './components/CodeEditor'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Presence } from './components/Presence'
import { RemoteCursorStyles } from './components/RemoteCursorStyles'
import { ResultsPanel } from './components/ResultsPanel'
import { SplitPane } from './components/SplitPane'
import { StdinPanel } from './components/StdinPanel'
import { useToast } from './components/Toast'
import { TopBar } from './components/TopBar'
import { copyText } from './clipboard'
import { useConnectionStatus, usePeers } from './hooks/usePresence'
import { usePythonStatus } from './hooks/usePythonStatus'
import { useTheme } from './hooks/useTheme'
import { useYMapValue } from './hooks/useYMapValue'
import { formatCode, type Room } from './room'
import { runCode } from './run/runner'
import { isRunResult } from './run/types'
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  isUnmodifiedTemplate,
  languageLabel,
  TEMPLATES,
  type Language,
} from './templates'

interface RunningBy {
  clientId: number
  name: string
  at: number
}

export default function App({ room }: { room: Room }) {
  const [theme, toggleTheme] = useTheme()
  const storedLanguage = useYMapValue<string>(room.meta, 'language')
  const language: Language = isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE
  const storedResult = useYMapValue<unknown>(room.meta, 'lastResult')
  const lastResult = isRunResult(storedResult) ? storedResult : undefined
  const runningBy = useYMapValue<RunningBy>(room.meta, 'runningBy')
  const [running, setRunning] = useState(false)
  const runningRef = useRef(false)
  const pythonStatus = usePythonStatus()
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null)
  const peers = usePeers(room.awareness)
  const connection = useConnectionStatus(room.provider)
  const [toast, showToast] = useToast()
  const sessionCode = formatCode(room.id)

  const copyCode = async () => {
    showToast((await copyText(sessionCode)) ? 'Copied!' : `Couldn’t copy. The code is ${sessionCode}`)
  }

  // Nothing is stored, so if you're alone, leaving the page loses the code. Ask first.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const alone = room.awareness.getStates().size <= 1
      if (alone && !isUnmodifiedTemplate(room.code.toString())) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [room])

  const applyLanguage = useCallback(
    (next: Language, replaceCode: boolean) => {
      room.doc.transact(() => {
        room.meta.set('language', next)
        if (replaceCode) {
          room.code.delete(0, room.code.length)
          room.code.insert(0, TEMPLATES[next])
        }
      })
    },
    [room],
  )

  const onLanguageChange = (next: Language) => {
    if (next === language) return
    if (isUnmodifiedTemplate(room.code.toString())) applyLanguage(next, true)
    else setPendingLanguage(next)
  }

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    const me = room.awareness.getLocalState()?.user?.name as string | undefined
    const stored = room.meta.get('language')
    const lang: Language = isLanguage(stored) ? stored : DEFAULT_LANGUAGE
    room.meta.set('runningBy', { clientId: room.doc.clientID, name: me ?? '', at: Date.now() })
    try {
      const result = await runCode(lang, room.code.toString(), room.stdin.toString())
      room.doc.transact(() => {
        room.meta.set('lastResult', { ...result, ranBy: me, ranById: room.doc.clientID })
        const current = room.meta.get('runningBy') as RunningBy | undefined
        if (current?.clientId === room.doc.clientID) room.meta.delete('runningBy')
      })
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }, [room])

  // What the results header says while code is running, here or elsewhere.
  let runningLabel: string | null = null
  if (running) {
    runningLabel = language === 'python' && pythonStatus !== 'ready' ? 'Starting Python…' : 'Running…'
  } else if (
    runningBy &&
    runningBy.clientId !== room.doc.clientID &&
    // Ignore it if that person has since left mid-run.
    peers.some((p) => p.clientId === runningBy.clientId)
  ) {
    runningLabel = `${runningBy.name || 'Someone'} is running the code…`
  }

  // Ctrl/Cmd+Enter from anywhere outside the editor (the editor has its own binding).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return
      if (e.target instanceof Element && e.target.closest('.monaco-editor')) return
      e.preventDefault()
      run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run])

  return (
    <div className="app">
      <TopBar
        language={language}
        onLanguageChange={onLanguageChange}
        running={running}
        canRun
        onRun={run}
        sessionCode={sessionCode}
        onCopyCode={copyCode}
        presence={<Presence peers={peers} status={connection} onRename={room.setNickname} />}
        theme={theme}
        onToggleTheme={toggleTheme}
        disabled={false}
      />
      <main className="workspace">
        <SplitPane
          left={
            <CodeEditor room={room} language={language} theme={theme} readOnly={false} onRun={run} />
          }
          right={
            <div className="side-panel">
              <ResultsPanel
                result={lastResult}
                ranBy={
                  peers.find((p) => p.clientId === lastResult?.ranById)?.user.name ?? lastResult?.ranBy
                }
                runningLabel={runningLabel}
                pythonStatus={language === 'python' ? pythonStatus : null}
              />
              <StdinPanel stdin={room.stdin} readOnly={false} />
            </div>
          }
        />
      </main>

      <RemoteCursorStyles peers={peers} />
      {toast}

      {pendingLanguage && (
        <ConfirmDialog
          message={`Replace code with the ${languageLabel(pendingLanguage)} template?`}
          confirmLabel="Replace"
          cancelLabel="Keep my code"
          onConfirm={() => {
            applyLanguage(pendingLanguage, true)
            setPendingLanguage(null)
          }}
          onCancel={() => {
            applyLanguage(pendingLanguage, false)
            setPendingLanguage(null)
          }}
        />
      )}
    </div>
  )
}
