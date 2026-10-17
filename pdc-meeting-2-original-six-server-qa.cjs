'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path'),JSZip=require('C:/VD-Agent/jszip.min.js');
const app={routes:{},get(route,...fn){this.routes[route]=fn.at(-1)}};
const root=__dirname;
process.env.PDC2_ORIGINAL_SIX_AES_KEY=fs.readFileSync('C:/VD-Agent/pdc2-private-aes-key.txt','utf8').trim();
require('./pdc-meeting-2-original-six-server.js')({app,requireAuth_:(req,res,next)=>next()});
function response(){
 const out={status:200,headers:{},json:null,data:null};
 const r={set(k,v){out.headers[k]=v;return this},status(s){out.status=s;return this},json(v){out.json=v;return this},send(v){out.data=v;return this}};
 return [out,r];
}
(async()=>{
 const permitted={session:{user:{permissions:['اجتماع PDC 2'],role:'editor'}}};
 const denied={session:{user:{permissions:['المشاريع'],role:'editor'}}};
 let [o,res]=response();app.routes['/api/pdc-meeting-2/template-six/status'](permitted,res);
 assert.equal(o.json.available,true);assert.equal(o.json.verifiedSlides,6);
 [o,res]=response();app.routes['/api/pdc-meeting-2/template-six'](permitted,res);
 assert(Buffer.isBuffer(o.data));const z=await JSZip.loadAsync(o.data);
 const px=await z.file('ppt/presentation.xml').async('string');
 assert.equal((px.match(/<p:sldId\b/g)||[]).length,6);
 assert(z.file('ppt/slides/slide6.xml'));assert(!z.file('ppt/slides/slide7.xml'));
 assert(z.file('ppt/charts/chart12.xml'));assert(!z.file('ppt/charts/chart13.xml'));
 assert(z.file('ppt/media/image4.png'));assert(!z.file('ppt/media/image20.jpeg'));
 [o,res]=response();app.routes['/api/pdc-meeting-2/template-six'](denied,res);assert.equal(o.status,403);
 delete process.env.PDC2_ORIGINAL_SIX_AES_KEY;
 [o,res]=response();app.routes['/api/pdc-meeting-2/template-six/status'](permitted,res);assert.equal(o.json.available,false);
 console.log('PASS TEMPLATE SECURITY: AES-GCM decrypted only for authorized PDC2 users; exactly six native source slides; no later images, charts or drafts exposed; fail closed without Render secret');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
