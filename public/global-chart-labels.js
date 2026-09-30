(()=>{'use strict';
if(!window.Chart||window.__VD_GLOBAL_VALUE_LABELS_SAFE__)return;
window.__VD_GLOBAL_VALUE_LABELS_SAFE__=true;

function n(raw,type){
  if(raw==null||raw==='')return null;
  if(typeof raw==='number')return Number.isFinite(raw)?raw:null;
  if(typeof raw==='string'){const v=Number(raw.replace(/,/g,''));return Number.isFinite(v)?v:null;}
  if(typeof raw==='object'){
    const v=type==='bubble'?Number(raw.r):Number(raw.y);
    return Number.isFinite(v)?v:null;
  }
  return null;
}
function fmt(v){
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(v);
}
function color(ds,i){
  const c=Array.isArray(ds.borderColor)?ds.borderColor[i%ds.borderColor.length]:
          Array.isArray(ds.backgroundColor)?ds.backgroundColor[i%ds.backgroundColor.length]:
          ds.borderColor||ds.backgroundColor||'#2d5b97';
  return typeof c==='string'?c:'#2d5b97';
}
function ownLabels(chart){
  const ps=chart?.config?.plugins;
  return Array.isArray(ps)&&ps.some(p=>p&&['stpValueLabels','reportPointLabels','vdGlobalValueLabels'].includes(p.id));
}
function box(ctx,text,cx,cy,border,fs,area){
  ctx.save();
  ctx.font='800 '+fs+'px Cairo, Tahoma, Arial, sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  const w=Math.ceil(ctx.measureText(text).width)+10,h=fs+8;
  let x=cx-w/2,y=cy-h/2;
  if(area){
    x=Math.max(area.left+1,Math.min(x,area.right-w-1));
    y=Math.max(area.top+1,Math.min(y,area.bottom-h-1));
  }
  ctx.fillStyle='rgba(255,255,255,.96)';
  ctx.strokeStyle=border;ctx.lineWidth=1;
  ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
  ctx.fillStyle='#172b5f';
  ctx.fillText(text,x+w/2,y+h/2+.2);
  ctx.restore();
}
const plugin={
  id:'vdGlobalValueLabels',
  afterDatasetsDraw(chart,args,opts){
    if(opts===false||opts?.display===false||ownLabels(chart))return;
    const ctx=chart.ctx,area=chart.chartArea;
    if(!ctx||!area)return;
    const fs=chart.width<300?8:chart.width<520?9:10;
    const totals=new Map();

    chart.data.datasets.forEach((ds,di)=>{
      const meta=chart.getDatasetMeta(di);
      if(!meta||meta.hidden)return;
      const type=meta.type||chart.config.type||'bar';
      const horizontal=chart.options?.indexAxis==='y';
      const stacked=!!(meta.vScale?.options?.stacked||meta.iScale?.options?.stacked);

      meta.data.forEach((el,pi)=>{
        if(!el||el.hidden)return;
        const value=n(ds.data?.[pi],type);
        if(value==null)return;
        const text=fmt(value),stroke=color(ds,pi);

        if(type==='doughnut'||type==='pie'||type==='polarArea'){
          const p=el.getProps?el.getProps(['x','y','startAngle','endAngle','innerRadius','outerRadius'],true):el;
          const angle=((p.startAngle||0)+(p.endAngle||0))/2;
          const inner=Number(p.innerRadius||0),outer=Number(p.outerRadius||0);
          const span=Math.max(0,Number(p.endAngle||0)-Number(p.startAngle||0));
          const r=span<0.28?outer+12:(inner+outer)/2;
          const x=Number(p.x||0)+Math.cos(angle)*r;
          const y=Number(p.y||0)+Math.sin(angle)*r;
          box(ctx,text,x,y,stroke,fs,area);
          return;
        }

        const pos=el.tooltipPosition?el.tooltipPosition():{x:el.x,y:el.y};
        if(type==='line'||type==='scatter'||type==='bubble'){
          box(ctx,text,pos.x,pos.y-(fs+10),stroke,fs,area);
          return;
        }

        if(type==='bar'){
          const p=el.getProps?el.getProps(['x','y','base'],true):el;
          if(stacked){
            const x=horizontal?(Number(p.x||0)+Number(p.base||0))/2:Number(p.x||0);
            const y=horizontal?Number(p.y||0):(Number(p.y||0)+Number(p.base||0))/2;
            box(ctx,text,x,y,stroke,fs,area);
            totals.set(pi,(totals.get(pi)||0)+value);
          }else if(horizontal){
            const dir=Number(p.x||0)>=Number(p.base||0)?1:-1;
            box(ctx,text,Number(p.x||0)+dir*(fs+12),Number(p.y||0),stroke,fs,area);
          }else{
            const dir=Number(p.y||0)<=Number(p.base||0)?-1:1;
            box(ctx,text,Number(p.x||0),Number(p.y||0)+dir*(fs+12),stroke,fs,area);
          }
          return;
        }

        box(ctx,text,pos.x,pos.y-(fs+10),stroke,fs,area);
      });
    });

    if(totals.size){
      const visible=chart.data.datasets.map((_,i)=>chart.getDatasetMeta(i)).filter(m=>m&&!m.hidden);
      totals.forEach((total,pi)=>{
        const els=visible.map(m=>m.data?.[pi]).filter(Boolean);
        if(!els.length)return;
        const horizontal=chart.options?.indexAxis==='y';
        if(horizontal){
          const far=els.reduce((a,b)=>Number(b.x||0)>Number(a.x||0)?b:a,els[0]);
          box(ctx,'Σ '+fmt(total),Number(far.x||0)+22,Number(far.y||0),'#172b5f',fs,area);
        }else{
          const top=els.reduce((a,b)=>Number(b.y||1e9)<Number(a.y||1e9)?b:a,els[0]);
          box(ctx,'Σ '+fmt(total),Number(top.x||0),Number(top.y||0)-20,'#172b5f',fs,area);
        }
      });
    }
  }
};
Chart.register(plugin);
Chart.defaults.plugins.vdGlobalValueLabels={display:true};
window.VDGlobalValueLabels=plugin;
})();