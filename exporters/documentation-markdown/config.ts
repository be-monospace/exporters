/**
 * Main configuration of the exporter - type interface. Default values for it can be set through `config.json` and users can override the behavior when creating the pipelines.
 */
export type ExporterConfiguration = {
  /** Root folder in the export output where Markdown files are written */
  outputFolder: string
  /** Markdown dialect passed to the built-in converter */
  markdownFlavor: "commonmark" | "github"
  /**
   * Persistent IDs of documentation groups to export (including every page and subgroup inside them).
   * Leave empty to export the full documentation tree. Use a group's persistent ID from Supernova (for example from the documentation URL or developer tools).
   */
  includedDocumentationGroupPersistentIds: Array<string>
  /** When true, pages and groups marked hidden or private are skipped */
  excludeHiddenAndPrivate: boolean
  /**
   * Documentation groups (persistent IDs) for which an additional `SKILL.md` is written
   * in that group's export folder, aggregating all pages in the group's subtree (in tree order).
   * Leave empty to skip skill export.
   */
  skillExportGroupPersistentIds: Array<string>
  /**
   * Optional YAML `name` in `SKILL.md` frontmatter. When empty, the documentation group's title is used.
   */
  skillFrontmatterName: string
  /**
   * Optional YAML `description` in `SKILL.md` frontmatter. When empty, the field is omitted or left empty.
   */
  skillFrontmatterDescription: string
  /**
   * When true, each page section in `SKILL.md` is prefixed with `## {page title}` before the page body.
   */
  skillIncludePageHeadings: boolean
}
