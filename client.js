/**
 * client.js
 * A test client for the Probo MCP server
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Create a test client that connects to our server
async function testClient() {
  try {
    console.log('Connecting to Probo MCP server...');
    
    const client = new Client({ 
      name: 'probo-mcp-test-client', 
      version: '0.1.0' 
    });
    
    // Connect to the server
    await client.connect(new StdioClientTransport({
      command: 'node',
      args: ['server.js']
    }));
    
    console.log('Connected to server successfully!');
    console.log('Server info:', client.serverInfo);
    
    // Define tools we know are available
    const toolNames = [
      'searchProducts',
      'configureProduct',
      'placeOrder',
      'getOrderStatus',
      'getAllOrders',
      'cancelOrder'
    ];
    
    console.log(`Expected available tools (${toolNames.length}):`);
    toolNames.forEach(name => {
      console.log(`- ${name}`);
    });
    
    // Test the searchProducts tool
    console.log('\n--- TEST 1: SEARCH PRODUCTS ---');
    console.log('Calling searchProducts tool...');
    const searchResult = await client.callTool({
      name: 'searchProducts',
      arguments: { query: '' }
    });
    
    console.log('Search result status:', searchResult.isError ? 'ERROR' : 'SUCCESS');
    
    if (!searchResult.isError) {
      console.log('Message:', searchResult.content[0].text);
      try {
        const data = JSON.parse(searchResult.content[1].text);
        console.log(`Found ${data.products?.length || 0} products`);
        
        // Log detailed product info
        console.log('\nDetailed Product Info:');
        if (data.products && data.products.length > 0) {
          data.products.forEach((product, index) => {
            console.log(`\nProduct ${index + 1}:`);
            console.log(JSON.stringify(product, null, 2));
            
            // Extract important fields
            console.log(`Key fields from product ${index + 1}:`);
            console.log(`- code: ${product.code || 'N/A'}`);
            console.log(`- customer_code: ${product.customer_code || 'N/A'}`);
            console.log(`- api_code: ${product.api_code || 'N/A'}`);
            console.log(`- article_group_name: ${product.article_group_name || 'N/A'}`);
          });
        } else {
          console.log('No products found in the search results');
          
          // Log the complete response for debugging
          console.log('\nComplete API response:');
          console.log(JSON.stringify(data, null, 2));
        }
      } catch (error) {
        console.error('Error parsing JSON data:', error);
      }
    } else {
      console.error('Error:', searchResult.content[0].text);
    }
    
    // Try to get a single product directly (test real /products endpoint)
    console.log('\n--- TEST 2: GET SINGLE PRODUCT ---');
    try {
      // Since we're having issues with configureProduct, let's try calling it directly
      // to see what the API expects
      const configureResult = await client.callTool({
        name: 'configureProduct',
        arguments: {
          productCode: 'airtex_01', // Try a sample product code
          options: [],
          language: 'en',
        }
      });
      
      console.log('Configure result status:', configureResult.isError ? 'ERROR' : 'SUCCESS');
      
      if (!configureResult.isError) {
        console.log('Message:', configureResult.content[0].text);
        try {
          const data = JSON.parse(configureResult.content[1].text);
          console.log('Configuration success!');
          console.log('\nConfiguration response overview:');
          
          // Log configuration details
          if (data.products && data.products.length > 0) {
            console.log(`- Product code: ${data.products[0].code || 'N/A'}`);
            console.log(`- Has options: ${data.products[0].options ? 'Yes' : 'No'}`);
            console.log(`- Number of options: ${data.products[0].options?.length || 0}`);
          }
          
          // Log abbreviated results to avoid overwhelming the console
          console.log('\nConfiguration structure (abbreviated):');
          console.log(JSON.stringify({
            products: data.products ? [{...data.products[0], options: data.products[0].options ? 
              `[${data.products[0].options.length} options]` : 'none'}] : 'none',
            status: data.status || 'N/A'
          }, null, 2));
        } catch (error) {
          console.error('Error parsing JSON data:', error);
        }
      } else {
        console.error('Configuration Error:', configureResult.content[0].text);
        
        // Try to extract the detailed error message
        try {
          const errorData = JSON.parse(configureResult.content[1].text);
          console.log('\nDetailed configuration error:');
          console.log(JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.error('Could not parse error details:', e);
        }
      }
    } catch (error) {
      console.error('Error calling configureProduct:', error);
    }
    
    // Close the client
    await client.close();
    console.log('\nClient closed');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test client
testClient(); 