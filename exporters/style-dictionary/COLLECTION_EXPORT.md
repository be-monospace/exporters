# Export by Collection Feature

This document describes the new "Export by Collection" feature added to the Style Dictionary exporter.

## Overview

The export by collection feature allows you to organize your exported design tokens into a semantic, brand-organized file structure. This creates separate files for global tokens, alias tokens, brand-specific tokens, and component-specific tokens, with themes organized by brand directories.

## Configuration

To enable export by collection, set the `fileStructure` configuration option to `"separateByCollection"`:

```json
{
  "fileStructure": "separateByCollection"
}
```

## File Structure Options

The exporter now supports three file structure options:

1. **`separateByType`** (default): Generate separate files for each token type (color.json, typography.json, etc.)
2. **`singleFile`**: Generate one combined file containing all token types
3. **`separateByCollection`**: Generate separate files for each collection

## How It Works

When `fileStructure` is set to `"separateByCollection"`, the exporter will:

1. **Filter collections**: Only process collections that contain tokens
2. **Categorize collections**: Separate into global/alias, components, and other collections
3. **Generate semantic files**: Create files based on collection purpose and theme organization
4. **Organize by brand**: Component themes are organized in brand-specific directories
5. **Support theming**: All theme export styles work with the new brand-organized structure

## Example Output Structure

With collections named "Global", "Alias", and "Components", and themes named "Factor" and "Zest", the output structure would be:

```
global.json                    # Global design tokens
alias.json                     # Shared semantic aliases  
components/
├── button.json               # Base button component tokens
└── accordion.json            # Base accordion component tokens
brand/
├── factor/
│   ├── button.json           # Button component with factor theme
│   └── accordion.json        # Accordion component with factor 
├── zest/
│   ├── button.json           # Button component with zest theme
│   └── accordion.json        # Accordion component with zest
```

Each file contains all token types from that specific collection or theme, organized by semantic meaning rather than technical token types.

## Theme Support

The collection export feature works with all theme export styles:

- **Separate Files**: Creates brand-specific directories with component files (e.g., `brand/factor/button.json`)
- **Merged Theme**: Creates base files and brand directories with themed component files
- **Nested Themes**: Creates collection files with nested theme values
- **Apply Directly**: Applies themes directly to collection files

### Key Theme Behavior:
- **Global/Alias files**: Always remain at root level, never duplicated in theme directories
- **Component themes**: Organized by brand in `brand/{themeName}/` directories
- **Brand files**: Created from themes, containing all tokens with that theme applied

## File Naming and Directory Structure

Files are organized using a semantic structure based on collection types and themes:

### Directory Structure Rules:
1. **Global/Alias collections** → Always placed at root level
   - `global` → `global.json`
   - `alias` → `alias.json`
2. **Component collections** → Organized by component groups
   - Base components → `components/{componentName}.json`
   - Themed components → `brand/{themeName}/{componentName}.json`
3. **Brand files** → Created from themes
   - All themed tokens → `brand/{themeName}.json`

### Collection Categorization:
- **Global/Alias**: Collections named "global" or "alias"
- **Components**: Collections named "components" or "component"  
- **Brands**: Created from themes (e.g., "factor", "zest" themes become brand files)

### Examples:
- Collection "Global" → `global.json`
- Collection "Alias" → `alias.json`
- Collection "Components" with "button" group → `components/button.json`
- Theme "Factor" → `brand/factor.json` + `brand/factor/button.json`
- Theme "Zest" → `brand/zest.json` + `brand/zest/button.json`

This creates a semantic, brand-organized file structure that matches your design system's logical grouping.

## Token Name Structure

The existing `tokenNameStructure` configuration still applies:
- `"pathAndName"`: Group path + Token name
- `"nameOnly"`: Token name only  
- `"collectionPathAndName"`: Collection + Group path + Token name

When using `"collectionPathAndName"` with collection export, the collection name is included in the token path for better organization.

## Benefits

1. **Semantic Organization**: Files organized by purpose (global, components, brands) rather than technical structure
2. **Brand-Centric Theming**: Component themes organized by brand for easy brand-specific development
3. **Clean Separation**: Global/alias tokens never duplicated across themes
4. **Component Reusability**: Base components with brand-specific themed variants
5. **Scalable Architecture**: Easy to add new brands or components without restructuring
6. **Team Collaboration**: Different teams can work on different brands or components
7. **Selective Imports**: Import only the brands or components you need

## Migration

To migrate from the default export structure to collection-based export:

1. Update your configuration to set `fileStructure: "separateByCollection"`
2. Re-export your tokens
3. Update your import statements to reference the new collection-based files
4. Test your applications to ensure everything works correctly

## Compatibility

This feature is fully backward compatible. Existing configurations will continue to work as before, and the new collection export is opt-in through the configuration option.
