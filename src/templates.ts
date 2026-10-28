export type Language = 'python' | 'c' | 'cpp' | 'java'

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'python', label: 'Python' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
]

export const DEFAULT_LANGUAGE: Language = 'python'

export function languageLabel(lang: Language): string {
  return LANGUAGES.find((l) => l.id === lang)?.label ?? lang
}

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.id === value)
}

export const TEMPLATES: Record<Language, string> = {
  python: `# Paste the question here as a comment.

def main():
    print("Hello, world!")


if __name__ == "__main__":
    main()
`,
  c: `// Paste the question here as a comment.

#include <stdio.h>

int main(void) {
    printf("Hello, world!\\n");
    return 0;
}
`,
  cpp: `// Paste the question here as a comment.

#include <bits/stdc++.h>
using namespace std;

int main() {
    cout << "Hello, world!" << endl;
    return 0;
}
`,
  java: `// Paste the question here as a comment.

import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}
`,
}

/** True when the code is empty or still exactly one of the starter templates. */
export function isUnmodifiedTemplate(code: string): boolean {
  const trimmed = code.trim()
  return trimmed === '' || Object.values(TEMPLATES).some((t) => t.trim() === trimmed)
}
