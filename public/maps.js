let loading;
const safeLabel=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function loadMap(ak){
  if(window.BMap?.Map)return Promise.resolve(window.BMap);
  if(!ak)return Promise.reject(new Error('地图还未连接；当前可远程阅读故事。'));
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    let finished=false;const script=document.createElement('script');
    const done=error=>{if(finished)return;finished=true;clearTimeout(timer);if(error){script.remove();loading=null;reject(error);}else resolve(window.BMap);};
    const timer=setTimeout(()=>done(new Error('地图加载超时，请检查网络和 AK 的域名白名单。')),15000);
    window.borrowBaiduReady=()=>window.BMap?.Map?done():done(new Error('地图初始化失败，请检查浏览器端 AK。'));
    script.src=`https://api.map.baidu.com/api?v=4.0&ak=${encodeURIComponent(ak)}&callback=borrowBaiduReady`;
    script.onerror=()=>done(new Error('地图加载失败，请检查网络。'));document.head.append(script);
  });return loading;
}
export async function searchPlaces(ak,city,query){const B=await loadMap(ak);return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{done=true;reject(new Error('地点搜索超时，请重试。'));},12000);const search=new B.LocalSearch(city,{onSearchComplete(result){if(done)return;done=true;clearTimeout(timer);if(search.getStatus()!==0||!result)return reject(new Error('未找到地点，请加上街道或城市重试。'));const pois=[];for(let i=0;i<Math.min(result.getCurrentNumPois(),6);i++){const p=result.getPoi(i);if(p.point)pois.push({name:p.title,address:p.address||p.title,point:{lng:p.point.lng,lat:p.point.lat,coordType:'bd09ll'}});}resolve(pois);}});search.search(query);});}
export async function routeMap(container,route,ak,onNote,active=0,options={}){
  if(route.stops.some(s=>s.point?.coordType==='gcj02'))throw new Error('这条路线使用 Agent 地点，请连接服务端地图服务后查看步行地图。');
  const B=await loadMap(ak);const alive=()=>container.isConnected&&(!options.isCurrent||options.isCurrent());if(!alive())return;
  const map=new B.Map(container);map.centerAndZoom(route.city,14);map.enableScrollWheelZoom?.(true);
  const points=await Promise.all(route.stops.map(async stop=>{if(stop.point)return new B.Point(stop.point.lng,stop.point.lat);try{const p=(await searchPlaces(ak,route.city,stop.address||stop.name))[0]?.point;return p?new B.Point(p.lng,p.lat):null;}catch{return null;}}));
  if(!alive())return;
  const valid=points.filter(Boolean);for(let i=0;i<points.length;i++){
    if(!points[i])continue;const marker=new B.Marker(points[i]);map.addOverlay(marker);
    const label=new B.Label(`${i===active?'● ':''}${i+1} · ${safeLabel(route.stops[i].name)}`,{offset:new B.Size(17,-9)});
    label.setStyle?.({color:i===active?'#fff':'#283f7a',backgroundColor:i===active?'#283f7a':'#fff',border:'1px solid #aebad4',borderRadius:'8px',padding:'6px 9px'});marker.setLabel?.(label);
    if(options.onSelect){marker.addEventListener?.('click',()=>{if(alive())options.onSelect(i);});label.addEventListener?.('click',()=>{if(alive())options.onSelect(i);});}
  }
  if(valid.length)map.setViewport(valid);if(points[active])map.panTo(points[active]);
  const state={map,B,points,legs:[]};options.onReady?.(state);
  onNote(points.some(p=>!p)?'部分地点未找到，请在创作页重新确认。':'地点已显示，正在查询实际步行路线…');
  const legs=await Promise.all(points.slice(0,-1).map((start,i)=>new Promise(resolve=>{
    const end=points[i+1];if(!start||!end||!alive())return resolve({index:i,ok:false});
    let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>finish({index:i,ok:false}),12000);
    const walk=new B.WalkingRoute(map,{onSearchComplete(result){
      if(done)return;try{
        if(walk.getStatus()!==0||!result)return finish({index:i,ok:false});
        const plan=result.getPlan(0),distance=plan.getDistance(false),duration=plan.getDuration(false),path=plan.getRoute(0).getPath();
        if(!Number.isFinite(distance)||!Number.isFinite(duration)||!path?.length)return finish({index:i,ok:false});
        if(alive())map.addOverlay(new B.Polyline(path,{strokeColor:i===active?'#283f7a':'#7d91b9',strokeWeight:i===active?6:4,strokeOpacity:.85}));
        finish({index:i,ok:true,distance,duration});
      }catch{finish({index:i,ok:false});}
    }});try{walk.search(start,end);}catch{finish({index:i,ok:false});}
  })));
  if(!alive())return;state.legs=legs;options.onLegs?.(legs);
  if(legs.length&&legs.every(l=>l.ok)){const distance=legs.reduce((n,l)=>n+l.distance,0),duration=legs.reduce((n,l)=>n+l.duration,0);onNote(`百度步行规划${route.stops.some(s=>!s.point)?'（地点自动匹配，请核对）':''} · ${(distance/1000).toFixed(1)} 公里 / 约 ${Math.ceil(duration/60)} 分钟（不含停留）`);}else onNote('步行路线未完整返回；已找到的地点仍可查看，缺失路段请重新查询。');
  return state;
}
export async function locate(ak){const B=await loadMap(ak);return new Promise((resolve,reject)=>{const geo=new B.Geolocation();let done=false;const timer=setTimeout(()=>{done=true;reject(new Error('定位超时，可继续远程阅读。'));},15000);geo.getCurrentPosition(result=>{if(done)return;done=true;clearTimeout(timer);if(geo.getStatus()!==0||!result?.point)return reject(new Error('未取得位置，请允许定位，或继续远程阅读。'));if(!Number.isFinite(result.accuracy)||result.accuracy>150)return reject(new Error('当前定位精度不足，无法判断到达；可以手动继续阅读。'));resolve(result);},{enableHighAccuracy:true,timeout:12000,maximumAge:0});});}
