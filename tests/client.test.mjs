import test from 'node:test';
import assert from 'node:assert/strict';
import {RealtyCrawlClient} from '../src/client.mjs';
const envelope={data:[{id:'obs_example'}],meta:{request_id:'fixture',completeness:'partial'}};
const spec={components:{schemas:{}},paths:{'/v1/{platform}/listings/search':{post:{operationId:'searchPlatformListings',tags:['platform-listings']}},'/v1/meta/platforms':{get:{operationId:'listPlatforms',tags:['meta']}}}};
test('constructs a budgeted source request and preserves provenance metadata',async()=>{
 let captured;const client=new RealtyCrawlClient({apiKey:'test-only-key',fetchImpl:async(url,init)=>{if(url.pathname.endsWith('openapi.json'))return Response.json(spec);captured={url,init};return Response.json(envelope);}});
 const body={platform:'zillow',location:{kind:'bbox',bbox:[-97.82,30.2,-97.65,30.35]},transaction:'sale',limit:1};
 assert.deepEqual(await client.callEndpoint({endpointId:'searchPlatformListings',parameters:body,maxCredits:50,idempotencyKey:'same-request'}),envelope);
 assert.equal(captured.url.origin,'https://realtycrawl.dev');assert.equal(captured.url.pathname,'/v1/zillow/listings/search');
 assert.equal(captured.init.headers.Authorization,'Bearer test-only-key');assert.equal(captured.init.headers['X-Max-Credits'],'50');assert.equal(captured.init.headers['Idempotency-Key'],'same-request');
 assert.equal(captured.init.redirect,'error');assert.deepEqual(JSON.parse(captured.init.body),{location:body.location,transaction:'sale',limit:1});
});
test('does not send credentials to metadata endpoints',async()=>{
 const client=new RealtyCrawlClient({apiKey:'test-only-key',fetchImpl:async(url,init)=>{assert.equal(init.headers.Authorization,undefined);return Response.json(envelope);}});
 assert.deepEqual(await client.platforms(),envelope.data);
});
test('rejects unsafe paths and missing auth before network calls',async()=>{
 let calls=0;const client=new RealtyCrawlClient({apiKey:'',fetchImpl:async()=>{calls++;}});
 for(const path of ['https://other.invalid/v1/listings','/v1/../keys','/v1//keys','/v1/listings?secret=x'])await assert.rejects(client.get(path));
 await assert.rejects(client.get('/v1/listings/one'));assert.equal(calls,0);
});
test('requires a budget and stable idempotency key for tool execution',async()=>{
 let paid=0;const client=new RealtyCrawlClient({apiKey:'test-only',fetchImpl:async url=>{if(url.pathname.endsWith('openapi.json'))return Response.json(spec);paid++;return Response.json(envelope);}});
 await assert.rejects(client.callEndpoint({endpointId:'searchPlatformListings',parameters:{platform:'zillow'},maxCredits:0,idempotencyKey:'same'}));
 await assert.rejects(client.callEndpoint({endpointId:'searchPlatformListings',parameters:{platform:'zillow'},maxCredits:50}));
 assert.equal(paid,0);
});
test('network errors are not retried and do not leak secrets',async()=>{
 let calls=0;const client=new RealtyCrawlClient({apiKey:'secret-value',fetchImpl:async()=>{calls++;throw Error('secret-value');}});
 await assert.rejects(client.get('/v1/listings/one',{}, {maxCredits:1}),error=>!error.message.includes('secret-value')&&error.message.includes('No retry'));
 assert.equal(calls,1);
});
test('surfaces request IDs and rejects malformed responses',async()=>{
 const bad=new RealtyCrawlClient({apiKey:'test-only',fetchImpl:async()=>Response.json({error:{code:'RATE_LIMITED',message:'Wait'},request_id:'req_example'},{status:429})});
 await assert.rejects(bad.get('/v1/listings/one'),/req_example/);
 const malformed=new RealtyCrawlClient({fetchImpl:async()=>Response.json({data:[]})});
 await assert.rejects(malformed.platforms(),/contract/);
});
