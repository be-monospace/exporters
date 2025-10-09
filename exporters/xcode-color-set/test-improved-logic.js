// Test the improved filtering logic with all possible property structures

const exportConfiguration = {
  excludePrimitivesInThemePipelines: true,
  primitiveCollections: ["primitive"]
};

const themesToApply = [{ id: "theme1" }];

// Test tokens with different property structures
const testTokens = [
  {
    id: "token1",
    name: "Green 1100 - Direct Value",
    tokenType: "color",
    properties: [{ name: "Collection", value: "primitive" }]
  },
  {
    id: "token2", 
    name: "Green 1000 - Nested Value",
    tokenType: "color",
    properties: [{ name: "Collection", data: { value: "primitive" } }]
  },
  {
    id: "token3",
    name: "Green 900 - Text Property",
    tokenType: "color",
    properties: [{ name: "Collection", text: "primitive" }]
  },
  {
    id: "token4",
    name: "Green 800 - Complex Nested",
    tokenType: "color",
    properties: [{ name: "Collection", value: { type: "select", value: "primitive" } }]
  },
  {
    id: "token5",
    name: "Green 700 - Array Values",
    tokenType: "color",
    properties: [{ name: "Collection", values: ["primitive"] }]
  },
  {
    id: "token6",
    name: "Brand Primary",
    tokenType: "color",
    properties: [{ name: "Collection", value: "brand" }]
  },
  {
    id: "token7",
    name: "Theme Accent",
    tokenType: "color",
    properties: []
  }
];

console.log("=== IMPROVED FILTERING TEST ===");
console.log("Configuration:", exportConfiguration);
console.log("Themes:", themesToApply.length);

let colorTokens = testTokens.filter((t) => t.tokenType === "color");
console.log("Total color tokens:", colorTokens.length);

if (exportConfiguration.excludePrimitivesInThemePipelines && themesToApply.length > 0 && exportConfiguration.primitiveCollections.length > 0) {
  const primitiveCollectionSet = new Set(exportConfiguration.primitiveCollections);
  
  console.log("\n--- Testing each token ---");
  
  colorTokens = colorTokens.filter((token) => {
    if (token.properties && token.properties.length > 0) {
      const collectionProperty = token.properties.find(prop => prop.name === "Collection");
      if (collectionProperty) {
        let collectionValue = null;
        
        // Pattern 1: Direct value
        if (collectionProperty.value && typeof collectionProperty.value === 'string') {
          collectionValue = collectionProperty.value;
        }
        // Pattern 2: Nested value (data.value)
        else if (collectionProperty.data?.value) {
          collectionValue = collectionProperty.data.value;
        }
        // Pattern 3: Text property
        else if (collectionProperty.text) {
          collectionValue = collectionProperty.text;
        }
        // Pattern 4: Complex nested (value.value)
        else if (collectionProperty.value?.value) {
          collectionValue = collectionProperty.value.value;
        }
        // Pattern 5: Array values
        else if (collectionProperty.values && Array.isArray(collectionProperty.values)) {
          collectionValue = collectionProperty.values[0];
        }
        
        console.log(`Token "${token.name}":`, {
          extractedValue: collectionValue,
          shouldExclude: primitiveCollectionSet.has(collectionValue)
        });
        
        if (collectionValue) {
          return !primitiveCollectionSet.has(collectionValue);
        }
      }
    }
    return true;
  });
  
  console.log(`\n--- Results ---`);
  console.log(`Filtered count: ${colorTokens.length}`);
  console.log(`Remaining tokens:`, colorTokens.map(t => t.name));
}

console.log("\n=== END TEST ===");
