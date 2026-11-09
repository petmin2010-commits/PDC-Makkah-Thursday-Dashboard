'use strict';
/**
 * Read-only Naif diagnostics. Does not disclose credentials, spreadsheet IDs,
 * tab contents or user identity. Every probe is independent.
 */
module.exports = function installNaifDiagnostics({app,requireAuth_,getSheets,spreadsheetId,city}) {
  const probe=async(name,fn)=>{
    const start=Date.now();
    try {const result=await Promise.race([fn(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('TIMEOUT')),10000))]);return {name,status:'ok',elapsedMs:Date.now()-start,...result};}
    catch(e){const code=Number(e?.code||e?.response?.status||0);return {name,status:'error',elapsedMs:Date.now()-start,reason:code===403?'GOOGLE_ACCESS_DENIED':code===404?'SHEET_NOT_FOUND':code===401?'AUTH_REJECTED':/TIMEOUT/.test(String(e.message))?'TIMEOUT':/Unable to parse range/.test(String(e.message))?'INVALID_SHEET_RANGE':'CHECK_FAILED'};}
  };
  app.get('/api/naif/diagnostics',requireAuth_,async(req,res)=>{
    res.set('Cache-Control','no-store');
    const checks=[{name:'runtime',status:'ok',uptimeSeconds:Math.round(process.uptime())}];
    checks.push({name:'openaiKey',status:process.env.OPENAI_API_KEY||process.env.OPENAI_API_KEY_BACKUP?'configured':'not_configured',note:'Configuration only; no paid model request is performed'});
    checks.push({name:'naifConversation',status:'not_tested',note:'Dedicated Naif conversation endpoint not established by this diagnostic'});
    checks.push({name:'voiceAndCalls',status:'not_tested',note:'Requires consented interactive voice/telephone test'});
    checks.push({name:'pcloud',status:'not_tested',note:'No validated pCloud connection probe configured'});
    if(!spreadsheetId){checks.push({name:'googleSheets',status:'not_configured'});}
    else {
      checks.push(await probe('googleSheets',async()=>{
        const api=await getSheets();
        const meta=await api.spreadsheets.get({spreadsheetId,fields:'sheets(properties(title)),spreadsheetId'});
        const tabs=meta.data.sheets||[];
        if(!tabs.length)return {status:'warning',tabCount:0};
        const first=tabs[0].properties.title;
        await api.spreadsheets.values.get({spreadsheetId,range:"'"+first.replace(/'/g,"''")+"'!A1:A2"});
        return {tabCount:tabs.length,sampleRead:'ok'};
      }));
    }
    const counts={ok:checks.filter(x=>x.status==='ok').length,error:checks.filter(x=>x.status==='error').length,notTested:checks.filter(x=>['not_tested','not_configured','configured','warning'].includes(x.status)).length};
    res.json({ok:true,agent:'نايف',city,generatedAt:new Date().toISOString(),checks,counts,disclaimer:'Runtime probe only; conversational and telephone functions require separate tests'});
  });
};
