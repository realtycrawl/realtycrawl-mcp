import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createServer} from '../src/server.mjs';
test('MCP handshake, five tools, structured results and safe errors',async()=>{
 const api={platforms:async()=>[{slug:'zillow',status:'active'}],capabilities:async()=>[],endpoints:async()=>[{id:'searchPlatformListings',path:'/v1/{platform}/listings/search',method:'POST',title:'Search',tags:['platform-listings'],runtimeStatus:'beta',creditCost:50,creditUnit:'successful_source_crawl',schemas:{private:'omit from summary'}}],endpoint:async()=>{throw Error('private internal error')},callEndpoint:async()=>({data:[],meta:{request_id:'fixture'}})};
 const server=createServer(api),client=new Client({name:'fixture',version:'1.0.0'});
 const [left,right]=InMemoryTransport.createLinkedPair();
 try{
  await Promise.all([server.connect(left),client.connect(right)]);
  const {tools}=await client.listTools();assert.equal(tools.length,5);
  const result=await client.callTool({name:'list_platforms',arguments:{}});
  assert.deepEqual(result.structuredContent.result,[{slug:'zillow',status:'active'}]);
  const discovery=await client.callTool({name:'list_endpoints',arguments:{}});
  assert.deepEqual(discovery.structuredContent.result,[{id:'searchPlatformListings',path:'/v1/{platform}/listings/search',method:'POST',title:'Search',tags:['platform-listings'],runtimeStatus:'beta',creditCost:50,creditUnit:'successful_source_crawl'}]);
  const failure=await client.callTool({name:'get_endpoint',arguments:{endpointId:'unknown'}});
  assert.equal(failure.isError,true);assert(!JSON.stringify(failure).includes('private internal error'));
 }finally{await client.close();await server.close();}
});
