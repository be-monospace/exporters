import { FileHelper } from "@supernovaio/export-utils"
import {
  AnyOutputFile,
  DocumentationLegacyGroup,
  DocumentationLegacyItemType,
  DocumentationLegacyPage,
  PulsarContext,
  Supernova,
} from "@supernovaio/sdk-exporters"
import { ExporterConfiguration } from "../config"
import { fileBaseNameForPage, folderSegmentForGroup, folderSegmentsForGroupFilter } from "./paths"
import { loadDocumentationRootGroup } from "./load-documentation-root"
import { legacyPageToMarkdown } from "./legacy-page-to-markdown"
import { buildSkillMarkdown } from "./skill-md"

export const exportConfiguration = Pulsar.exportConfig<ExporterConfiguration>()

function joinPosix(...parts: Array<string>): string {
  return parts
    .flatMap((p) => p.split("/"))
    .filter((segment) => segment.length > 0)
    .join("/")
}

type PageWalkEntry = {
  page: DocumentationLegacyPage
  /** Folder path segments from the documentation root down to this page's parent group */
  folderSegments: Array<string>
  /** Persistent ids of ancestor groups (same order as folderSegments) */
  ancestorGroupPersistentIds: Array<string>
}

type GroupExportMeta = {
  title: string
  filteredSegments: Array<string> | null
}

/**
 * Walk `rootGroup` to collect pages with hierarchy. Does not rely on `page.parent`
 * (Forge `allPages` is flat and may omit parent wiring).
 */
function collectPagesWithPaths(
  group: DocumentationLegacyGroup,
  folderSegments: Array<string>,
  ancestorGroupPersistentIds: Array<string>,
  bucket: Array<PageWalkEntry>
): void {
  for (const child of group.children ?? []) {
    if (child.type === DocumentationLegacyItemType.page) {
      bucket.push({
        page: child as DocumentationLegacyPage,
        folderSegments: [...folderSegments],
        ancestorGroupPersistentIds: [...ancestorGroupPersistentIds],
      })
    } else if (child.type === DocumentationLegacyItemType.group) {
      const g = child as DocumentationLegacyGroup
      const nextSegments = g.isRoot ? folderSegments : [...folderSegments, folderSegmentForGroup(g)]
      const nextIds = g.isRoot ? ancestorGroupPersistentIds : [...ancestorGroupPersistentIds, g.persistentId]
      collectPagesWithPaths(g, nextSegments, nextIds, bucket)
    }
  }
}

/** Map each non-root group persistent id → title and export folder segments (after group filter). */
function collectGroupExportMeta(
  group: DocumentationLegacyGroup,
  folderSegments: Array<string>,
  ancestorGroupPersistentIds: Array<string>,
  groupFilter: Set<string>,
  out: Map<string, GroupExportMeta>
): void {
  for (const child of group.children ?? []) {
    if (child.type !== DocumentationLegacyItemType.group) {
      continue
    }
    const g = child as DocumentationLegacyGroup
    const nextSegments = g.isRoot ? folderSegments : [...folderSegments, folderSegmentForGroup(g)]
    const nextIds = g.isRoot ? ancestorGroupPersistentIds : [...ancestorGroupPersistentIds, g.persistentId]
    if (!g.isRoot) {
      const filtered = folderSegmentsForGroupFilter(nextSegments, nextIds, groupFilter)
      out.set(g.persistentId, { title: g.title, filteredSegments: filtered })
    }
    collectGroupExportMeta(g, nextSegments, nextIds, groupFilter, out)
  }
}

/** Pages under `groupId` (inclusive of nested groups), in documentation tree order. */
function pagesInGroupSubtreeOrdered(
  entries: Array<PageWalkEntry>,
  groupId: string,
  groupFilter: Set<string>,
  excludeHiddenAndPrivate: boolean
): Array<DocumentationLegacyPage> {
  const out: Array<DocumentationLegacyPage> = []
  for (const e of entries) {
    if (excludeHiddenAndPrivate && (e.page.isHidden || e.page.isPrivate)) {
      continue
    }
    if (!e.ancestorGroupPersistentIds.includes(groupId)) {
      continue
    }
    const filtered = folderSegmentsForGroupFilter(e.folderSegments, e.ancestorGroupPersistentIds, groupFilter)
    if (filtered === null) {
      continue
    }
    out.push(e.page)
  }
  return out
}

Pulsar.export(async (sdk: Supernova, context: PulsarContext): Promise<Array<AnyOutputFile>> => {
  const remote = {
    workspaceId: context.wsId,
    designSystemId: context.dsId,
    versionId: context.versionId,
  }

  const rootGroup = await loadDocumentationRootGroup(sdk, remote)

  const groupFilter = new Set(
    exportConfiguration.includedDocumentationGroupPersistentIds.map((id) => id.trim()).filter((id) => id.length > 0)
  )

  const pagesWithPaths: Array<PageWalkEntry> = []
  collectPagesWithPaths(rootGroup, [], [], pagesWithPaths)

  const groupMeta = new Map<string, GroupExportMeta>()
  collectGroupExportMeta(rootGroup, [], [], groupFilter, groupMeta)

  const usedKeys = new Map<string, number>()
  const outputFiles: Array<AnyOutputFile> = []

  for (const { page, folderSegments, ancestorGroupPersistentIds } of pagesWithPaths) {
    if (exportConfiguration.excludeHiddenAndPrivate && (page.isHidden || page.isPrivate)) {
      continue
    }

    const innerSegments = folderSegmentsForGroupFilter(folderSegments, ancestorGroupPersistentIds, groupFilter)
    if (innerSegments === null) {
      continue
    }

    const relativePath = joinPosix(exportConfiguration.outputFolder, ...innerSegments)
    pushMarkdownFile(page, relativePath, usedKeys, outputFiles)
  }

  const skillGroupIds = exportConfiguration.skillExportGroupPersistentIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0)

  for (const skillGroupId of skillGroupIds) {
    const meta = groupMeta.get(skillGroupId)
    if (!meta || meta.filteredSegments === null) {
      continue
    }

    const skillPages = pagesInGroupSubtreeOrdered(
      pagesWithPaths,
      skillGroupId,
      groupFilter,
      exportConfiguration.excludeHiddenAndPrivate
    )
    if (skillPages.length === 0) {
      continue
    }

    const skillRelativePath = joinPosix(exportConfiguration.outputFolder, ...meta.filteredSegments)
    const skillContent = buildSkillMarkdown({
      pages: skillPages,
      groupTitle: meta.title,
      frontmatterNameOverride: exportConfiguration.skillFrontmatterName,
      frontmatterDescriptionOverride: exportConfiguration.skillFrontmatterDescription,
      markdownFlavor: exportConfiguration.markdownFlavor,
      includePageHeadings: exportConfiguration.skillIncludePageHeadings,
    })

    outputFiles.push(
      FileHelper.createTextFile({
        relativePath: skillRelativePath,
        fileName: "SKILL.md",
        content: skillContent,
      })
    )
  }

  return outputFiles
})

function pushMarkdownFile(
  page: DocumentationLegacyPage,
  relativePath: string,
  usedKeys: Map<string, number>,
  outputFiles: Array<AnyOutputFile>
): void {
  const baseName = fileBaseNameForPage(page)
  const collisionKey = `${relativePath}/${baseName}`
  const index = usedKeys.get(collisionKey) ?? 0
  usedKeys.set(collisionKey, index + 1)
  const disambiguatedBase = index === 0 ? baseName : `${baseName}-${index}`
  const content = legacyPageToMarkdown(page, exportConfiguration.markdownFlavor)
  outputFiles.push(
    FileHelper.createTextFile({
      relativePath,
      fileName: `${disambiguatedBase}.md`,
      content,
    })
  )
}
