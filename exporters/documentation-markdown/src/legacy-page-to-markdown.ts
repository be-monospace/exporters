import type { DocumentationLegacyPage, DocumentationLegacyPageBlock } from "@supernovaio/sdk-exporters"

const MAX_DEPTH = 12

const PROPERTY_VALUE_KEYS = [
  "markdown",
  "text",
  "body",
  "content",
  "richText",
  "value",
  "description",
  "caption",
  "label",
  "title",
]

/**
 * Converts a documentation legacy page to Markdown without using
 * `MarkdownTransform` (not available / not a constructor in the Pulsar webpack stub).
 */
export function legacyPageToMarkdown(page: DocumentationLegacyPage, _flavor: "github" | "commonmark"): string {
  const chunks: Array<string> = []
  for (const block of page.blocks ?? []) {
    chunks.push(blockToMarkdown(block as DocumentationLegacyPageBlock))
  }
  return chunks.join("\n").trimEnd() + "\n"
}

function blockType(block: DocumentationLegacyPageBlock): string {
  const t = (block as unknown as { type?: unknown }).type
  return typeof t === "string" ? t : String(t ?? "")
}

function blockToMarkdown(block: DocumentationLegacyPageBlock): string {
  const typeStr = blockType(block)
  const b = block as unknown as Record<string, unknown>

  switch (typeStr) {
    case "Text":
      return paragraphRichText(b.text) + "\n\n"
    case "Heading": {
      const level = headingLevel(b.headingType)
      const inner = richTextToMarkdown(b.text).trim()
      if (!inner) return `<!-- empty heading (level ${level}) -->\n\n`
      return `${"#".repeat(level)} ${inner}\n\n`
    }
    case "Code": {
      const lang = String((b.codeLanguage as string | null | undefined) ?? "").trim()
      const body = richTextToPlain(b.text) || richTextToMarkdown(b.text)
      const fence = "```"
      return `${fence}${lang}\n${String(body ?? "").replace(/\n$/, "")}\n${fence}\n\n`
    }
    case "RenderCode": {
      const lang = String((b.codeLanguage as string | null | undefined) ?? "").trim()
      const body = typeof b.code === "string" ? b.code : richTextToPlain(b.text)
      const fence = "```"
      return `${fence}${lang}\n${String(body ?? "").replace(/\n$/, "")}\n${fence}\n\n`
    }
    case "Quote": {
      const inner = richTextToMarkdown(b.text).trim()
      const lines = inner.split("\n").filter((l) => l.length > 0)
      return lines.map((l) => `> ${l}`).join("\n") + "\n\n"
    }
    case "Callout": {
      const inner = richTextToMarkdown(b.text).trim()
      return `> **Callout${b.calloutType != null ? ` (${String(b.calloutType)})` : ""}**\n> ${inner.replace(/\n/g, "\n> ")}\n\n`
    }
    case "Divider":
      return "---\n\n"
    case "Image": {
      const url = (b.url as string | null) ?? (b.asset as { url?: string } | null)?.url ?? ""
      const caption = (b.caption as string | null) ?? ""
      if (!url) return `<!-- image: empty -->\n\n`
      const alt = caption || "image"
      return `![${escapeAlt(alt)}](${url})\n\n`
    }
    case "Token":
      return `<!-- token: ${String(b.tokenId ?? "")} -->\n\n`
    case "TokenGroup":
      return `<!-- token group: ${String(b.groupId ?? "")} -->\n\n`
    case "TokenList": {
      const ids =
        (b.tokenIds as string[] | undefined) ??
        (b.designObjectIds as string[] | undefined) ??
        []
      return ids.length ? `<!-- token list: ${ids.join(", ")} -->\n\n` : `<!-- token list: (empty) -->\n\n`
    }
    case "Shortcuts": {
      const shortcuts = (b.shortcuts as Array<{ title?: string; url?: string }> | undefined) ?? []
      if (!shortcuts.length) return ""
      const lines = shortcuts.map((s) => `- [${s.title ?? "link"}](${s.url ?? ""})`)
      return `${lines.join("\n")}\n\n`
    }
    case "Link": {
      const url = (b.url as string | null) ?? ""
      return url ? `[${escapeLinkLabel(String(b.title ?? url))}](${url})\n\n` : `<!-- link: no url -->\n\n`
    }
    case "Embed": {
      const url = (b.url as string | null) ?? ""
      const title = (b.title as string | null) ?? (b.caption as string | null) ?? url
      return url ? `[${escapeLinkLabel(String(title))}](${url})\n\n` : `<!-- embed: no url -->\n\n`
    }
    case "FigmaEmbed":
    case "YoutubeEmbed":
    case "StorybookEmbed":
      return `<!-- ${typeStr}: ${String(b.url ?? "")} -->\n\n`
    case "UnorderedList":
    case "OrderedList":
      return listBlockToMarkdown(block, typeStr === "OrderedList")
    case "Table":
      return tableToMarkdown(block)
    case "Column":
    case "ColumnItem":
    case "Tabs":
    case "Tab":
    case "TabItem": {
      const caption = typeof b.caption === "string" ? `**${b.caption}**\n\n` : ""
      const inner = childrenToMarkdown(block)
      return caption + inner
    }
    case "Custom":
      return customBlockToMarkdown(block, b) + "\n\n"
    case "ComponentAssets":
    case "FigmaFrames":
      return `<!-- ${typeStr} -->\n\n`
    default:
      return childrenToMarkdown(block) || `<!-- block: ${typeStr} -->\n\n`
  }
}

function customBlockToMarkdown(block: DocumentationLegacyPageBlock, b: Record<string, unknown>): string {
  const key = String((b.key as string) ?? (b.variantKey as string) ?? (b.customBlockKey as string) ?? "custom")
  const parts: Array<string> = []

  const fromChildren = childrenToMarkdown(block).trim()
  if (fromChildren) parts.push(fromChildren)

  const propsObj = (b.properties as Record<string, unknown> | null | undefined) ?? undefined
  if (propsObj && typeof propsObj === "object" && !Array.isArray(propsObj)) {
    const fromProps = valueFromCustomPropertiesObject(propsObj, 0)
    if (fromProps) parts.push(fromProps)
  }

  const propArray = b.customBlockProperties as Array<{ key?: string; value?: unknown }> | undefined
  if (Array.isArray(propArray)) {
    for (const entry of propArray) {
      const md = valueToMarkdown(entry?.value, 0)
      if (md) parts.push(md)
    }
  }

  if (!parts.length) {
    return `<!-- custom block: ${key} (no extractable text) -->`
  }
  return parts.join("\n\n")
}

function valueFromCustomPropertiesObject(props: Record<string, unknown>, depth: number): string {
  if (depth > MAX_DEPTH) return ""
  const chunks: Array<string> = []
  for (const pref of PROPERTY_VALUE_KEYS) {
    if (pref in props && props[pref] != null) {
      const md = valueToMarkdown(props[pref], depth + 1)
      if (md) chunks.push(md)
    }
  }
  if (chunks.length) return chunks.join("\n\n")

  for (const v of Object.values(props)) {
    const md = valueToMarkdown(v, depth + 1)
    if (md) chunks.push(md)
  }
  return chunks.join("\n\n")
}

function valueToMarkdown(value: unknown, depth: number): string {
  if (value == null || depth > MAX_DEPTH) return ""
  if (typeof value === "string") {
    const t = value.trim()
    return t.length ? t : ""
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => valueToMarkdown(v, depth + 1))
      .filter((s) => s.length > 0)
      .join("\n\n")
  }
  if (typeof value !== "object") return ""

  const o = value as Record<string, unknown>

  if (typeof o.asPlainText === "function") {
    try {
      const plain = String((o as { asPlainText: () => string }).asPlainText() ?? "").trim()
      if (plain) return plain
    } catch {
      /* continue */
    }
  }

  const fromRich = richTextToMarkdown(o)
  if (fromRich.trim()) return fromRich

  if (o.type === "doc" && Array.isArray(o.content)) {
    return proseMirrorDocToMarkdown(o)
  }

  for (const k of PROPERTY_VALUE_KEYS) {
    if (k in o && o[k] != null) {
      const inner = valueToMarkdown(o[k], depth + 1)
      if (inner) return inner
    }
  }

  const stringValues = Object.values(o).filter((v) => typeof v === "string" && String(v).trim()) as string[]
  if (stringValues.length) return stringValues.join("\n\n")

  const nested = Object.values(o)
    .filter((v) => v != null && typeof v === "object")
    .map((v) => valueToMarkdown(v, depth + 1))
    .filter((s) => s.length > 0)
  return nested.join("\n\n")
}

function proseMirrorDocToMarkdown(doc: Record<string, unknown>): string {
  const content = doc.content
  if (!Array.isArray(content)) return ""
  return content
    .map((node) => pmBlockToMarkdown(node))
    .filter((s) => s.length > 0)
    .join("\n\n")
}

function pmBlockToMarkdown(node: unknown): string {
  if (!node || typeof node !== "object") return ""
  const n = node as Record<string, unknown>
  const t = n.type
  const typeName = typeof t === "string" ? t : typeof t === "object" && t && "name" in (t as object) ? String((t as { name: string }).name) : ""

  if (typeName === "paragraph") return pmInlineToMarkdown(n.content)
  if (typeName === "heading") {
    const level = Math.min(6, Math.max(1, Number((n.attrs as { level?: number } | undefined)?.level ?? 2)))
    const hashes = "#".repeat(level)
    const inner = pmInlineToMarkdown(n.content).trim()
    return inner ? `${hashes} ${inner}` : ""
  }
  if (typeName === "bulletList" || typeName === "orderedList") {
    const items = Array.isArray(n.content) ? n.content : []
    return items
      .map((li, i) => {
        const prefix = typeName === "orderedList" ? `${i + 1}. ` : "- "
        const body = pmBlockToMarkdown(li).replace(/\n/g, typeName === "orderedList" ? "\n   " : "\n  ")
        return `${prefix}${body}`
      })
      .join("\n")
  }
  if (typeName === "listItem") {
    const inner = Array.isArray(n.content) ? n.content.map(pmBlockToMarkdown).filter(Boolean).join("\n") : ""
    return inner
  }
  if (typeName === "codeBlock") {
    const text = pmInlineToMarkdown(n.content).replace(/\n$/, "")
    const lang = String((n.attrs as { language?: string } | undefined)?.language ?? "").trim()
    return "```" + lang + "\n" + text + "\n```"
  }
  if (Array.isArray(n.content)) {
    return n.content.map(pmBlockToMarkdown).filter(Boolean).join("\n")
  }
  return ""
}

function pmInlineToMarkdown(content: unknown): string {
  if (!Array.isArray(content)) return ""
  return content.map(pmInlineNodeToMarkdown).join("")
}

function pmMarkType(mark: Record<string, unknown>): string {
  const t = mark.type
  if (typeof t === "string") return t
  if (t && typeof t === "object" && "name" in (t as object)) {
    return String((t as { name: string }).name)
  }
  return ""
}

function pmInlineNodeToMarkdown(node: unknown): string {
  if (!node || typeof node !== "object") return ""
  const n = node as Record<string, unknown>
  const typeName =
    typeof n.type === "string"
      ? n.type
      : n.type && typeof n.type === "object" && "name" in (n.type as object)
        ? String((n.type as { name: string }).name)
        : ""

  if (typeName === "text") {
    let text = String(n.text ?? "")
    const marks = (n.marks as Array<Record<string, unknown>> | undefined) ?? []
    for (const m of marks) {
      const mt = pmMarkType(m)
      const href = (m.attrs as { href?: string } | undefined)?.href
      if (mt === "bold" || mt === "strong") text = `**${text}**`
      else if (mt === "italic" || mt === "em") text = `*${text}*`
      else if (mt === "code") text = "`" + text.replace(/`/g, "\\`") + "`"
      else if ((mt === "link" || mt === "linkMark") && href) text = `[${escapeLinkLabel(text)}](${href})`
    }
    return text
  }
  if (typeName === "hardBreak") return "\n"
  return ""
}

function childrenToMarkdown(block: DocumentationLegacyPageBlock): string {
  const kids = (block as unknown as { children?: DocumentationLegacyPageBlock[] }).children
  if (!kids?.length) return ""
  return kids.map((c) => blockToMarkdown(c)).join("")
}

function listBlockToMarkdown(block: DocumentationLegacyPageBlock, ordered: boolean): string {
  const kids = (block as unknown as { children?: DocumentationLegacyPageBlock[] }).children
  if (kids?.length) {
    return (
      kids
        .map((child, i) => {
          const prefix = ordered ? `${i + 1}. ` : "- "
          const body = blockToMarkdown(child).trim()
          const cont = ordered ? "\n   " : "\n  "
          return `${prefix}${body.replace(/\n/g, cont)}`
        })
        .join("\n") + "\n\n"
    )
  }
  const textMd = richTextToMarkdown((block as unknown as { text?: unknown }).text).trim()
  if (!textMd) return "\n"
  return (
    textMd
      .split("\n")
      .map((line, i) => `${ordered ? `${i + 1}.` : "-"} ${line}`)
      .join("\n") + "\n\n"
  )
}

function tableToMarkdown(block: DocumentationLegacyPageBlock): string {
  const kids = (block as unknown as { children?: DocumentationLegacyPageBlock[] }).children
  if (!kids?.length) return `<!-- table: no rows -->\n\n`

  const rows: string[][] = []
  for (const row of kids) {
    if (blockType(row) !== "TableRow") continue
    const cells = (row as unknown as { children?: DocumentationLegacyPageBlock[] }).children ?? []
    const cellTexts: string[] = []
    for (const cell of cells) {
      if (blockType(cell) !== "TableCell") continue
      const inner = childrenToMarkdown(cell).trim().replace(/\|/g, "\\|").replace(/\n/g, "<br/>")
      cellTexts.push(inner || " ")
    }
    if (cellTexts.length) rows.push(cellTexts)
  }
  if (!rows.length) return `<!-- table: empty -->\n\n`

  const colCount = Math.max(...rows.map((r) => r.length))
  const normalized = rows.map((r) => {
    const copy = [...r]
    while (copy.length < colCount) copy.push(" ")
    return copy
  })

  const header = normalized[0]
  const sep = header.map(() => "---")
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...normalized.slice(1).map((r) => `| ${r.join(" | ")} |`),
  ]
  return `${lines.join("\n")}\n\n`
}

function headingLevel(raw: unknown): number {
  if (typeof raw === "number" && raw >= 1 && raw <= 6) return raw
  const n = Number(raw)
  if (n >= 1 && n <= 6) return n
  return 2
}

function paragraphRichText(rich: unknown): string {
  return richTextToMarkdown(rich).trim()
}

function richTextToPlain(rich: unknown): string {
  if (!rich) return ""
  if (typeof rich === "string") return rich
  const rt = rich as { asPlainText?: () => string; spans?: Array<{ text?: string }> }
  if (typeof rt.asPlainText === "function") {
    try {
      return rt.asPlainText() ?? ""
    } catch {
      /* fall through */
    }
  }
  const spans = rt.spans ?? []
  return spans.map((s) => s.text ?? "").join("")
}

function richTextToMarkdown(rich: unknown): string {
  if (!rich) return ""
  if (typeof rich === "string") return rich

  const rt = rich as Record<string, unknown>

  if (typeof rt.asPlainText === "function") {
    try {
      const plain = String((rt as { asPlainText: () => string }).asPlainText() ?? "")
      if (plain.trim()) return plain
    } catch {
      /* continue */
    }
  }

  const spans = rt.spans as Array<Record<string, unknown>> | undefined
  if (Array.isArray(spans) && spans.length > 0) {
    const out = spans.map((s) => spanToMarkdown(s)).join("")
    if (out.trim()) return out
  }

  if (rt.type === "doc" && Array.isArray(rt.content)) {
    return proseMirrorDocToMarkdown(rt)
  }

  if (typeof rt.text === "string" && rt.text.trim()) {
    return rt.text
  }

  return ""
}

function spanToMarkdown(span: Record<string, unknown>): string {
  let text = String(span.text ?? "")
  const attrs = (span.attributes as Array<Record<string, unknown>> | undefined) ?? []
  const types = new Set(attrs.map((a) => String(a.type ?? "")))

  const link = attrs.find((a) => String(a.type) === "Link")
  const url = (link?.link as string | undefined) ?? ""

  if (!text.trim() && !url && !types.has("Code")) {
    return ""
  }

  if (types.has("Code")) {
    return "`" + text.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`"
  }

  if (url) {
    text = `[${escapeLinkLabel(text || url)}](${url})`
  }
  if (types.has("Bold")) text = `**${text}**`
  if (types.has("Italic")) text = `*${text}*`
  if (types.has("Strikethrough")) text = `~~${text}~~`
  return text
}

function escapeAlt(s: string): string {
  return s.replace(/]/g, "\\]").replace(/\[/g, "\\[")
}

function escapeLinkLabel(s: string): string {
  return s.replace(/\]/g, "\\]").replace(/\[/g, "\\[")
}
