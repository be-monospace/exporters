import { DocumentationLegacyGroup, Supernova } from "@supernovaio/sdk-exporters"

export type DocumentationRemoteVersion = {
  workspaceId: string
  designSystemId: string
  versionId: string
}

type DocumentationArea = {
  getFullDocumentationLegacyRepresentation?: (
    from: DocumentationRemoteVersion
  ) => Promise<{ rootGroup: DocumentationLegacyGroup }>
  getDocumentationFromRoot?: (from: DocumentationRemoteVersion) => Promise<DocumentationLegacyGroup>
}

/**
 * Forge exposes `getFullDocumentationLegacyRepresentation`; older runtimes may
 * only implement `getDocumentationFromRoot` (same tree shape at `rootGroup`).
 */
export async function loadDocumentationRootGroup(
  sdk: Supernova,
  from: DocumentationRemoteVersion
): Promise<DocumentationLegacyGroup> {
  const doc = sdk.documentation as unknown as DocumentationArea

  if (typeof doc.getFullDocumentationLegacyRepresentation === "function") {
    const full = await doc.getFullDocumentationLegacyRepresentation(from)
    return full.rootGroup
  }

  if (typeof doc.getDocumentationFromRoot === "function") {
    return doc.getDocumentationFromRoot(from)
  }

  throw new Error(
    "This Supernova runtime does not expose a supported documentation tree API. " +
      "Expected `sdk.documentation.getFullDocumentationLegacyRepresentation` (Forge) " +
      "or `sdk.documentation.getDocumentationFromRoot`."
  )
}
