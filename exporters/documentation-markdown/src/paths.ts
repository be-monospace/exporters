import { DocumentationLegacyGroup, DocumentationLegacyPage } from "@supernovaio/sdk-exporters"

/** Characters that are unsafe or awkward in file and directory names across platforms */
const INVALID_SEGMENT = /[<>:"/\\|?*\u0000-\u001F]/g
const COLLAPSE_DASH = /-+/g

export function sanitizePathSegment(raw: string, fallback: string): string {
  const trimmed = raw.trim()
  const base =
    trimmed.length > 0
      ? trimmed.replace(INVALID_SEGMENT, "-").replace(COLLAPSE_DASH, "-").replace(/^-+|-+$/g, "")
      : ""
  return base.length > 0 ? base : fallback
}

export function folderSegmentForGroup(group: DocumentationLegacyGroup): string {
  const raw = group.userSlug || group.slug || group.title
  return sanitizePathSegment(raw, "group")
}

export function fileBaseNameForPage(page: DocumentationLegacyPage): string {
  const raw = page.userSlug || page.slug || page.title
  return sanitizePathSegment(raw, "page")
}

/**
 * When `filters` is empty, returns `folderSegments` unchanged.
 * When non-empty, returns only segments below the deepest ancestor group whose
 * persistent id is in `filters`, or `null` if no ancestor matches.
 */
export function folderSegmentsForGroupFilter(
  folderSegments: Array<string>,
  ancestorGroupPersistentIds: Array<string>,
  filters: Set<string>
): Array<string> | null {
  if (filters.size === 0) {
    return folderSegments
  }
  let lastIdx = -1
  for (let i = ancestorGroupPersistentIds.length - 1; i >= 0; i--) {
    if (filters.has(ancestorGroupPersistentIds[i])) {
      lastIdx = i
      break
    }
  }
  if (lastIdx === -1) {
    return null
  }
  return folderSegments.slice(lastIdx + 1)
}
