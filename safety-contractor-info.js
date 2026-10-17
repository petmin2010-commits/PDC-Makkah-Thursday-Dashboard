'use strict';
// The corrective safety contractor selector reads only the dedicated project info sheet.
// Both city dashboards use their own configured SPREADSHEET_ID via valuesGet.
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
module.exports=async function readSafetyContractorsFromInfo({valuesGet,qSheet}){
 if(typeof valuesGet!=='function'||typeof qSheet!=='function')throw new Error('Safety info source is not configured.');
 const rows=await valuesGet(qSheet('info')+'!A2:A');
 if(!Array.isArray(rows))throw new Error('تعذر قراءة قائمة المقاولين من ورقة info.');
 return [...new Set(rows.map(row=>clean(Array.isArray(row)?row[0]:'')).filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,'ar'));
};
