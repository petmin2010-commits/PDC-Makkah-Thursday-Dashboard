'use strict';
const crypto=require('crypto');
const TAB='🤖 تعلم نايف';
const norm=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064b-\u065f\u0640]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const clean=(v,n=1200)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
const safePage=p=>String(p||'').trim();
function createNaifLearning({getSheets,spreadsheetId,requireAdmin,canPage}){
 const header=['id','date','submittedBy','page','question','answer','status','reviewedBy','reviewedAt'];
 let tabChecked=false,cache=null,expires=0;
 async function ensure(){if(tabChecked)return;const sheets=await getSheets();const meta=await sheets.spreadsheets.get({spreadsheetId,fields:'sheets(properties(title))'});if(!(meta.data.sheets||[]).some(s=>s.properties?.title===TAB)){await sheets.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests:[{addSheet:{properties:{title:TAB}}}]}});await sheets.spreadsheets.values.update({spreadsheetId,range:"'"+TAB+"'!A1:I1",valueInputOption:'RAW',requestBody:{values:[header]}})}tabChecked=true}
 async function list(){if(cache&&Date.now()<expires)return cache;await ensure();const sheets=await getSheets();const r=await sheets.spreadsheets.values.get({spreadsheetId,range:"'"+TAB+"'!A:I"});const v=r.data.values||[];cache=v.slice(1).map((row,i)=>({row:i+2,id:row[0],date:row[1],submittedBy:row[2],page:row[3],question:row[4],answer:row[5],status:row[6],reviewedBy:row[7],reviewedAt:row[8]})).filter(x=>x.id);expires=Date.now()+30000;return cache}
 function allowed(x,user){return !x.page||canPage(user,x.page)}
 return{
  async submit({user,page,question,answer}){
   if(!user?.email)throw Error('LOGIN_REQUIRED');page=safePage(page);if(page&&!canPage(user,page))throw Error('PAGE_FORBIDDEN');
   question=clean(question,450);answer=clean(answer,1500);
   if(question.length<5||answer.length<8)throw Error('LESSON_TOO_SHORT');
   if(/(?:password|token|secret|private.?key|كلمة المرور|كلمه المرور)/i.test(question+' '+answer))throw Error('SENSITIVE_CONTENT_NOT_ALLOWED');
   await ensure();const sheets=await getSheets();const id=crypto.randomUUID();
   await sheets.spreadsheets.values.append({spreadsheetId,range:"'"+TAB+"'!A:I",valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[id,new Date().toISOString(),clean(user.email,180),page,question,answer,'pending','','']]}});
   cache=null;return{id,status:'pending',message:'سُجل الدرس وينتظر موافقة مدير النظام؛ لن يؤثر على الإجابات قبل الاعتماد'};
  },
  async review({user,id,approve}){if(!requireAdmin(user))throw Error('ADMIN_REQUIRED');const rows=await list();const lesson=rows.find(x=>x.id===id);if(!lesson)throw Error('LESSON_NOT_FOUND');const sheets=await getSheets();await sheets.spreadsheets.values.update({spreadsheetId,range:"'"+TAB+"'!G"+lesson.row+":I"+lesson.row,valueInputOption:'RAW',requestBody:{values:[[approve?'approved':'rejected',clean(user.email,180),new Date().toISOString()]]}});cache=null;return{ok:true,status:approve?'approved':'rejected'}},
  async pending({user}){if(!requireAdmin(user))throw Error('ADMIN_REQUIRED');return(await list()).filter(x=>x.status==='pending').slice(-80)},
  async relevant({user,question,limit=4}){const q=new Set(norm(question).split(' ').filter(w=>w.length>2));return(await list()).filter(x=>x.status==='approved'&&allowed(x,user)).map(x=>({x,score:norm(x.question+' '+x.answer).split(' ').filter(w=>q.has(w)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(({x})=>({page:x.page,question:x.question,answer:x.answer,date:x.reviewedAt}))}
 }
}
module.exports={createNaifLearning};
