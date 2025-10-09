import { Supernova, PulsarContext, RemoteVersionIdentifier, AnyOutputFile, Token, TokenType, TokenTheme } from "@supernovaio/sdk-exporters"
import { ThemeHelper, StringCase, TokenNameTracker, WriteTokenPropStore, NamingHelper } from "@supernovaio/export-utils"
import { createCatalogRootFile, createPerTokenFile } from "./files/color-sets"
import { ExporterConfiguration } from "../config"

/**
 * Xcode Color Set Exporter (Proof of Concept)
 *
 * What this exporter does:
 * - Reads color tokens from the current design system version
 * - Optionally applies selected themes to compute themed values per token
 * - Generates an Xcode asset catalog with one color set per color token
 * - Each color set file (Contents.json) is an array with:
 *   - One base entry (universal)
 *   - One themed entry marked as { appearances: [{ appearance: "luminosity", value: "dark" }] }
 *
 * Theme application rules (per request):
 * - If there is only 1 selected theme: apply it as dark appearance (single themed entry)
 * - If there are 2+ selected themes: apply the FIRST theme to the base value and the SECOND theme
 *   as dark appearance; ignore any other themes
 *
 * Output location options:
 * - generateRootCatalog (boolean): when true, create the root catalog folder and its Contents.json
 * - rootCatalogPath (string): root path for the catalog; can include "/" to create nested folders
 */
export const exportConfiguration = Pulsar.exportConfig<ExporterConfiguration>()

Pulsar.export(async (sdk: Supernova, context: PulsarContext): Promise<Array<AnyOutputFile>> => {
  // Identify which design system + version we are exporting from
  const remoteVersionIdentifier: RemoteVersionIdentifier = {
    designSystemId: context.dsId,
    versionId: context.versionId,
  }

  // Fetch tokens and token groups from the selected design system version
  let tokens = await sdk.tokens.getTokens(remoteVersionIdentifier)
  let tokenGroups = await sdk.tokens.getTokenGroups(remoteVersionIdentifier)

  // Only color tokens are relevant for Xcode color sets
  let colorTokens = tokens.filter((t) => t.tokenType === TokenType.color)

  // Resolve selected themes (if any)
  let themesToApply: Array<TokenTheme> = []
  if (context.themeIds && context.themeIds.length > 0) {
    const themes = await sdk.tokens.getTokenThemes(remoteVersionIdentifier)
    themesToApply = context.themeIds.map((themeId) => {
      const theme = themes.find((t) => t.id === themeId || t.idInVersion === themeId)
      if (!theme) {
        throw new Error(`Unable to find theme ${themeId}`)
      }
      return theme
    })
  }

  // Filter out primitive tokens when themes are selected and filtering is enabled
  if (exportConfiguration.excludePrimitivesInThemePipelines && themesToApply.length > 0 && exportConfiguration.primitiveCollections.length > 0) {
    // Create a set of primitive collection names for efficient lookup
    const primitiveCollectionSet = new Set(exportConfiguration.primitiveCollections)
    
    // Debug: Log the configuration and first few tokens
    console.log("=== PRIMITIVE FILTERING DEBUG ===")
    console.log("🔧 Configuration:")
    console.log("  Full exportConfiguration object:", JSON.stringify(exportConfiguration, null, 2))
    console.log("  excludePrimitivesInThemePipelines:", exportConfiguration.excludePrimitivesInThemePipelines)
    console.log("  themesToApply.length:", themesToApply.length)
    console.log("  themesToApply:", themesToApply)
    console.log("  primitiveCollections:", exportConfiguration.primitiveCollections)
    
    // Additional debugging for configuration keys
    console.log("🔍 Configuration keys:", Object.keys(exportConfiguration))
    console.log("🔍 Has excludePrimitivesInThemePipelines?", 'excludePrimitivesInThemePipelines' in exportConfiguration)
    console.log("🔍 Has primitiveCollections?", 'primitiveCollections' in exportConfiguration)
    
    // Debug: Show what configuration fields ARE available
    console.log("🔍 Available configuration fields:")
    Object.keys(exportConfiguration).forEach(key => {
      console.log(`  ${key}:`, exportConfiguration[key])
    })
    
    const originalCount = colorTokens.length
    console.log("📊 Token counts:")
    console.log("  Total color tokens before filtering:", originalCount)
    
    // Check if filtering conditions are met
    const conditionsMet = exportConfiguration.excludePrimitivesInThemePipelines && 
                         themesToApply.length > 0 && 
                         exportConfiguration.primitiveCollections.length > 0
    console.log("✅ Filtering conditions met:", conditionsMet)
    
    if (!conditionsMet) {
      console.log("❌ Filtering will NOT be applied because:")
      if (!exportConfiguration.excludePrimitivesInThemePipelines) console.log("  - excludePrimitivesInThemePipelines is false")
      if (themesToApply.length === 0) console.log("  - No themes selected")
      if (exportConfiguration.primitiveCollections.length === 0) console.log("  - No primitive collections configured")
    }
    
    // Debug: Log first few tokens and their properties
    colorTokens.slice(0, 3).forEach((token, index) => {
      console.log(`Token ${index + 1}:`, {
        name: token.name,
        properties: token.properties,
        propertiesLength: token.properties?.length || 0
      })
      if (token.properties && token.properties.length > 0) {
        token.properties.forEach((prop, propIndex) => {
          console.log(`  Property ${propIndex + 1}:`, {
            name: prop.name,
            keys: Object.keys(prop),
            fullProperty: prop
          })
        })
      }
    })
    
    // Filter out tokens that belong to primitive collections
    colorTokens = colorTokens.filter((token) => {
      // Check if the token has a "Collection" custom property
      if (token.properties && token.properties.length > 0) {
        const collectionProperty = token.properties.find(prop => prop.name === "Collection")
        if (collectionProperty) {
          // Try different possible property value access patterns
          let collectionValue = null;
          
          // Pattern 1: Direct value
          if ((collectionProperty as any).value && typeof (collectionProperty as any).value === 'string') {
            collectionValue = (collectionProperty as any).value;
          }
          // Pattern 2: Nested value (data.value)
          else if ((collectionProperty as any).data?.value) {
            collectionValue = (collectionProperty as any).data.value;
          }
          // Pattern 3: Text property
          else if ((collectionProperty as any).text) {
            collectionValue = (collectionProperty as any).text;
          }
          // Pattern 4: Complex nested (value.value)
          else if ((collectionProperty as any).value?.value) {
            collectionValue = (collectionProperty as any).value.value;
          }
          // Pattern 5: Array values
          else if ((collectionProperty as any).values && Array.isArray((collectionProperty as any).values)) {
            collectionValue = (collectionProperty as any).values[0]; // Take first value
          }
          
          console.log(`Token "${token.name}" has Collection property:`, {
            property: collectionProperty,
            extractedValue: collectionValue,
            shouldExclude: collectionValue ? primitiveCollectionSet.has(collectionValue) : false
          })
          
          if (collectionValue) {
            // If the collection value matches any configured primitive collection, exclude the token
            return !primitiveCollectionSet.has(collectionValue)
          }
        }
      }
      
      // If no Collection property exists, keep the token
      return true
    })
    
    console.log("📊 Results:")
    console.log("  Total color tokens after filtering:", colorTokens.length)
    console.log("  Tokens excluded:", (originalCount - colorTokens.length), "← This should show the difference")
    console.log("=== END DEBUG ===")
  }

  // Prepare output files and, depending on configuration, prepare root path/file
  const files: Array<AnyOutputFile> = []
  const rootPath = exportConfiguration.generateRootCatalog ? (exportConfiguration.rootCatalogPath || "Colors.xcassets") : ""
  if (exportConfiguration.generateRootCatalog) {
    files.push(createCatalogRootFile(rootPath))
  }

  // Theme application strategy
  // - 0 themes: base only
  // - 1 theme: base + dark (apply that one theme)
  // - 2+ themes: base is computed by applying the FIRST theme; dark is computed by applying the SECOND theme
  let baseTokens: Array<Token> = tokens
  let darkTokens: Array<Token> = []

  if (themesToApply.length === 1) {
    // Base stays as original tokens; dark is tokens with the single theme applied
    darkTokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, [themesToApply[0]])
  } else if (themesToApply.length >= 2) {
    // Base becomes FIRST theme applied; dark becomes SECOND theme applied
    baseTokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, [themesToApply[0]])
    darkTokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, [themesToApply[1]])
  }

  // Create lookup maps by token id for base and dark values
  const baseById = new Map<string, Token>(baseTokens.map((t) => [t.id, t]))
  const darkById = new Map<string, Token>(darkTokens.map((t) => [t.id, t]))

  // Use tracker + configured style for folder naming
  const tracker = new TokenNameTracker()
  const nameStyle = exportConfiguration.folderNameStyle || StringCase.kebabCase

  // Emit one file per color token according to rules above
  for (const token of colorTokens) {
    const baseToken = baseById.get(token.id) || token
    const darkVariant = darkById.get(token.id)
    const variants = darkVariant ? [darkVariant] : []
    const file = createPerTokenFile(baseToken, tokenGroups, rootPath, variants, tracker, nameStyle)
    if (file) {
      files.push(file)
    }
  }

  // Optional write-back of folder names to tokens as a custom property
  if (exportConfiguration.writeNameToProperty && !(context as any).isPreview) {
    const writeStore = new WriteTokenPropStore(sdk, remoteVersionIdentifier)
    await writeStore.writeTokenProperties(exportConfiguration.propertyToWriteNameTo, colorTokens, (t) => {
      // Use tracker+style to mirror exported folder names
      const name = tracker.getTokenName(t, tokenGroups, nameStyle, null, true)
      return NamingHelper.codeSafeVariableName(name, nameStyle)
    })
  }

  // Return all files to the export engine for writing to the destination
  return files
})
