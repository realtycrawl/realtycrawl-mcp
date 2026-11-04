export const ORIGIN='https://realtycrawl.dev';
export class RealtyCrawlError extends Error{}
export class RealtyCrawlClient {
 constructor({apiKey=process.env.REALTYCRAWL_API_KEY,fetchImpl=globalThis.fetch}={}){this.apiKey=apiKey;this.fetch=fetchImpl;}
 async request(method,path,parameters={},options={}){
  if(!['GET','POST'].includes(method)||!/^\/v1\/[A-Za-z0-9_.:~/-]+$/.test(path)||path.includes('..')||path.includes('//'))throw new RealtyCrawlError('Unsupported API method or path.');
  const headers={Accept:'application/json'};if(options.authenticated!==false){if(!this.apiKey)throw new RealtyCrawlError('Provide a RealtyCrawl API key.');headers.Authorization=`Bearer ${this.apiKey}`;}
  const url=new URL(path,ORIGIN),input={...parameters};let body;
  for(const key of ['fields','format'])if(Object.hasOwn(input,key)){url.searchParams.set(key,String(input[key]));delete input[key];}
  if(method==='GET'){for(const[k,v]of Object.entries(input))url.searchParams.set(k,String(v));}else{body=JSON.stringify(input);headers['Content-Type']='application/json';}
  if(url.searchParams.get('format')==='csv')headers.Accept='text/csv';
  else if(url.searchParams.get('format')==='ndjson')headers.Accept='application/x-ndjson';
  if(body?.length>65536)throw new RealtyCrawlError('Request exceeds 64 KiB.');
  if(options.maxCredits!==undefined){if(!Number.isSafeInteger(options.maxCredits)||options.maxCredits<0)throw new RealtyCrawlError('maxCredits must be a non-negative integer.');headers['X-Max-Credits']=String(options.maxCredits);}
  if(options.idempotencyKey)headers['Idempotency-Key']=options.idempotencyKey;
  let response;try{response=await this.fetch(url,{method,headers,body,redirect:'error',signal:AbortSignal.timeout(60000)})}catch{throw new RealtyCrawlError('Request failed or timed out. No retry was made.');}
  const reader=response.body?.getReader();if(!reader)throw new RealtyCrawlError('Empty response.');let size=0;const chunks=[];try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>8*1024*1024){await reader.cancel();throw new RealtyCrawlError('Response too large. Narrow the request.');}chunks.push(p.value);}}finally{reader.releaseLock();}
  const content=Buffer.concat(chunks).toString('utf8'),type=(response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
  if(response.ok&&['text/csv','application/x-ndjson','application/ndjson'].includes(type)){
   const requestId=response.headers.get('x-request-id');if(!requestId)throw new RealtyCrawlError('Invalid RealtyCrawl export response contract.');
   const count=name=>{const value=response.headers.get(name);if(value===null||!/^\d+$/.test(value))return null;const number=Number(value);return Number.isSafeInteger(number)?number:null;};
   return {format:type==='text/csv'?'csv':'ndjson',content,meta:{request_id:requestId,credits_used:count('x-credits-used'),credits_remaining:count('x-credits-remaining'),row_count:count('x-row-count'),idempotent_replay:response.headers.get('x-idempotent-replay')==='true'}};
  }
  let json;try{json=JSON.parse(content);}catch{throw new RealtyCrawlError('Invalid response JSON.');}
  if(!response.ok)throw new RealtyCrawlError(`${json?.error?.code??'API_ERROR'}: ${json?.error?.message??'Request failed.'} Request ID: ${json?.request_id??response.headers.get('x-request-id')??'unknown'}`);
  if(path.endsWith('openapi.json'))return json;
  if(!json||!('data'in json)||!json.meta?.request_id)throw new RealtyCrawlError('Invalid RealtyCrawl response contract.');return json;
 }
 get(path,parameters={},options={}){return this.request('GET',path,parameters,options);}
 async platforms(){return (await this.get('/v1/meta/platforms',{}, {authenticated:false})).data;}
 async capabilities(platform,country){return (await this.get('/v1/meta/capabilities',{...(platform?{platform}:{}),...(country?{country}:{})},{authenticated:false})).data;}
 async endpoints(){const spec=await this.get('/v1/openapi.json',{}, {authenticated:false});return Object.entries(spec.paths).flatMap(([path,ops])=>Object.entries(ops).filter(([method])=>['get','post'].includes(method)).map(([method,op])=>({id:op.operationId,path,method:method.toUpperCase(),title:op.summary,tags:op.tags,runtimeStatus:op['x-runtime-status'],creditCost:op['x-credit-cost'],creditUnit:op['x-credit-unit'],creditPricing:op['x-credit-pricing'],documentedPlatforms:op['x-documented-platforms'],verifiedPlatforms:op['x-verified-platforms'],evidenceLevel:op['x-evidence-level'],dataFreshness:op['x-data-freshness'],description:op.description,parameters:op.parameters??[],requestBody:op.requestBody,schemas:spec.components.schemas})));}
 async endpoint(id){const op=(await this.endpoints()).find(e=>e.id===id);if(!op)throw new RealtyCrawlError('Unknown operation ID.');return op;}
 async callEndpoint({endpointId,parameters={},maxCredits,idempotencyKey}){
  const op=await this.endpoint(endpointId);const input={...parameters};const path=op.path.replace(/\{([^}]+)\}/g,(_,name)=>{const v=input[name];if(typeof v!=='string'||!/^[A-Za-z0-9_.:~-]{1,256}$/.test(v))throw new RealtyCrawlError(`Missing or invalid path parameter: ${name}`);delete input[name];return encodeURIComponent(v);});
  if(!op.tags.includes('meta')&&(!Number.isSafeInteger(maxCredits)||maxCredits<1))throw new RealtyCrawlError('Approve a maxCredits budget of at least 1.');
  if(op.method==='POST'&&!idempotencyKey)throw new RealtyCrawlError('Provide a stable idempotencyKey for POST requests.');
  return this.request(op.method,path,input,{maxCredits,idempotencyKey,authenticated:!op.tags.includes('meta')});
 }
}
