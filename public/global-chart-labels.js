(()=>{'use strict';
if(!window.Chart||window.__VD_GLOBAL_VALUE_LABELS__)return;
window.__VD_GLOBAL_VALUE_LABELS__=true;

const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});

function numValue(raw,type){
  if(raw===null||raw===undefined||raw==='')return null;
  if(typeof raw==='number')return Number.isFinite(raw)?raw:null;
  if(typeof raw==='string'){
    const n=Number(raw.replace(/,/g,''));
    return Number.isFinite(n)?n:null;
  }
  if(typeof raw==='object'){
    if(type==='bubble'&&Number.isFinite(Number(raw.r)))return Number(raw.r);
    if(Number.isFinite(Number(raw.y)))return Number(raw.y);
    if(Number.isFinite(Number(raw.x)))return Number(raw.x);
  }
  return null;
}
function formatValue(v){
  if(!Number.isFinite(v))return '';
  return nf.format(v);
}
function colorOf(ds,index){
  let c=ds.borderColor||ds.backgroundColor||'#2d5b97';
  if(Array.isArray(c))c=c[index%c.length];
  return typeof c==='string'?c:'#2d5b97';
}
function roundedRect(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function pill(ctx,text,x,y,border,fontSize,align='center'){
  if(!text)return {w:0,h:0};
  ctx.font=`800 ${fontSize}px Cairo, Tahoma, Arial, sans-serif`;
  const padX=fontSize<=8?4:6;
  const h=fontSize+8;
  const w=Math.ceil(ctx.measureText(text).width)+padX*2;
  let rx=x-w/2;
  if(align==='left')rx=x;
  if(align==='right')rx=x-w;
  const ry=y-h/2;
  ctx.save();
  ctx.fillStyle='rgba(255,255,255,.96)';
  ctx.strokeStyle=border||'#2d5b97';
  ctx.lineWidth=1.25;
  roundedRect(ctx,rx,ry,w,h,5);
  ctx.fill();ctx.stroke();
  ctx.fillStyle='#172b5f';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(text,rx+w/2,ry+h/2+.3);
  ctx.restore();
  return {w,h,x:rx,y:ry};
}
function hasOwnValuePlugin(chart){
  const ps=chart?.config?.plugins||[];
  if(ps.some(p=>p&&['stpValueLabels','reportPointLabels'].includes(p.id)))return true;
  if(chart?.options?.plugins?.stpValueLabels?.enabled===true)return true;
  return false;
}
function collides(occupied,x,y,w,h){
  return occupied.some(r=>!(x+w<r.x||x>r.x+r.w||y+h<r.y||y>r.y+r.h));
}
function placePill(ctx,text,x,y,border,fontSize,occupied,area,preferred='up'){
  ctx.font=`800 ${fontSize}px Cairo, Tahoma, Arial, sans-serif`;
  const w=Math.ceil(ctx.measureText(text).width)+(fontSize<=8?8:12);
  const h=fontSize+8;
  const shifts=preferred==='side'
    ? [[0,0],[0,-h-3],[0,h+3],[-w-10,0],[w+10,0]]
    : [[0,0],[0,-h-3],[0,h+3],[-w/2-8,0],[w/2+8,0],[-w/2-8,-h-2],[w/2+8,-h-2]];
  let cx=x,cy=y;
  for(const [dx,dy] of shifts){
    let tx=x+dx-w/2,ty=y+dy-h/2;
    if(area){
      tx=Math.max(area.left+1,Math.min(tx,area.right-w-1));
      ty=Math.max(area.top+1,Math.min(ty,area.bottom-h-1));
    }
    if(!collides(occupied,tx,ty,w,h)){cx=tx+w/2;cy=ty+h/2;break;}
    cx=tx+w/2;cy=ty+h/2;
  }
  const box=pill(ctx,text,cx,cy,border,fontSize);
  occupied.push({x:box.x,y:box.y,w:box.w,h:box.h});
}
const plugin={
  id:'vdGlobalValueLabels',
  beforeInit(chart){
    const existing=chart.options.layout?.padding||{};
    const obj=typeof existing==='number'
      ? {top:existing,right:existing,bottom:existing,left:existing}
      : {...existing};
    chart.options.layout=chart.options.layout||{};
    chart.options.layout.padding={
      top:Math.max(Number(obj.top||0),18),
      right:Math.max(Number(obj.right||0),18),
      bottom:Math.max(Number(obj.bottom||0),10),
      left:Math.max(Number(obj.left||0),18)
    };
  },
  afterDatasetsDraw(chart,args,opts){
    if(opts===false||opts?.display===false||hasOwnValuePlugin(chart))return;
    const ctx=chart.ctx,area=chart.chartArea;
    if(!ctx||!area)return;
    const fontSize=chart.width<300?8:chart.width<500?9:10;
    const occupied=[];
    const stackedTotals=new Map();

    chart.data.datasets.forEach((ds,di)=>{
      const meta=chart.getDatasetMeta(di);
      if(!meta||meta.hidden)return;
      const type=meta.type||chart.config.type||'bar';
      const isArc=['doughnut','pie','polarArea'].includes(type);
      const horizontal=chart.options.indexAxis==='y';
      const stacked=!!(meta.vScale?.options?.stacked||meta.iScale?.options?.stacked);

      meta.data.forEach((el,pi)=>{
        if(!el||el.hidden)return;
        const value=numValue(ds.data?.[pi],type);
        if(value===null)return;
        const text=formatValue(value);
        const border=colorOf(ds,pi);

        if(isArc){
          const props=el.getProps?el.getProps(['x','y','startAngle','endAngle','innerRadius','outerRadius'],true):el;
          const angle=(props.startAngle+props.endAngle)/2;
          const span=Math.max(0,props.endAngle-props.startAngle);
          const midR=(props.innerRadius+props.outerRadius)/2;
          if(span<0.22){
            const r=props.outerRadius+13;
            const x=props.x+Math.cos(angle)*r;
            const y=props.y+Math.sin(angle)*r;
            ctx.save();
            ctx.strokeStyle=border;ctx.lineWidth=1;
            ctx.beginPath();
            ctx.moveTo(props.x+Math.cos(angle)*(props.outerRadius-1),props.y+Math.sin(angle)*(props.outerRadius-1));
            ctx.lineTo(x,y);ctx.stroke();ctx.restore();
            placePill(ctx,text,x,y,border,fontSize,occupied,area,'side');
          }else{
            const x=props.x+Math.cos(angle)*midR;
            const y=props.y+Math.sin(angle)*midR;
            placePill(ctx,text,x,y,border,fontSize,occupied,area,'side');
          }
          return;
        }

        const pos=el.tooltipPosition?el.tooltipPosition():{x:el.x,y:el.y};
        if(type==='line'||type==='scatter'||type==='bubble'){
          placePill(ctx,text,pos.x,pos.y-(fontSize+10),border,fontSize,occupied,area,'up');
          return;
        }

        if(type==='bar'){
          const props=el.getProps?el.getProps(['x','y','base','width','height'],true):el;
          if(stacked){
            const x=horizontal?(props.x+props.base)/2:props.x;
            const y=horizontal?props.y:(props.y+props.base)/2;
            placePill(ctx,text,x,y,border,fontSize,occupied,area,'side');
            const key=pi;
            stackedTotals.set(key,(stackedTotals.get(key)||0)+value);
          }else if(horizontal){
            const dir=props.x>=props.base?1:-1;
            const x=props.x+dir*(fontSize+10);
            placePill(ctx,text,x,props.y,border,fontSize,occupied,area,'side');
          }else{
            const dir=props.y<=props.base?-1:1;
            const y=props.y+dir*(fontSize+10);
            placePill(ctx,text,props.x,y,border,fontSize,occupied,area,'up');
          }
          return;
        }

        placePill(ctx,text,pos.x,pos.y-(fontSize+8),border,fontSize,occupied,area,'up');
      });
    });

    if(stackedTotals.size){
      const firstVisible=chart.data.datasets.findIndex((ds,i)=>!chart.getDatasetMeta(i).hidden);
      const meta=firstVisible>=0?chart.getDatasetMeta(firstVisible):null;
      if(meta){
        const horizontal=chart.options.indexAxis==='y';
        stackedTotals.forEach((total,pi)=>{
          const elements=chart.data.datasets.map((ds,i)=>chart.getDatasetMeta(i)).filter(m=>!m.hidden).map(m=>m.data?.[pi]).filter(Boolean);
          if(!elements.length)return;
          if(horizontal){
            const far=elements.reduce((a,b)=>Math.abs((b.x||0)-(b.base||0))>Math.abs((a.x||0)-(a.base||0))?b:a,elements[0]);
            placePill(ctx,'Σ '+formatValue(total),(far.x||0)+18,far.y||0,'#172b5f',fontSize,occupied,area,'side');
          }else{
            const top=elements.reduce((a,b)=>(b.y||Infinity)<(a.y||Infinity)?b:a,elements[0]);
            placePill(ctx,'Σ '+formatValue(total),top.x||0,(top.y||0)-18,'#172b5f',fontSize,occupied,area,'up');
          }
        });
      }
    }
  }
};
Chart.register(plugin);
Chart.defaults.plugins.vdGlobalValueLabels={display:true};
window.VDGlobalValueLabels=plugin;
})();