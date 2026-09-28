const topo=require('topojson-client');const land=require('world-atlas/land-50m.json');
const f=topo.feature(land,land.objects.land);
const polys=[];for(const g of f.features){const geom=g.geometry;const P=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;for(const p of P)for(const ring of p)polys.push(ring);}
// bbox per ring
const R=polys.map(r=>{let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const [x,y] of r){a=Math.min(a,x);b=Math.max(b,x);c=Math.min(c,y);d=Math.max(d,y);}return {r,a,b,c,d};});
function inside(x,y){let c=false;for(const o of R){if(x<o.a||x>o.b||y<o.c||y>o.d)continue;const r=o.r;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}}return c;}
const S=0.5,W=360/S,H=180/S;const rows=[];let landCount=0;
for(let j=0;j<H;j++){const lat=90-(j+0.5)*S;let runs=[];let cur=false,n=0;for(let i=0;i<W;i++){const lon=-180+(i+0.5)*S;const v=inside(lon,lat);if(v)landCount++;if(v===cur)n++;else{runs.push(n);cur=v;n=1;}}runs.push(n);rows.push(runs.map(x=>x.toString(36)).join('.'));}
const s=rows.join('|');console.log(s.length,landCount);
require('fs').writeFileSync('mask.txt',s);
