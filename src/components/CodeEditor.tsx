import { useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { MonacoBinding } from 'y-monaco'
import { monaco } from '../monaco'
import type { Room } from '../room'
import type { Language } from '../templates'
import type { Theme } from '../hooks/useTheme'

const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  autoIndent: 'full',
  bracketPairColorization: { enabled: true },
  matchBrackets: 'always',
  lineNumbers: 'on',
  minimap: { enabled: false },
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
  wordWrap: 'on',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontSize: 14,
  lineHeight: 21,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  renderLineHighlight: 'line',
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  padding: { top: 12 },
  quickSuggestions: false,
  wordBasedSuggestions: 'off',
}

interface Props {
  room: Room
  language: Language
  theme: Theme
  readOnly: boolean
  /** Phone layout: smaller font and gutter. */
  compact: boolean
  onRun: () => void
}

export function CodeEditor({ room, language, theme, readOnly, compact, onRun }: Props) {
  const onRunRef = useRef(onRun)
  useEffect(() => {
    onRunRef.current = onRun
  }, [onRun])

  const handleMount: OnMount = (editor) => {
    const model = editor.getModel()
    if (!model) return
    // Normalise line endings so every peer's model matches the shared text.
    model.setEOL(monaco.editor.EndOfLineSequence.LF)
    const binding = new MonacoBinding(room.code, model, new Set([editor]), room.awareness)
    editor.onDidDispose(() => binding.destroy())
    // Both Ctrl+Enter and Cmd+Enter, on every platform (CtrlCmd alone is only ⌘ on macOS).
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current())
    editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.Enter, () => onRunRef.current())
    editor.focus()
  }

  return (
    <Editor
      className="code-editor"
      theme={theme === 'dark' ? 'scratchroom-dark' : 'scratchroom-light'}
      language={language}
      options={{
        ...EDITOR_OPTIONS,
        readOnly,
        ...(compact && { fontSize: 13, lineHeight: 19, lineNumbersMinChars: 2, folding: false, padding: { top: 8 } }),
      }}
      onMount={handleMount}
      loading={<div className="panel-placeholder">Loading editor…</div>}
    />
  )
}
