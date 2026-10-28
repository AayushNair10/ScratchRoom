import { useCallback, useEffect, useState } from 'react'
import { CodeEditor } from './components/CodeEditor'
import { ConfirmDialog } from './components/ConfirmDialog'
import { ResultsPanel } from './components/ResultsPanel'
import { SplitPane } from './components/SplitPane'
import { StdinPanel } from './components/StdinPanel'
import { TopBar } from './components/TopBar'
import { useTheme } from './hooks/useTheme'
import { useYMapValue } from './hooks/useYMapValue'
import type { Room } from './room'
import type { RunResult } from './run/types'
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  isUnmodifiedTemplate,
  languageLabel,
  TEMPLATES,
  type Language,
} from './templates'

export default function App({ room }: { room: Room }) {
  const [theme, toggleTheme] = useTheme()
  const storedLanguage = useYMapValue<string>(room.meta, 'language')
  const language: Language = isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE
  const lastResult = useYMapValue<RunResult>(room.meta, 'lastResult')
  const [running] = useState(false)
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null)

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

  const run = useCallback(() => {
    // Wired up in milestone 3.
  }, [])

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
        canRun={false}
        onRun={run}
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
              <ResultsPanel result={lastResult} running={running} />
              <StdinPanel stdin={room.stdin} readOnly={false} />
            </div>
          }
        />
      </main>

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
