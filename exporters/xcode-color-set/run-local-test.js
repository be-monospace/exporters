// Local test runner for the exporter
// This will help us debug the actual exporter behavior

const path = require('path');

// Import the built exporter
const exporterPath = path.join(__dirname, 'dist', 'build.js');

console.log("=== LOCAL EXPORTER TEST ===");
console.log("Exporter path:", exporterPath);

try {
  // Try to require the built exporter
  const exporter = require(exporterPath);
  console.log("Exporter loaded successfully");
  console.log("Exporter exports:", Object.keys(exporter));
} catch (error) {
  console.error("Error loading exporter:", error.message);
  console.log("\nMake sure you've built the project first:");
  console.log("npm run build");
}

// Alternative: Let's create a mock test that simulates the exporter environment
console.log("\n=== MOCK EXPORTER TEST ===");

// Mock the Pulsar context
const mockContext = {
  dsId: "mock-ds-id",
  versionId: "mock-version-id", 
  themeIds: ["mock-theme-id"]
};

// Mock configuration
const mockConfig = {
  excludePrimitivesInThemePipelines: true,
  primitiveCollections: ["primitive"],
  generateRootCatalog: true,
  rootCatalogPath: "Colors.xcassets",
  folderNameStyle: "kebabCase",
  writeNameToProperty: false,
  propertyToWriteNameTo: "iOS variable"
};

console.log("Mock context:", mockContext);
console.log("Mock config:", mockConfig);

// Test our filtering logic with realistic data
const mockTokens = [
  {
    id: "token1",
    name: "Green 1100",
    tokenType: "color",
    properties: [
      {
        name: "Collection",
        value: "primitive"
      }
    ]
  },
  {
    id: "token2",
    name: "Green 1000", 
    tokenType: "color",
    properties: [
      {
        name: "Collection",
        value: "primitive"
      }
    ]
  },
  {
    id: "token3",
    name: "Brand Primary",
    tokenType: "color",
    properties: [
      {
        name: "Collection",
        value: "brand"
      }
    ]
  }
];

console.log("\n=== TESTING FILTERING WITH MOCK DATA ===");
console.log("Mock tokens:", mockTokens.length);

// Apply the same logic as in the exporter
const themesToApply = [{ id: "theme1" }];
const primitiveCollectionSet = new Set(mockConfig.primitiveCollections);

console.log("Themes to apply:", themesToApply.length);
console.log("Primitive collections:", Array.from(primitiveCollectionSet));

if (mockConfig.excludePrimitivesInThemePipelines && themesToApply.length > 0 && mockConfig.primitiveCollections.length > 0) {
  console.log("Filtering conditions met - applying filter");
  
  const filteredTokens = mockTokens.filter((token) => {
    if (token.properties && token.properties.length > 0) {
      const collectionProperty = token.properties.find(prop => prop.name === "Collection");
      if (collectionProperty) {
        let collectionValue = null;
        
        if (collectionProperty.value && typeof collectionProperty.value === 'string') {
          collectionValue = collectionProperty.value;
        }
        
        console.log(`Token "${token.name}": collectionValue="${collectionValue}", shouldExclude=${primitiveCollectionSet.has(collectionValue)}`);
        
        if (collectionValue) {
          return !primitiveCollectionSet.has(collectionValue);
        }
      }
    }
    return true;
  });
  
  console.log(`Filtering results: ${mockTokens.length} -> ${filteredTokens.length}`);
  console.log("Remaining tokens:", filteredTokens.map(t => t.name));
} else {
  console.log("Filtering conditions not met - no filtering applied");
}
