const {zipSync,strToU8}=require('fflate');

function xmlEsc(value){
  return String(value??'')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function colLetter(n){
  let s='';
  for(let x=Number(n)||0;x>0;x=Math.floor((x-1)/26)){
    s=String.fromCharCode(65+((x-1)%26))+s;
  }
  return s;
}
function sheetTabName(name){
  return String(name||'Report').slice(0,31).replace(/[\\/?*[\]:]/g,'_')||'Report';
}
function buildXlsx(rows,sheetName){
  const data=Array.isArray(rows)&&rows.length?rows:[['']];
  const widths=(data[0]||[]).map((_,j)=>
    Math.min(50,Math.max(12,...data.slice(0,300).map(r=>String(r?.[j]??'').length+2)))
  );
  const rowXml=data.map((row,i)=>{
    const cells=(row||[]).map((v,j)=>{
      const style=i===0?' s="1"':'';
      return '<c r="'+colLetter(j+1)+(i+1)+'" t="inlineStr"'+style+'><is><t xml:space="preserve">'+xmlEsc(v)+'</t></is></c>';
    }).join('');
    return '<row r="'+(i+1)+'"'+(i===0?' ht="24" customHeight="1"':'')+'>'+cells+'</row>';
  }).join('');
  const colsXml=widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('');
  const tab=sheetTabName(sheetName);
  const sheetXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    +'<sheetFormatPr defaultRowHeight="15"/><cols>'+colsXml+'</cols><sheetData>'+rowXml+'</sheetData></worksheet>';
  const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    +'<sheets><sheet name="'+xmlEsc(tab)+'" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wbRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    +'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    +'<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    +'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    +'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs>'
    +'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    +'<Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    +'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const zipped=zipSync({
    '[Content_Types].xml':strToU8(types),
    '_rels/.rels':strToU8(rels),
    'xl/workbook.xml':strToU8(workbook),
    'xl/_rels/workbook.xml.rels':strToU8(wbRels),
    'xl/styles.xml':strToU8(styles),
    'xl/worksheets/sheet1.xml':strToU8(sheetXml)
  },{level:6});
  return Buffer.from(zipped);
}
function installExcelExportRoutes(ctx){
  const {app,requireAuth_,getSheets,valuesGet,SPREADSHEET_ID,USERS_SHEET,qSheet,clean_,APP,DateTime}=ctx;
  const blocked=new Set([String(USERS_SHEET||'').toLowerCase(),'dashboard history','vd thursday progress']);
  const normPerm=value=>String(value??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/ـ/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
  function requireExcelAccess(req,res,next){
    const permissions=Array.isArray(req.session?.user?.permissions)?req.session.user.permissions:[];
    const keys=new Set(permissions.map(normPerm));
    const all=[...keys].some(v=>['*','all',normPerm('الكل'),normPerm('جميع الصفحات'),normPerm('كامل الصلاحيات')].includes(v));
    const allowed=all||keys.has(normPerm('تصدير تقرير اكسيل'));
    if(allowed)return next();
    return res.status(403).json({ok:false,error:'لا توجد صلاحية لتصدير تقارير Excel'});
  }

  const CATALOG_TTL_MS=10*60*1000;
  let catalogCache=null;
  let catalogInFlight=null;

  function quotaExceeded(error){
    const code=Number(error?.code||error?.response?.status||0);
    const msg=String(error?.message||error?.response?.data?.error?.message||'');
    return code===429||/quota exceeded|read requests per minute/i.test(msg);
  }

  function parseHeader(sample){
    const rows=Array.isArray(sample)?sample:[];
    const maxFilled=Math.max(0,...rows.map(row=>(row||[]).filter(v=>clean_(v)!=='').length));
    const threshold=Math.max(1,Math.ceil(maxFilled*.5));
    let headerRowIndex=rows.findIndex(row=>(row||[]).filter(v=>clean_(v)!=='').length>=threshold);
    if(headerRowIndex<0)headerRowIndex=0;
    const header=rows[headerRowIndex]||[];
    const columns=[];
    header.forEach((v,i)=>{
      const label=clean_(v);
      if(label)columns.push({index:i,letter:colLetter(i+1),label});
    });
    return {headerRow:headerRowIndex+1,columns};
  }

  async function buildCatalog(){
    const sheets=await getSheets();
    const meta=await sheets.spreadsheets.get({
      spreadsheetId:SPREADSHEET_ID,
      fields:'properties(title),sheets.properties(title,sheetType,hidden,gridProperties(rowCount,columnCount))'
    });
    const defs=(meta.data.sheets||[]).map(s=>s.properties||{})
      .filter(p=>p.sheetType==='GRID'&&!p.hidden&&!blocked.has(clean_(p.title).toLowerCase()));

    let valueRanges=[];
    if(defs.length){
      const batch=await sheets.spreadsheets.values.batchGet({
        spreadsheetId:SPREADSHEET_ID,
        ranges:defs.map(p=>qSheet(p.title)+'!1:12'),
        valueRenderOption:'FORMATTED_VALUE',
        dateTimeRenderOption:'FORMATTED_STRING'
      });
      valueRanges=batch.data.valueRanges||[];
    }

    return {
      spreadsheetTitle:clean_(meta.data.properties?.title)||APP.TITLE,
      sheets:defs.map((p,i)=>{
        const parsed=parseHeader(valueRanges[i]?.values||[]);
        return {
          title:p.title,
          rowCount:Number(p.gridProperties?.rowCount||0),
          columnCount:Number(p.gridProperties?.columnCount||0),
          headerRow:parsed.headerRow,
          columns:parsed.columns
        };
      }),
      cachedAt:Date.now()
    };
  }

  async function catalog(force=false){
    const now=Date.now();
    if(!force&&catalogCache&&now-catalogCache.cachedAt<CATALOG_TTL_MS)return catalogCache;
    if(catalogInFlight)return catalogInFlight;
    catalogInFlight=(async()=>{
      try{
        const fresh=await buildCatalog();
        catalogCache=fresh;
        return fresh;
      }catch(error){
        if(catalogCache)return {...catalogCache,stale:true};
        if(quotaExceeded(error)){
          const e=new Error('تم بلوغ حد قراءة Google Sheets مؤقتًا. حاول مرة أخرى بعد نحو دقيقة.');
          e.code=429;
          throw e;
        }
        throw error;
      }finally{
        catalogInFlight=null;
      }
    })();
    return catalogInFlight;
  }

  async function columnsFor(sheetName){
    const meta=await catalog(false);
    const found=meta.sheets.find(s=>s.title===sheetName);
    if(!found)throw new Error('الورقة غير متاحة للتصدير.');
    return {sheet:sheetName,headerRow:found.headerRow||1,columns:found.columns||[]};
  }

  async function workbookFor(sheetName,columnIndexes,headerRow){
    const meta=catalogCache||await catalog(false);
    if(!meta.sheets.some(s=>s.title===sheetName))throw new Error('الورقة غير متاحة للتصدير.');
    const cols=[...new Set((Array.isArray(columnIndexes)?columnIndexes:[])
      .map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<2000))].sort((a,b)=>a-b);
    if(!cols.length)throw new Error('اختر عمودًا واحدًا على الأقل.');
    const startRow=Math.max(1,Math.min(100,Number(headerRow)||1));
    const min=Math.min(...cols),max=Math.max(...cols);
    const range=qSheet(sheetName)+'!'+colLetter(min+1)+startRow+':'+colLetter(max+1);
    const raw=await valuesGet(range);
    const picked=raw.map(row=>cols.map(idx=>row[idx-min]??''));
    while(picked.length>1&&picked[picked.length-1].every(v=>clean_(v)===''))picked.pop();
    return buildXlsx(picked,sheetName);
  }

  app.get('/api/excel-export/sheets',requireAuth_,requireExcelAccess,async(req,res)=>{
    try{
      res.set('Cache-Control','private, max-age=60');
      res.json({ok:true,...await catalog(false)});
    }catch(e){
      console.error(e);
      res.status(Number(e?.code)===429?429:500).json({ok:false,error:e.message||String(e)});
    }
  });

  app.get('/api/excel-export/columns',requireAuth_,requireExcelAccess,async(req,res)=>{
    try{
      res.set('Cache-Control','no-store');
      res.json({ok:true,...await columnsFor(String(req.query.sheet||''))});
    }catch(e){
      console.error(e);
      res.status(400).json({ok:false,error:e.message||String(e)});
    }
  });

  app.post('/api/excel-export',requireAuth_,requireExcelAccess,async(req,res)=>{
    try{
      const sheet=String(req.body?.sheet||'');
      const columns=Array.isArray(req.body?.columns)?req.body.columns:[];
      const headerRow=Number(req.body?.headerRow||1);
      const buffer=await workbookFor(sheet,columns,headerRow);
      const city=/مكة|makkah/i.test(APP.TITLE)?'Makkah':'Jeddah';
      const stamp=DateTime.now().setZone(APP.TZ||'Asia/Riyadh').toFormat('yyyyLLdd_HHmmss');
      const safe=String(sheet||'Sheet').replace(/[\\/:*?"<>|]/g,'-').slice(0,70);
      const filename='Excel_Report_'+city+'_'+safe+'_'+stamp+'.xlsx';
      res.set('Cache-Control','no-store');
      res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition','attachment; filename="Excel_Report_'+city+'_'+stamp+'.xlsx"; filename*=UTF-8\'\''+encodeURIComponent(filename));
      res.send(buffer);
    }catch(e){
      console.error(e);
      res.status(400).json({ok:false,error:e.message||String(e)});
    }
  });
}

installExcelExportRoutes.buildXlsx=buildXlsx;
module.exports=installExcelExportRoutes;
