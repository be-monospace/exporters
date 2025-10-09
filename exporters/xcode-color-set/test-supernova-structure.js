// Test script to simulate actual Supernova SDK token structure
// This helps us understand what the real token properties look like

console.log("=== SUPERNOVA SDK STRUCTURE TEST ===");

// Simulate different possible property structures
const possibleStructures = [
  // Structure 1: Direct value property
  {
    name: "Token with direct value",
    properties: [
      {
        name: "Collection",
        value: "primitive"
      }
    ]
  },
  
  // Structure 2: Nested value property  
  {
    name: "Token with nested value",
    properties: [
      {
        name: "Collection",
        data: {
          value: "primitive"
        }
      }
    ]
  },
  
  // Structure 3: Text property
  {
    name: "Token with text property",
    properties: [
      {
        name: "Collection", 
        text: "primitive"
      }
    ]
  },
  
  // Structure 4: Complex nested structure
  {
    name: "Token with complex structure",
    properties: [
      {
        name: "Collection",
        value: {
          type: "select",
          value: "primitive"
        }
      }
    ]
  },
  
  // Structure 5: Array of values
  {
    name: "Token with array values",
    properties: [
      {
        name: "Collection",
        values: ["primitive"]
      }
    ]
  }
];

// Test each structure
possibleStructures.forEach((token, index) => {
  console.log(`\n--- Test ${index + 1}: ${token.name} ---`);
  console.log("Properties:", JSON.stringify(token.properties, null, 2));
  
  const collectionProperty = token.properties.find(prop => prop.name === "Collection");
  if (collectionProperty) {
    console.log("Collection property found");
    
    // Try different access patterns
    const patterns = [
      { name: "value", value: collectionProperty.value },
      { name: "text", value: collectionProperty.text },
      { name: "data", value: collectionProperty.data },
      { name: "values", value: collectionProperty.values },
      { name: "data.value", value: collectionProperty.data?.value },
      { name: "value.value", value: collectionProperty.value?.value }
    ];
    
    patterns.forEach(pattern => {
      if (pattern.value !== undefined) {
        console.log(`  ${pattern.name}:`, pattern.value, `(type: ${typeof pattern.value})`);
        if (pattern.value === "primitive" || (Array.isArray(pattern.value) && pattern.value.includes("primitive"))) {
          console.log(`    ✅ MATCH FOUND in ${pattern.name}!`);
        }
      }
    });
  } else {
    console.log("No Collection property found");
  }
});

console.log("\n=== END TEST ===");
