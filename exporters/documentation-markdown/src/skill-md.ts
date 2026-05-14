import type { DocumentationLegacyPage } from "@supernovaio/sdk-exporters"
import { legacyPageToMarkdown } from "./legacy-page-to-markdown"

export type SkillMarkdownOptions = {
  pages: Array<DocumentationLegacyPage>
  groupTitle: string
  frontmatterNameOverride: string
  frontmatterDescriptionOverride: string
  markdownFlavor: "commonmark" | "github"
  includePageHeadings: boolean
}

/**
 * Builds a single SKILL.md document: YAML frontmatter + concatenated page bodies.
 */
export function buildSkillMarkdown(options: SkillMarkdownOptions): string {
  const name = (options.frontmatterNameOverride.trim() || options.groupTitle || "Skill").trim()
  const desc = options.frontmatterDescriptionOverride.trim()

  const yamlLines = ["---", `name: ${yamlString(name)}`]
  if (desc.length > 0) {
    yamlLines.push(`description: ${yamlString(desc)}`)
  }
  yamlLines.push("---", "")

  const bodyParts: Array<string> = []

  for (const page of options.pages) {
    const pageMd = legacyPageToMarkdown(page, options.markdownFlavor).trim()
    if (!pageMd) continue

    if (options.includePageHeadings) {
      const title = (page.title ?? "Untitled").trim()
      bodyParts.push(`## ${title}`, "", pageMd, "")
    } else {
      bodyParts.push(pageMd, "")
    }
  }

  return `${yamlLines.join("\n")}${bodyParts.join("\n").trimEnd()}\n`
}

/** YAML-safe double-quoted scalar using JSON encoding rules */
function yamlString(value: string): string {
  return JSON.stringify(value)
}
