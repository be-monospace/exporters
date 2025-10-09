// Local test script to connect to Supernova and debug token properties
// This will show us the actual token structure from your design system

const { Supernova } = require('@supernovaio/sdk-exporters');

async function testSupernovaTokens() {
  console.log("=== LOCAL SUPERNOVA CONNECTION TEST ===");
  
  try {
    // Initialize Supernova SDK
    const sdk = new Supernova({
      // You'll need to provide your API credentials here
      // Check your Supernova workspace settings for API key
    });
    
    // Mock context - you'll need to replace with your actual design system ID and version
    const context = {
      dsId: "YOUR_DESIGN_SYSTEM_ID", // Replace with your actual DS ID
      versionId: "YOUR_VERSION_ID",   // Replace with your actual version ID
      themeIds: ["YOUR_THEME_ID"]     // Replace with your actual theme ID
    };
    
    const remoteVersionIdentifier = {
      designSystemId: context.dsId,
      versionId: context.versionId,
    };
    
    console.log("Fetching tokens from Supernova...");
    
    // Fetch tokens and groups
    const tokens = await sdk.tokens.getTokens(remoteVersionIdentifier);
    const tokenGroups = await sdk.tokens.getTokenGroups(remoteVersionIdentifier);
    
    console.log(`Found ${tokens.length} total tokens`);
    console.log(`Found ${tokenGroups.length} token groups`);
    
    // Filter color tokens
    const colorTokens = tokens.filter((t) => t.tokenType === "color");
    console.log(`Found ${colorTokens.length} color tokens`);
    
    // Show first few color tokens and their properties
    console.log("\n=== FIRST 5 COLOR TOKENS ===");
    colorTokens.slice(0, 5).forEach((token, index) => {
      console.log(`\nToken ${index + 1}: ${token.name}`);
      console.log("Properties:", JSON.stringify(token.properties, null, 2));
      
      if (token.properties && token.properties.length > 0) {
        const collectionProperty = token.properties.find(prop => prop.name === "Collection");
        if (collectionProperty) {
          console.log("Collection property found:", JSON.stringify(collectionProperty, null, 2));
          
          // Try all our extraction patterns
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
            }
          });
        } else {
          console.log("No Collection property found");
        }
      } else {
        console.log("No properties at all");
      }
    });
    
    // Test our filtering logic
    console.log("\n=== TESTING FILTERING LOGIC ===");
    const primitiveCollections = ["primitive"];
    const primitiveCollectionSet = new Set(primitiveCollections);
    
    let filteredTokens = colorTokens.filter((token) => {
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
          
          console.log(`Token "${token.name}": extractedValue="${collectionValue}", shouldExclude=${primitiveCollectionSet.has(collectionValue)}`);
          
          if (collectionValue) {
            return !primitiveCollectionSet.has(collectionValue);
          }
        }
      }
      return true;
    });
    
    console.log(`\nFiltering results:`);
    console.log(`Original count: ${colorTokens.length}`);
    console.log(`Filtered count: ${filteredTokens.length}`);
    console.log(`Excluded count: ${colorTokens.length - filteredTokens.length}`);
    
  } catch (error) {
    console.error("Error connecting to Supernova:", error.message);
    console.log("\nTo use this script, you need to:");
    console.log("1. Get your Supernova API credentials");
    console.log("2. Replace the placeholder values in the script");
    console.log("3. Run: node test-local-supernova.js");
  }
}

testSupernovaTokens();
