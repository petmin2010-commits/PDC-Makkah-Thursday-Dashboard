const crypto=require('crypto');

const HISTORY_SHEET='🔒 سجل الإفادات التاريخي';
const HEADERS=[
 'معرف الحدث','تاريخ ووقت الرصد','المصدر','صف المصدر','رقم أمر العمل','المهندس المسؤول','المقاول','مرحلة التنفيذ',
 'الإفادة الحالية','تاريخ آخر تعديل للإفادة','الإفادة بعد التنظيف','الإفادة السابقة','تاريخ التعديل السابق',
 'نسبة التشابه','تصنيف وكيل الذكاء الاصطناعي','درجة جودة الإفادة','سبب التصنيف','المعلومات الجديدة',
 'هل التحديث جوهري','آخر متابعة جوهرية','نموذج الذكاء الاصطناعي','وقت التحليل','بصمة الإفادة السابقة','بصمة الإفادة الحالية'
];

const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKC')
 .replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
 .replace(/[\s\-_/\\|.,،؛;:!?؟"'()\[\]{}]+/g,'').toLowerCase();
const hash=v=>crypto.createHash('sha1').update(String(v||'')).digest('hex').slice(0,16);
const keyOf=(source,wo,row)=>clean(source)+'|'+clean(wo)+'|'+String(row||'');
const isClosingStage=v=>clean(v)==='مرحلة الإغلاق';
const qSheet=name=>"'"+String(name).replace(/'/g,"''")+"'";
const nowKsa=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
function similarity(a,b){
 const A=new Set(clean(a).toLowerCase().split(/\s+/).filter(Boolean));
 const B=new Set(clean(b).toLowerCase().split(/\s+/).filter(Boolean));
 if(!A.size&&!B.size)return 1;
 let inter=0;for(const x of A)if(B.has(x))inter++;
 return inter/Math.max(1,new Set([...A,...B]).size);
}

async function ensureHistorySheet({sheets,spreadsheetId}){
 const meta=await sheets.spreadsheets.get({spreadsheetId,fields:'sheets.properties(sheetId,title)'});
 let sheet=(meta.data.sheets||[]).find(s=>s.properties?.title===HISTORY_SHEET);
 if(!sheet){
  const add=await sheets.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests:[{addSheet:{properties:{title:HISTORY_SHEET,gridProperties:{rowCount:10000,columnCount:24,frozenRowCount:1},rightToLeft:true}}}]}});
  sheet={properties:add.data.replies?.[0]?.addSheet?.properties};
 }
 const range=`${qSheet(HISTORY_SHEET)}!A1:X1`;
 const current=(await sheets.spreadsheets.values.get({spreadsheetId,range})).data.values?.[0]||[];
 if(HEADERS.some((h,i)=>current[i]!==h)){
  await sheets.spreadsheets.values.update({spreadsheetId,range,valueInputOption:'RAW',requestBody:{values:[HEADERS]}});
 }
 return sheet.properties;
}
function findHeader(row,names){
 const normHeader=v=>clean(v).normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
 const wanted=names.map(normHeader);
 for(let i=0;i<row.length;i++){const x=normHeader(row[i]);if(wanted.includes(x))return i;}
 return -1;
}

async function readAdviceSource({sheets,spreadsheetId,sheetName,source}){
 const range=`${qSheet(sheetName)}!A:AE`;
 const values=(await sheets.spreadsheets.values.get({spreadsheetId,range,valueRenderOption:'FORMATTED_VALUE'})).data.values||[];
 if(!values.length)return [];
 const h=values[0]||[];
 const woI=findHeader(h,['رقم امر العمل','أمر العمل','امر العمل']);
 const engI=findHeader(h,['المهندس المسئول','المهندس المسؤول']);
 const conI=findHeader(h,['المقاول']);
 const stageI=findHeader(h,['مرحلة التنفيذ']);
 const out=[];
 for(let i=1;i<values.length;i++){
  const r=values[i]||[],workOrder=clean(r[woI]);
  if(!workOrder)continue;
  out.push({source,row:i+1,workOrder,engineer:clean(r[engI]),contractor:clean(r[conI]),stage:clean(r[stageI]),advice:clean(r[28]),adviceTimestamp:clean(r[29]),sheetName});
 }
 return out;
}
function extractResponseText(data){
 if(data&&typeof data.output_text==='string')return data.output_text;
 for(const item of data?.output||[])for(const c of item?.content||[])if(c?.type==='output_text'&&c.text)return c.text;
 return '';
}

async function analyzeWithAI(change){
 const apiKey=process.env.OPENAI_API_KEY||'';
 const model=process.env.ADVICE_AI_MODEL||'gpt-5.6-luna';
 if(!apiKey)return {enabled:false,classification:'بانتظار وكيل الذكاء الاصطناعي',score:null,reason:'لم يتم تفعيل مفتاح OpenAI API بعد.',newInformation:[],substantive:null,model:''};
 const system='أنت وكيل رقابة جودة إفادات أوامر العمل في مشروع هندسي. حلل قيمة المتابعة لا أسلوب الكتابة. لا تعتبر إضافة مسافة أو شرطة أو / أو إعادة صياغة بلا معلومة جديدة متابعة حقيقية. التحديث الجوهري يجب أن يضيف واقعة أو إجراء أو نتيجة أو عائق أو موعد أو خطوة تالية أو تغير حالة يمكن التحقق منه. لا تعاقب الاختصار: إفادة قصيرة قد تكون عالية القيمة. أعد JSON فقط.';
 const user={
  task:'قارن الإفادة السابقة بالجديدة وصنف التحديث.',
  source:change.source,work_order:change.workOrder,engineer:change.engineer,contractor:change.contractor,stage:change.stage,
  previous_advice:change.previousAdvice||'',previous_timestamp:change.previousTimestamp||'',
  current_advice:change.advice||'',current_timestamp:change.adviceTimestamp||'',
  normalized_equivalent:norm(change.previousAdvice||'')===norm(change.advice||''),word_similarity:Math.round(similarity(change.previousAdvice||'',change.advice||'')*1000)/10,
  output:{classification:'جوهري|ضعيف|شكلي|مشتبه بلا معلومة جديدة',score:'0-100',substantive:'boolean',reason:'سبب عربي موجز',new_information:'array of strings'}
 };
 const resp=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'system',content:[{type:'input_text',text:system}]},{role:'user',content:[{type:'input_text',text:JSON.stringify(user)}]}],reasoning:{effort:'low'},max_output_tokens:500})});
 if(!resp.ok)throw new Error('OpenAI '+resp.status+': '+(await resp.text()).slice(0,500));
 const data=await resp.json(),raw=extractResponseText(data).trim();
 const parsed=JSON.parse(raw.replace(/^```json\s*/i,'').replace(/```$/,'').trim());
 return {enabled:true,classification:clean(parsed.classification)||'ضعيف',score:Number.isFinite(Number(parsed.score))?Math.max(0,Math.min(100,Number(parsed.score))):null,reason:clean(parsed.reason),newInformation:Array.isArray(parsed.new_information)?parsed.new_information.map(clean).filter(Boolean).slice(0,8):[],substantive:parsed.substantive===true,model};
}
function historyObj(r,rowNumber){
 return {
  rowNumber,eventId:clean(r[0]),capturedAt:clean(r[1]),source:clean(r[2]),sourceRow:Number(r[3]||0),workOrder:clean(r[4]),engineer:clean(r[5]),contractor:clean(r[6]),stage:clean(r[7]),
  advice:clean(r[8]),adviceTimestamp:clean(r[9]),adviceNormalized:clean(r[10]),previousAdvice:clean(r[11]),previousTimestamp:clean(r[12]),similarity:Number(r[13]||0),
  classification:clean(r[14]),score:r[15]===''||r[15]==null?null:Number(r[15]),reason:clean(r[16]),newInformation:clean(r[17]),substantive:String(r[18]).toUpperCase()==='TRUE',
  lastSubstantiveAt:clean(r[19]),model:clean(r[20]),analyzedAt:clean(r[21]),previousHash:clean(r[22]),currentHash:clean(r[23])
 };
}

async function readHistory({sheets,spreadsheetId}){
 await ensureHistorySheet({sheets,spreadsheetId});
 const range=`${qSheet(HISTORY_SHEET)}!A2:X10000`;
 const rows=(await sheets.spreadsheets.values.get({spreadsheetId,range,valueRenderOption:'UNFORMATTED_VALUE'})).data.values||[];
 return rows.map((r,i)=>historyObj(r,i+2)).filter(x=>x.workOrder);
}

function makeEventId(change,capturedAt){
 return hash([change.source,change.workOrder,change.row,change.adviceTimestamp,change.advice,capturedAt].join('|'));
}
function baselineAnalysis(item){
 const hasTrace=!!clean(item.advice)&&!!clean(item.adviceTimestamp);
 return {enabled:false,classification:'خط أساس',score:null,reason:'أول نسخة محفوظة؛ لا توجد نسخة سابقة للحكم على جوهر التغيير.',newInformation:[],substantive:hasTrace,model:''};
}

function cosmeticAnalysis(item,prev){
 return {enabled:true,classification:'شكلي',score:0,reason:'لم يتغير مضمون الإفادة بعد تجاهل المسافات والشرطات وعلامات الترقيم.',newInformation:[],substantive:false,model:'rule-prefilter'};
}

function eventRow(item,prev,analysis,capturedAt){
 const n=norm(item.advice),prevN=norm(prev?.advice||'');
 const lastSubstantive=analysis.substantive===true?(item.adviceTimestamp||capturedAt):(prev?.lastSubstantiveAt||prev?.adviceTimestamp||'');
 return [
  makeEventId(item,capturedAt),capturedAt,item.source,item.row,item.workOrder,item.engineer,item.contractor,item.stage,
  item.advice,item.adviceTimestamp,n,prev?.advice||'',prev?.adviceTimestamp||'',Math.round(similarity(prev?.advice||'',item.advice)*1000)/10,
  analysis.classification,analysis.score==null?'':analysis.score,analysis.reason,JSON.stringify(analysis.newInformation||[]),
  analysis.substantive===true?'TRUE':analysis.substantive===false?'FALSE':'',lastSubstantive,analysis.model||'',analysis.classification==='خط أساس'?'':capturedAt,
  prev?hash(prev.adviceNormalized||norm(prev.advice)):'',hash(n)
 ];
}
let syncPromise=null;
async function syncAdviceHistory(opts){
 if(syncPromise)return syncPromise;
 syncPromise=(async()=>{
  const {sheets,spreadsheetId,projectsSheet,connectionsSheet}=opts;
  await ensureHistorySheet({sheets,spreadsheetId});
  const history=await readHistory({sheets,spreadsheetId});
  const latest=new Map();for(const h of history)latest.set(keyOf(h.source,h.workOrder,h.sourceRow),h);
  const currentAll=[
   ...await readAdviceSource({sheets,spreadsheetId,sheetName:projectsSheet,source:'المشاريع'}),
   ...await readAdviceSource({sheets,spreadsheetId,sheetName:connectionsSheet,source:'التوصيلات'})
  ];
  const current=currentAll.filter(item=>!isClosingStage(item.stage));
  const activeKeys=new Set(current.map(item=>keyOf(item.source,item.workOrder,item.row)));
  const changes=currentAll.filter(item=>{const p=latest.get(keyOf(item.source,item.workOrder,item.row));return !p||p.advice!==item.advice||p.adviceTimestamp!==item.adviceTimestamp||p.stage!==item.stage;});
  const rows=[],created=[];let aiCalls=0,maxAi=Math.max(1,Number(process.env.ADVICE_AI_MAX_PER_SYNC||20));
  for(const item of changes){
   const prev=latest.get(keyOf(item.source,item.workOrder,item.row)),capturedAt=nowKsa();let analysis;
   if(isClosingStage(item.stage))analysis={enabled:false,classification:'مستبعد - مرحلة الإغلاق',score:null,reason:'أمر العمل في مرحلة الإغلاق؛ يُحفظ التغيير تاريخيًا ولا يُرسل لوكيل الذكاء الاصطناعي ولا يدخل في مؤشرات جودة الإفادات.',newInformation:[],substantive:null,model:''};
   else if(!prev)analysis=baselineAnalysis(item);
   else if(process.env.OPENAI_API_KEY&&aiCalls<maxAi){try{analysis=await analyzeWithAI({...item,previousAdvice:prev.advice,previousTimestamp:prev.adviceTimestamp});aiCalls++;}catch(e){analysis={enabled:false,classification:'بانتظار وكيل الذكاء الاصطناعي',score:null,reason:clean(e.message),newInformation:[],substantive:null,model:''};}}
   else analysis={enabled:false,classification:'بانتظار وكيل الذكاء الاصطناعي',score:null,reason:norm(prev.advice)===norm(item.advice)?'التحقق الأولي يشير إلى تعديل شكلي، لكن الحكم النهائي متروك لوكيل الذكاء الاصطناعي.':'بانتظار وكيل الذكاء الاصطناعي لتحليل القيمة التشغيلية للتغيير.',newInformation:[],substantive:null,model:''};
   const row=eventRow(item,prev,analysis,capturedAt);rows.push(row);
   const obj=historyObj(row,history.length+rows.length+1);created.push(obj);latest.set(keyOf(item.source,item.workOrder,item.row),obj);
  }
  if(rows.length)await sheets.spreadsheets.values.append({spreadsheetId,range:`${qSheet(HISTORY_SHEET)}!A:X`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:rows}});
  let finalHistory=[...history,...created];
  if(process.env.OPENAI_API_KEY){
   const remaining=Math.max(1,maxAi-aiCalls),reanalyzed=await reanalyzePending({sheets,spreadsheetId,limit:remaining,activeKeys});
   if(reanalyzed)finalHistory=await readHistory({sheets,spreadsheetId});
  }
  return buildSummary(finalHistory,{created:created.length,agentEnabled:!!process.env.OPENAI_API_KEY,activeKeys,excludedClosed:currentAll.length-current.length});
 })();
 try{return await syncPromise}finally{syncPromise=null}
}
function parseKsaStamp(v){
 const s=clean(v);if(!s)return null;
 const iso=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)?s.replace(' ','T')+(s.includes('+')||s.endsWith('Z')?'':'+03:00'):s;
 const d=new Date(iso);return isNaN(d)?null:d;
}
function daysSince(v){const d=parseKsaStamp(v);return d?Math.max(0,(Date.now()-d.getTime())/86400000):null}

function buildSummary(history,meta={}){
 const latest=new Map();for(const h of history)latest.set(keyOf(h.source,h.workOrder,h.sourceRow),h);
 const activeKeys=meta.activeKeys instanceof Set?meta.activeKeys:null;
 const current=[...latest.values()].filter(h=>!activeKeys||activeKeys.has(keyOf(h.source,h.workOrder,h.sourceRow)));
 const events=history.filter(h=>h.classification&&h.classification!=='خط أساس'&&!h.classification.startsWith('مستبعد')&&(!activeKeys||activeKeys.has(keyOf(h.source,h.workOrder,h.sourceRow))));
 const isSusp=h=>h.classification==='شكلي'||h.classification.includes('مشتبه');
 const counts={substantive:events.filter(h=>h.classification==='جوهري').length,weak:events.filter(h=>h.classification==='ضعيف').length,cosmetic:events.filter(h=>h.classification==='شكلي').length,suspicious:events.filter(isSusp).length,pending:events.filter(h=>h.classification.includes('بانتظار')).length};
 const age={fresh:0,old:0,veryOld:0,neglect:0,severe:0,unknown:0};
 current.forEach(h=>{const d=daysSince(h.lastSubstantiveAt);if(d==null)age.unknown++;else if(d>=15)age.severe++;else if(d>=10)age.neglect++;else if(d>=6)age.veryOld++;else if(d>=3)age.old++;else age.fresh++;});
 const engineerMap=new Map();for(const h of events.filter(isSusp)){const k=h.engineer||'غير محدد';engineerMap.set(k,(engineerMap.get(k)||0)+1)}
 const suspiciousByEngineer=[...engineerMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([engineer,count])=>({engineer,count}));
 const recent=events.slice(-120).reverse().map(h=>({eventId:h.eventId,capturedAt:h.capturedAt,source:h.source,row:h.sourceRow,workOrder:h.workOrder,engineer:h.engineer,contractor:h.contractor,stage:h.stage,previousAdvice:h.previousAdvice,currentAdvice:h.advice,previousTimestamp:h.previousTimestamp,currentTimestamp:h.adviceTimestamp,similarity:h.similarity,classification:h.classification,score:h.score,reason:h.reason,newInformation:h.newInformation,lastSubstantiveAt:h.lastSubstantiveAt,model:h.model}));
 const currentOrders=current.map(h=>({source:h.source,row:h.sourceRow,workOrder:h.workOrder,engineer:h.engineer,contractor:h.contractor,stage:h.stage,currentAdvice:h.advice,currentTimestamp:h.adviceTimestamp,lastSubstantiveAt:h.lastSubstantiveAt,daysSinceSubstantive:daysSince(h.lastSubstantiveAt),classification:h.classification,score:h.score}));
 return {sheet:HISTORY_SHEET,agentEnabled:!!meta.agentEnabled,created:meta.created||0,totalEvents:events.length,trackedOrders:current.length,excludedClosed:Number(meta.excludedClosed||0),counts,age,suspiciousByEngineer,recent,currentOrders};
}

async function reanalyzePending({sheets,spreadsheetId,limit=20,activeKeys=null}){
 if(!process.env.OPENAI_API_KEY)return 0;
 const history=await readHistory({sheets,spreadsheetId});
 const pending=history.filter(h=>h.classification.includes('بانتظار وكيل')&&(!activeKeys||activeKeys.has(keyOf(h.source,h.workOrder,h.sourceRow)))).slice(-Math.max(1,limit));
 let done=0;
 for(const h of pending){
  try{
   const analysis=await analyzeWithAI({source:h.source,workOrder:h.workOrder,engineer:h.engineer,contractor:h.contractor,stage:h.stage,advice:h.advice,adviceTimestamp:h.adviceTimestamp,previousAdvice:h.previousAdvice,previousTimestamp:h.previousTimestamp});
   const lastSub=analysis.substantive===true?(h.adviceTimestamp||h.capturedAt):h.lastSubstantiveAt;
   const values=[[analysis.classification,analysis.score==null?'':analysis.score,analysis.reason,JSON.stringify(analysis.newInformation||[]),analysis.substantive?'TRUE':'FALSE',lastSub,analysis.model||'',nowKsa()]];
   await sheets.spreadsheets.values.update({spreadsheetId,range:`${qSheet(HISTORY_SHEET)}!O${h.rowNumber}:V${h.rowNumber}`,valueInputOption:'RAW',requestBody:{values}});
   done++;
  }catch(e){console.warn('Advice AI pending analysis failed:',e.message||e)}
 }
 return done;
}
module.exports={HISTORY_SHEET,HEADERS,ensureHistorySheet,readAdviceSource,readHistory,syncAdviceHistory,buildSummary,analyzeWithAI,reanalyzePending,norm};