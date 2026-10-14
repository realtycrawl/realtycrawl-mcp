import assert from 'node:assert/strict';
for(const path of ['/v1/openapi.json','/v1/meta/platforms','/v1/meta/capabilities?platform=zillow&country=US']){
 const r=await fetch('https://realtycrawl.dev'+path,{redirect:'error',signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,200,path);const json=await r.json();
 if(path.endsWith('openapi.json'))assert(json.paths['/v1/listings/search']);else assert(json.data&&json.meta?.request_id);
 console.log('PASS',path);
}
