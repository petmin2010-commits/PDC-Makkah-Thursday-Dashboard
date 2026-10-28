'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const roots=[__dirname];
async function test(root){
 const recorded=[];
 class Slide{
  constructor(){this.items=[];recorded.push(this);}
  addText(value,options){this.items.push({kind:'text',value,options});}
  addShape(type,options){this.items.push({kind:'shape',type,options});}
  addImage(options){this.items.push({kind:'image',options});}
 }
 class Pptx{
  constructor(){this.ShapeType={roundRect:'roundRect',rect:'rect',rightArrow:'rightArrow'};}
  addSlide(){return new Slide();}
  async write(){return new Blob([new Uint8Array(1500)]);}
 }
 Pptx.prototype.ShapeType={roundRect:'roundRect',rect:'rect',rightArrow:'rightArrow'};
 const defaultCss={display:'block',visibility:'visible',opacity:'1',direction:'rtl',whiteSpace:'normal',fontSize:'18px',fontWeight:'700',color:'rgb(21,59,101)',backgroundColor:'rgba(0,0,0,0)',backgroundImage:'none',borderRadius:'0px',borderTopWidth:'0px',borderRightWidth:'0px',borderBottomWidth:'0px',borderLeftWidth:'0px',textAlign:'right'};
 const rect=(left,top,width,height)=>({left,top,width,height});
 function element(tag,r,customCss={},children=[],attrs={}){
  const el={nodeType:1,tagName:tag,childNodes:children,classList:{contains(){return false;}},getBoundingClientRect(){return r;},closest(){return null;},getAttribute(name){return attrs[name]||'';},style:{},_css:{...defaultCss,...customCss}};
  for(const c of children)if(c.nodeType===3)c.parentNode=el;
  return el;
 }
 const t=(value,rect)=>({nodeType:3,nodeValue:value,rangeRect:rect});
 const page1=element('SECTION',rect(0,0,1280,720),{backgroundColor:'rgb(245,248,252)'},[
  element('DIV',rect(70,50,800,100),{backgroundColor:'rgb(25,65,120)',borderRadius:'8px'},[
   t('تقرير السلامة والإجراءات التصحيحية',rect(85,72,680,44))
  ]),
  element('SPAN',rect(90,220,600,55),{},[t('الأسبوع الرابع - أكتوبر',rect(91,222,425,28))]),
  element('IMG',rect(900,80,210,130),{objectFit:'contain'},[],{src:'data:image/png;base64,AA==',alt:'Logo'})
 ]);
 const page2=element('SECTION',rect(0,730,1280,720),{backgroundColor:'rgb(255,255,255)'},[
  element('TABLE',rect(45,810,1150,430),{},[
   element('TR',rect(60,850,1080,65),{},[
    element('TH',rect(65,854,350,50),{backgroundColor:'rgb(30,65,110)'},[
     t('المقاول',rect(90,869,200,28))]),
    element('TH',rect(425,854,350,50),{backgroundColor:'rgb(30,65,110)'},[
     t('عدد الملاحظات',rect(440,869,240,28))])
   ]),
   element('TR',rect(60,930,1080,65),{},[
    element('TD',rect(65,931,350,55),{},[t('المقاول الأول',rect(80,946,210,28))]),
    element('TD',rect(425,931,350,55),{},[t('12',rect(470,945,40,28))])
   ])
  ])
 ]);
 const pages=[page1,page2];
 const doc={
  fonts:{ready:Promise.resolve()},images:[],
  defaultView:{getComputedStyle(el){return el._css;}},
  createRange(){let node;return {selectNodeContents(n){node=n;},getBoundingClientRect(){return node.rangeRect;},detach(){}};},
  querySelectorAll(){return pages;},body:{},title:'Safety Editable'
 };
 const win={closed:false,document:doc,location:{href:'https://example.com/',origin:'https://example.com'}};
 const host={
  PptxGenJS:Pptx,location:{href:'https://example.com/',origin:'https://example.com'},
  fetch:async()=>{throw Error('NO_REMOTE_FETCH_NEEDED');}
 };
 const context={window:host,Blob,document:{},console,URL,FileReader:class{},setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(root+'/public/report-pptx-capture.js','utf8'),context);
 const res=await host.VDReportPptxCapture.createWindowPptxWide(win,'.sheet');
 assert(res.editable);assert.strictEqual(res.slideCount,2);
 assert.strictEqual(recorded.length,2);
 const texts=recorded.flatMap(s=>s.items.filter(x=>x.kind==='text').map(x=>x.value));
 for(const label of ['تقرير السلامة والإجراءات التصحيحية','الأسبوع الرابع - أكتوبر','المقاول','عدد الملاحظات','المقاول الأول','12'])assert(texts.includes(label),root+' missing '+label);
 const images=recorded.flatMap(s=>s.items.filter(x=>x.kind==='image'));
 assert.equal(images.length,1,'Only actual logo should be an image object');
 assert(recorded[0].items.filter(x=>x.kind==='shape').length>=2);
 assert(recorded[1].items.filter(x=>x.kind==='text').length>=4);
 const source=fs.readFileSync(root+'/public/report-pptx-capture.js','utf8');
 assert(!source.includes('html2canvas('));assert(!source.includes("toDataURL('image/jpeg'"));
 assert(!source.includes('canvas.toDataURL'));
 console.log('PASS '+root.split('/').pop()+': 2 slides, editable source-table cells, title, independent logo, no screenshot');
}
(async()=>{for(const root of roots)await test(root)})().catch(e=>{console.error(e);process.exitCode=1});
