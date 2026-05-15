import { CSSHelper, ColorFormat } from "@supernovaio/export-utils"
import type {
  DocumentationLegacyPageBlock,
  ElementProperty,
  Token,
  TokenGroup,
} from "@supernovaio/sdk-exporters"

export type TokenExportContext = {
  tokenByKey: Map<string, Token>
  tokenGroupByKey: Map<string, TokenGroup>
}

export type TokenTableRenderOptions = {
  /** Resolved tokens after applying theme stack; null hides the themed column */
  themedTokenMap: Map<string, Token> | null
  /** Table header for the themed column (e.g. theme names) */
  themedColumnHeader: string | null
  /** Block-level `userMetadata` flattened to string values — same cell on every row */
  blockMetadata: Record<string, string> | null
}

/** Build lookup maps keyed by persistent id and id-in-version (documentation blocks may use either). */
export function buildTokenExportContext(tokens: Array<Token>, tokenGroups: Array<TokenGroup>): TokenExportContext {
  const tokenByKey = new Map<string, Token>()
  for (const t of tokens) {
    tokenByKey.set(t.id, t)
    tokenByKey.set(t.idInVersion, t)
  }
  const tokenGroupByKey = new Map<string, TokenGroup>()
  for (const g of tokenGroups) {
    tokenGroupByKey.set(g.id, g)
    tokenGroupByKey.set(g.idInVersion, g)
    const raw = g.toWriteObject() as { persistentId?: string }
    if (raw.persistentId) {
      tokenGroupByKey.set(raw.persistentId, g)
    }
  }
  return { tokenByKey, tokenGroupByKey }
}

/** Same as buildTokenExportContext but tokens only (for themed token arrays). */
export function buildTokenKeyMap(tokens: Array<Token>): Map<string, Token> {
  const tokenByKey = new Map<string, Token>()
  for (const t of tokens) {
    tokenByKey.set(t.id, t)
    tokenByKey.set(t.idInVersion, t)
  }
  return tokenByKey
}

export function getTokenDisplayName(token: Token): string {
  const path = token.tokenPath
  if (path && path.length > 0) {
    return path.join("/")
  }
  return token.name
}

function escapeTableCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim()
}

const cssOptions = {
  allowReferences: false,
  decimals: 4,
  colorFormat: ColorFormat.smartHashHex,
  tokenToVariableRef: () => "",
}

function tokenToDisplayValue(token: Token, resolutionMap: Map<string, Token>): string {
  try {
    return CSSHelper.tokenToCSS(token, resolutionMap, cssOptions)
  } catch {
    try {
      return CSSHelper.tokenToCSS(token, resolutionMap, {
        ...cssOptions,
        allowReferences: true,
        tokenToVariableRef: (t: Token) => `{${getTokenDisplayName(t)}}`,
      })
    } catch {
      return "—"
    }
  }
}

/** Collect referenced token ids from a token value object (shallow walk). */
function collectReferencedTokenIds(value: unknown, out: Set<string>, depth: number): void {
  if (depth > 10 || value == null) return
  if (typeof value === "string") return
  if (typeof value !== "object") return
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedTokenIds(item, out, depth + 1)
    return
  }
  const o = value as Record<string, unknown>
  const ref = o.referencedTokenId
  if (typeof ref === "string" && ref.length > 0) {
    out.add(ref)
  }
  for (const v of Object.values(o)) {
    collectReferencedTokenIds(v, out, depth + 1)
  }
}

function primaryAliasDisplay(token: Token, ctx: TokenExportContext): string {
  const value = (token as unknown as { value?: unknown }).value
  const ids = new Set<string>()
  collectReferencedTokenIds(value, ids, 0)
  if (ids.size === 0) return ""
  const first = [...ids][0]
  const target = ctx.tokenByKey.get(first)
  return target ? getTokenDisplayName(target) : first
}

/**
 * Union of token custom properties that have a value on at least one token in the set.
 * Uses property `id` as stable column key.
 */
export function collectTokenPropertyColumns(tokens: Array<Token>): Array<{ propertyKey: string; header: string }> {
  const order: Array<string> = []
  const headerByKey = new Map<string, string>()
  for (const token of tokens) {
    const props = (token as unknown as { properties?: Array<ElementProperty> }).properties
    if (!props?.length) continue
    for (const prop of props) {
      const raw =
        token.propertyValues[prop.id] ??
        token.propertyValues[prop.idInVersion] ??
        token.propertyValues[prop.codeName]
      if (raw === undefined || raw === null || String(raw).trim() === "") continue
      if (!headerByKey.has(prop.id)) {
        headerByKey.set(prop.id, prop.codeName || prop.name)
        order.push(prop.id)
      }
    }
  }
  return order.map((propertyKey) => ({ propertyKey, header: headerByKey.get(propertyKey)! }))
}

function tokenCustomPropertyRaw(token: Token, propertyKey: string): string {
  const props = (token as unknown as { properties?: Array<ElementProperty> }).properties
  const prop = props?.find((p) => p.id === propertyKey)
  const raw =
    token.propertyValues[propertyKey] ??
    (prop ? token.propertyValues[prop.idInVersion] ?? token.propertyValues[prop.codeName] : undefined)
  if (raw === undefined || raw === null || String(raw).trim() === "") return ""
  return String(raw)
}

function tokenCustomPropertyCell(token: Token, propertyKey: string): string {
  return escapeTableCell(tokenCustomPropertyRaw(token, propertyKey))
}

/**
 * Tokens listed under a documentation token-group block (direct + optional nested groups).
 */
export function tokensForDocumentationTokenGroup(
  groupId: string,
  ctx: TokenExportContext,
  showNestedGroups: boolean
): Array<Token> {
  const root = ctx.tokenGroupByKey.get(groupId)
  if (!root) return []

  const out: Array<Token> = []
  const seen = new Set<string>()

  const visit = (g: TokenGroup) => {
    for (const tid of g.tokenIds ?? []) {
      const t = ctx.tokenByKey.get(tid)
      if (!t || seen.has(t.id)) continue
      seen.add(t.id)
      out.push(t)
    }
    if (showNestedGroups) {
      for (const sid of g.subgroupIds ?? []) {
        const sub = ctx.tokenGroupByKey.get(sid)
        if (sub) visit(sub)
      }
    }
  }

  visit(root)
  return out
}

export function tokensMarkdownTable(
  tokens: Array<Token>,
  ctx: TokenExportContext,
  render: TokenTableRenderOptions
): string {
  if (!tokens.length) return "_No tokens in this list._\n\n"

  const metaKeys = render.blockMetadata ? Object.keys(render.blockMetadata) : []
  const metaHeaders = metaKeys.map((k) => escapeTableCell(k))
  const propCols = collectTokenPropertyColumns(tokens)
  const propHeaders = propCols.map((c) => escapeTableCell(c.header))

  const includeThemed = Boolean(render.themedTokenMap && render.themedColumnHeader)
  const themedHeader = includeThemed ? escapeTableCell(render.themedColumnHeader!) : ""

  const headerParts = ["Token", "Value", "Alias"]
  if (includeThemed) headerParts.push(themedHeader)
  headerParts.push(...metaHeaders, ...propHeaders)

  const sepParts = headerParts.map(() => "---")

  const rows = tokens.map((t) => {
    const name = escapeTableCell(getTokenDisplayName(t))
    const value = escapeTableCell(tokenToDisplayValue(t, ctx.tokenByKey))
    const alias = escapeTableCell(primaryAliasDisplay(t, ctx))
    const parts = [name, value, alias]

    if (includeThemed && render.themedTokenMap) {
      const themed =
        render.themedTokenMap.get(t.id) ??
        render.themedTokenMap.get(t.idInVersion) ??
        null
      const themedVal = themed ? escapeTableCell(tokenToDisplayValue(themed, render.themedTokenMap)) : ""
      parts.push(themedVal)
    }

    if (render.blockMetadata) {
      for (const k of metaKeys) {
        parts.push(escapeTableCell(render.blockMetadata[k] ?? ""))
      }
    }

    for (const col of propCols) {
      parts.push(tokenCustomPropertyCell(t, col.propertyKey))
    }

    return `| ${parts.join(" | ")} |`
  })

  const header = `| ${headerParts.join(" | ")} |`
  const sep = `| ${sepParts.join(" | ")} |`
  return [header, sep, ...rows].join("\n") + "\n\n"
}

export function tokensMarkdownList(
  tokens: Array<Token>,
  ctx: TokenExportContext,
  render: TokenTableRenderOptions
): string {
  if (!tokens.length) return "_No tokens in this list._\n\n"
  const propColsAll = collectTokenPropertyColumns(tokens)
  return (
    tokens
      .map((t) => {
        const name = getTokenDisplayName(t)
        const value = tokenToDisplayValue(t, ctx.tokenByKey)
        const alias = primaryAliasDisplay(t, ctx)
        const aliasPart = alias ? ` → _${alias}_` : ""

        let themedPart = ""
        if (render.themedTokenMap && render.themedColumnHeader) {
          const themed =
            render.themedTokenMap.get(t.id) ??
            render.themedTokenMap.get(t.idInVersion) ??
            null
          const tv = themed ? tokenToDisplayValue(themed, render.themedTokenMap) : ""
          if (tv) {
            themedPart = ` · _${render.themedColumnHeader}: \`${tv}\`_`
          }
        }

        let metaPart = ""
        if (render.blockMetadata) {
          const bits = Object.entries(render.blockMetadata).map(([k, v]) => `${k}=${v}`)
          if (bits.length) metaPart = ` · _${bits.join(", ")}_`
        }

        const propBits: Array<string> = []
        for (const col of propColsAll) {
          const raw = tokenCustomPropertyRaw(t, col.propertyKey)
          if (!raw) continue
          propBits.push(`${col.header}: ${raw}`)
        }
        const propPart = propBits.length ? ` · _${propBits.join("; ")}_` : ""

        return `- **${name}** — \`${value}\`${aliasPart}${themedPart}${metaPart}${propPart}`
      })
      .join("\n") + "\n\n"
  )
}

/** Pipeline + per-block theme resolution for token tables/lists. */
export type TokenBlockRenderContext = {
  pipelineThemeIds: string[]
  themeNameById: Map<string, string>
  resolveThemedTokenMap: (themeIds: string[]) => Map<string, Token> | null
}

export function flattenBlockUserMetadata(userMetadata: unknown): Record<string, string> | null {
  if (userMetadata == null || typeof userMetadata !== "object" || Array.isArray(userMetadata)) {
    return null
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(userMetadata as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v)
  }
  return Object.keys(out).length > 0 ? out : null
}

export function effectiveThemeIdsForBlock(
  block: DocumentationLegacyPageBlock,
  pipelineThemeIds: string[]
): string[] {
  const theme = block.theme
  if (theme && Array.isArray(theme.themeIds) && theme.themeIds.length > 0) {
    // Prefer block-level theme stack for both Override and Comparison (and any future type):
    // the documentation UI stores the ids the author picked; `type` only describes the editor mode.
    return theme.themeIds.map((id) => String(id).trim()).filter((id) => id.length > 0)
  }
  return pipelineThemeIds.map((id) => id.trim()).filter((id) => id.length > 0)
}

export function buildTokenTableRenderOptions(
  block: DocumentationLegacyPageBlock,
  themeCtx: TokenBlockRenderContext
): TokenTableRenderOptions {
  const themeIds = effectiveThemeIdsForBlock(block, themeCtx.pipelineThemeIds)
  const themedMap =
    themeIds.length > 0 ? themeCtx.resolveThemedTokenMap(themeIds) : null
  let themedHeader: string | null = null
  if (themedMap && themeIds.length > 0) {
    themedHeader =
      themeIds.map((id) => themeCtx.themeNameById.get(id) ?? id).join(" + ") || "Themed value"
  }
  return {
    themedTokenMap: themedMap,
    themedColumnHeader: themedHeader,
    blockMetadata: flattenBlockUserMetadata(
      (block as unknown as { userMetadata?: unknown }).userMetadata
    ),
  }
}
