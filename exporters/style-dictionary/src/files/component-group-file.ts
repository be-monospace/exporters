import { FileHelper, ThemeHelper, NamingHelper, StringCase } from "@supernovaio/export-utils"
import { OutputTextFile, Token, TokenGroup, TokenTheme } from "@supernovaio/sdk-exporters"
import { DesignSystemCollection } from '@supernovaio/sdk-exporters/build/sdk-typescript/src/model/base/SDKDesignSystemCollection'
import { exportConfiguration } from ".."
import { processTokensToObject } from "./style-file"

/**
 * Generates component files organized by token groups within a components collection.
 * This function creates separate files for each component group (button, card, etc.)
 * 
 * @param collection - The components collection
 * @param tokens - Array of all tokens
 * @param tokenGroups - Array of token groups for hierarchy
 * @param themePath - Optional theme path for themed files
 * @param theme - Optional theme configuration
 * @param collections - Array of design system collections
 * @returns Array of OutputTextFile objects, one per component group
 */
export function componentGroupStyleOutputFiles(
  collection: DesignSystemCollection,
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themePath: string = '',
  theme?: TokenTheme,
  collections: Array<DesignSystemCollection> = []
): Array<OutputTextFile> {
  const callId = Math.random().toString(36).substr(2, 9)
  // Filter to only include tokens from the specified collection
  let collectionTokens = tokens.filter((token) => token.collectionId === collection.persistentId)
  
  // For themed token files:
  // - Filter to only include tokens that are overridden in this theme
  // - Skip generating the file if no tokens are themed (when configured)
  if (themePath && theme && exportConfiguration.exportOnlyThemedTokens) {
    collectionTokens = ThemeHelper.filterThemedTokens(collectionTokens, theme)
    
    if (collectionTokens.length === 0) {
      return []
    }
  }

  // Group tokens by their component group (button, accordion, etc.)
  // We identify the top-level component group by finding the root group in the hierarchy
  const tokensByComponentGroup = new Map<string, Array<Token>>()
  
  collectionTokens.forEach((token) => {
    if (!token.parentGroupId) {
      // Token has no parent group, skip it or handle separately
      return
    }
    
    // Find the root component group by traversing up the hierarchy
    // The root group is the one with no parentGroupId (top of hierarchy)
    let rootGroupId: string | null = null
    let currentGroupId: string | null = token.parentGroupId
    
    // Traverse up the hierarchy to find the root group
    while (currentGroupId) {
      const currentGroup = tokenGroups.find(group => group.id === currentGroupId)
      if (!currentGroup) break
      
      // If this group has no parent, it's the root component group
      if (!currentGroup.parentGroupId) {
        rootGroupId = currentGroupId
        break
      }
      
      currentGroupId = currentGroup.parentGroupId
    }
    
    // If we found a root group, use it; otherwise fall back to the immediate parent
    const componentGroupId = rootGroupId || token.parentGroupId
    
    if (!tokensByComponentGroup.has(componentGroupId)) {
      tokensByComponentGroup.set(componentGroupId, [])
    }
    tokensByComponentGroup.get(componentGroupId)!.push(token)
  })


  // Create a file for each component group
  const files: Array<OutputTextFile> = []
  
  tokensByComponentGroup.forEach((groupTokens, groupId) => {
    const parentGroup = tokenGroups.find(group => group.id === groupId)
    if (!parentGroup) return

    // Process tokens into a structured object
    const tokenObject = processTokensToObject(groupTokens, tokenGroups, theme, collections, tokens)
    if (!tokenObject) return

    // Generate the final JSON content with proper indentation
    const content = JSON.stringify(tokenObject, null, exportConfiguration.indent)

    // Create component-safe file name
    const componentName = NamingHelper.codeSafeVariableName(parentGroup.name, StringCase.kebabCase)
    const baseFileName = componentName
    const fileName = themePath ? `${baseFileName}.${themePath}.json` : `${baseFileName}.json`
    const relativePath = './components'


    // Create and return the output file
    const file = FileHelper.createTextFile({
      relativePath: relativePath,
      fileName: fileName,
      content: content
    })
    
    files.push(file)
  })


  return files
}
