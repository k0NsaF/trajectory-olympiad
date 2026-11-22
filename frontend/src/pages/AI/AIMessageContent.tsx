import type { ReactNode } from 'react'

interface AIMessageContentProps {
  content: string
}

function normalizeMarkdown(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\\([*_~|#>\-.])/g, '$1')
    .replace(/&#x20;|&#32;|&nbsp;/gi, ' ')
    .replace(/&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function renderInline(value: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+?\*\*|__[^_]+?__|~~[^~]+?~~|`[^`]+`|\*[^*\n]+?\*|_[^_\n]+?_|https?:\/\/[^\s<>]+)/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index))
    }

    const token = match[0]
    const key = `${keyPrefix}-${index++}`
    const markdownLink = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)

    if (markdownLink) {
      nodes.push(
        <a href={markdownLink[2]} key={key} target="_blank" rel="noopener noreferrer">
          {markdownLink[1]}
        </a>
      )
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>)
    } else if (token.startsWith('~~')) {
      nodes.push(<del key={key}>{renderInline(token.slice(2, -2), key)}</del>)
    } else if (token.startsWith('`')) {
      nodes.push(<code className="ai-markdown-inline-code" key={key}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>)
    } else {
      const trailing = token.match(/[.,!?;:]+$/)?.[0] ?? ''
      const href = trailing ? token.slice(0, -trailing.length) : token
      nodes.push(
        <span key={key}>
          <a href={href} target="_blank" rel="noopener noreferrer">{href}</a>
          {trailing}
        </span>
      )
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex))
  }

  return nodes
}

function isTableDivider(line: string): boolean {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell))
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

interface ListMarker {
  indent: number
  ordered: boolean
  content: string
}

function getListMarker(line: string): ListMarker | null {
  const match = line.match(/^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/)
  if (!match) return null
  return {
    indent: match[1].replace(/\t/g, '  ').length,
    ordered: Boolean(match[3]),
    content: match[4]
  }
}

function isListLine(line: string): boolean {
  return getListMarker(line) !== null
}

function startsBlock(line: string, nextLine?: string): boolean {
  return (
    /^\s*#{1,6}\s+/.test(line) ||
    /^\s*```/.test(line) ||
    /^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line) ||
    /^\s*>/.test(line) ||
    isListLine(line) ||
    (Boolean(nextLine) && line.includes('|') && isTableDivider(nextLine ?? ''))
  )
}

export function AIMessageContent({ content }: AIMessageContentProps) {
  const lines = normalizeMarkdown(content).split('\n')
  const blocks: ReactNode[] = []
  let lineIndex = 0
  let blockIndex = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const nextLine = lines[lineIndex + 1]

    if (!line.trim()) {
      lineIndex += 1
      continue
    }

    const blockKey = `ai-block-${blockIndex++}`

    if (/^\s*```/.test(line)) {
      const codeLines: string[] = []
      lineIndex += 1
      while (lineIndex < lines.length && !/^\s*```/.test(lines[lineIndex])) {
        codeLines.push(lines[lineIndex])
        lineIndex += 1
      }
      if (lineIndex < lines.length) lineIndex += 1
      blocks.push(
        <pre className="ai-markdown-code-block" key={blockKey}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = Math.min(heading[1].length, 4)
      const headingContent = renderInline(heading[2].trim(), blockKey)
      if (level === 1) blocks.push(<h1 key={blockKey}>{headingContent}</h1>)
      else if (level === 2) blocks.push(<h2 key={blockKey}>{headingContent}</h2>)
      else if (level === 3) blocks.push(<h3 key={blockKey}>{headingContent}</h3>)
      else blocks.push(<h4 key={blockKey}>{headingContent}</h4>)
      lineIndex += 1
      continue
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<hr key={blockKey} />)
      lineIndex += 1
      continue
    }

    if (line.includes('|') && nextLine && isTableDivider(nextLine)) {
      const headers = splitTableRow(line)
      const rows: string[][] = []
      lineIndex += 2
      while (lineIndex < lines.length && lines[lineIndex].trim() && lines[lineIndex].includes('|')) {
        rows.push(splitTableRow(lines[lineIndex]))
        lineIndex += 1
      }
      blocks.push(
        <div className="ai-markdown-table-wrap" key={blockKey}>
          <table>
            <thead>
              <tr>{headers.map((cell, cellIndex) => <th key={`${blockKey}-head-${cellIndex}`}>{renderInline(cell, `${blockKey}-head-${cellIndex}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${blockKey}-row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`${blockKey}-${rowIndex}-${cellIndex}`}>
                      {renderInline(row[cellIndex] ?? '', `${blockKey}-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (isListLine(line)) {
      const firstMarker = getListMarker(line)
      if (!firstMarker) {
        lineIndex += 1
        continue
      }

      const listItems: ReactNode[] = []
      while (lineIndex < lines.length) {
        const itemMarker = getListMarker(lines[lineIndex])
        if (!itemMarker || itemMarker.indent !== firstMarker.indent || itemMarker.ordered !== firstMarker.ordered) {
          break
        }

        const itemIndex = listItems.length
        const itemContent = itemMarker.content
        lineIndex += 1
        const nestedGroups: Array<{ ordered: boolean; items: string[] }> = []

        while (lineIndex < lines.length) {
          const nestedMarker = getListMarker(lines[lineIndex])
          if (!nestedMarker || nestedMarker.indent <= firstMarker.indent) break

          const nestedIndent = nestedMarker.indent
          const nestedOrdered = nestedMarker.ordered
          const nestedItems: string[] = []

          while (lineIndex < lines.length) {
            const currentNested = getListMarker(lines[lineIndex])
            if (!currentNested || currentNested.indent !== nestedIndent || currentNested.ordered !== nestedOrdered) {
              break
            }
            nestedItems.push(currentNested.content)
            lineIndex += 1
          }

          nestedGroups.push({ ordered: nestedOrdered, items: nestedItems })
        }

        listItems.push(
          <li key={`${blockKey}-item-${itemIndex}`}>
            {renderInline(itemContent, `${blockKey}-item-${itemIndex}`)}
            {nestedGroups.map((group, groupIndex) => {
              const nestedListItems = group.items.map((nestedItem, nestedIndex) => (
                <li key={`${blockKey}-${itemIndex}-${groupIndex}-${nestedIndex}`}>
                  {renderInline(nestedItem, `${blockKey}-${itemIndex}-${groupIndex}-${nestedIndex}`)}
                </li>
              ))
              return group.ordered
                ? <ol key={`${blockKey}-nested-${groupIndex}`}>{nestedListItems}</ol>
                : <ul key={`${blockKey}-nested-${groupIndex}`}>{nestedListItems}</ul>
            })}
          </li>
        )
      }

      blocks.push(firstMarker.ordered ? <ol key={blockKey}>{listItems}</ol> : <ul key={blockKey}>{listItems}</ul>)
      continue
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = []
      while (lineIndex < lines.length && /^\s*>/.test(lines[lineIndex])) {
        quoteLines.push(lines[lineIndex].replace(/^\s*>\s?/, ''))
        lineIndex += 1
      }
      blocks.push(
        <blockquote key={blockKey}>
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={`${blockKey}-quote-${quoteIndex}`}>{renderInline(quoteLine, `${blockKey}-quote-${quoteIndex}`)}</p>
          ))}
        </blockquote>
      )
      continue
    }

    const paragraphLines = [line.trim()]
    lineIndex += 1
    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim() &&
      !startsBlock(lines[lineIndex], lines[lineIndex + 1])
    ) {
      paragraphLines.push(lines[lineIndex].trim())
      lineIndex += 1
    }
    blocks.push(
      <p key={blockKey}>
        {paragraphLines.map((paragraphLine, paragraphIndex) => (
          <span key={`${blockKey}-line-${paragraphIndex}`}>
            {paragraphIndex > 0 ? ' ' : null}
            {renderInline(paragraphLine, `${blockKey}-line-${paragraphIndex}`)}
          </span>
        ))}
      </p>
    )
  }

  return <div className="ai-markdown">{blocks}</div>
}
