// Simple test script to debug token properties
// This simulates what the exporter does but runs locally

const fs = require('fs');

// Mock configuration
const exportConfiguration = {
  excludePrimitivesInThemePipelines: true,
  primitiveCollections: ["primitive"]
};

// Mock token data - you can replace this with real data from your design system
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
  },
  {
    id: "token4",
    name: "Theme Accent",
    tokenType: "color",
    properties: [] // No properties
  }
];

// Mock themes
const themesToApply = [{ id: "theme1", name: "Dark Theme" }];

console.log("=== LOCAL DEBUG TEST ===");
console.log("Configuration:", exportConfiguration);
console.log("Themes:", themesToApply.length);
console.log("Total tokens:", mockTokens.length);

// Filter color tokens
let colorTokens = mockTokens.filter((t) => t.tokenType === "color");
console.log("Color tokens:", colorTokens.length);

// Apply the same filtering logic as the exporter
if (exportConfiguration.excludePrimitivesInThemePipelines && themesToApply.length > 0 && exportConfiguration.primitiveCollections.length > 0) {
  const primitiveCollectionSet = new Set(exportConfiguration.primitiveCollections);
  
  console.log("Primitive collections set:", Array.from(primitiveCollectionSet));
  
  // Debug each token
  colorTokens.forEach((token, index) => {
    console.log(`\nToken ${index + 1}: ${token.name}`);
    console.log("Properties:", token.properties);
    
    if (token.properties && token.properties.length > 0) {
      const collectionProperty = token.properties.find(prop => prop.name === "Collection");
      console.log("Collection property found:", collectionProperty);
      
      if (collectionProperty) {
        const collectionValue = collectionProperty.value;
        console.log("Collection value:", collectionValue);
        console.log("Should exclude:", primitiveCollectionSet.has(collectionValue));
      }
    } else {
      console.log("No properties found");
    }
  });
  
  // Apply filtering
  const originalCount = colorTokens.length;
  colorTokens = colorTokens.filter((token) => {
    if (token.properties && token.properties.length > 0) {
      const collectionProperty = token.properties.find(prop => prop.name === "Collection");
      if (collectionProperty) {
        const collectionValue = collectionProperty.value;
        return !primitiveCollectionSet.has(collectionValue);
      }
    }
    return true;
  });
  
  console.log(`\nFiltering results:`);
  console.log(`Original count: ${originalCount}`);
  console.log(`Filtered count: ${colorTokens.length}`);
  console.log(`Remaining tokens:`, colorTokens.map(t => t.name));
}

console.log("\n=== END DEBUG ===");
