'use strict';
const WEIGHT_A=new Set('AQ AT AW AX AY BD BT BU BV BW BX'.split(' '));
const WEIGHT_B=new Set('AR AS AU AV AZ BA BG'.split(' '));
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const col=n=>{let x=n+1,s='';while(x){x--;s=String.fromCharCode(65+x%26)+s;x=Math.floor(x/26)}return s};
const weights=Array.from({length:34},(_,i)=>{const c=col(42+i);return WEIGHT_A.has(c)?7:WEIGHT_B.has(c)?2:.5});
const dateOf=v=>{if(typeof v==='number'){return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10)}const s=clean(v),m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:s};
const num=v=>{if(v==null||clean(v)==='')return null;const x=Number(clean(v).replace('%','').replace(/,/g,''));return Number.isFinite(x)&&x>=0&&x<=100?Math.round(x*100)/100:null};
const isBad=v=>clean(v).includes('نعم يوجد مخالفة');
function normalize(row,headers,rowIndex){
 const contractor=clean(row[4]),workOrder=clean(row[1]);
 if(!contractor||!workOrder)return null;
 const engineer=clean(row[2]).includes('بعاد الرؤية')?clean(row[3]):clean(row[2])||clean(row[3]);
 const violations=[];
 for(let i=0;i<34;i++)if(isBad(row[8+i]))violations.push({number:i+1,label:clean(headers[8+i]).replace(/^\d+\s*-\s*/,''),weight:weights[i]});
 return {row:rowIndex+1,date:dateOf(row[0]),workOrder,engineer,contractor,score:num(row[5]),violations,
   a:violations.filter(x=>x.weight===7).length,b:violations.filter(x=>x.weight===2).length,c:violations.filter(x=>x.weight===.5).length};
}
const cache=new Map();
async function getData({getSheets,spreadsheetId,city,refresh=false}){
 const key=city+':'+spreadsheetId,old=cache.get(key);
 if(!refresh&&old?.data&&Date.now()-old.time<180000)return old.data;
 if(old?.pending)return old.pending;
 const pending=(async()=>{
  const sheets=await getSheets();
  const response=await sheets.spreadsheets.values.get({spreadsheetId,range:"'Intellect'!A1:AP",
    valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'SERIAL_NUMBER'});
  const rows=(response.data.values||[]);
  if(clean(rows[0]?.[0]).toLowerCase()!=='timestamp'||!clean(rows[0]?.[4]).includes('المقاول'))
   throw new Error('بنية أعمدة Intellect غير متوافقة مع التقرير');
  const parsed=[];
  for(let i=2;i<rows.length;i++){const x=normalize(rows[i]||[],rows[0],i);if(x)parsed.push(x)}
  const data={ok:true,city,source:'Intellect',updatedAt:new Date().toISOString(),rows:parsed};
  cache.set(key,{data,time:Date.now()});
  return data;
 })();
 cache.set(key,{pending});
 try{return await pending}
 catch(e){cache.delete(key);throw e}
}
module.exports={getData,normalize,weights};
