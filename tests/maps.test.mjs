import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeMap} from '../public/maps.js';
// Controlled SDK responses verify our sequencing and failure behavior, not live Baidu services.
function mock({failLeg=-1,delayed=false}={}){
 const markers=[],pending=[],lines=[];let calls=0;
 class Point{constructor(lng,lat){Object.assign(this,{lng,lat});}}
 class Label{constructor(text){this.text=text;}setStyle(style){this.style=style;}addEventListener(name,fn){this[name]=fn;}}
 class Marker{constructor(point){this.point=point;markers.push(this);}setLabel(label){this.label=label;}addEventListener(name,fn){this[name]=fn;}}
 class Map{centerAndZoom(){}enableScrollWheelZoom(){}addOverlay(item){if(item.path)lines.push(item);}setViewport(){}panTo(){} }
 class WalkingRoute{constructor(map,opts){this.opts=opts;this.index=calls++;}getStatus(){return this.index===failLeg?1:0;}search(){const complete=()=>this.opts.onSearchComplete({getPlan:()=>({getDistance:()=>1000,getDuration:()=>600,getRoute:()=>({getPath:()=>[new Point(1,1),new Point(2,2)]})})});if(delayed)pending.push(complete);else queueMicrotask(complete);}}
 globalThis.window={BMap:{Point,Label,Marker,Map,Size:class{},Polyline:class{constructor(path){this.path=path;}},WalkingRoute}};
 return {markers,pending,lines};
}
const route={city:'测试',stops:[0,1,2].map(i=>({name:'站点'+i,point:{lng:120+i/100,lat:30}}))};
test('Points become usable before all walking legs complete; active marker opens the correct story',async()=>{
 const sdk=mock({delayed:true});let ready,selected;const promise=routeMap({isConnected:true},route,'mock',()=>{},1,{onReady:s=>ready=s,onSelect:i=>selected=i});
 await new Promise(r=>setImmediate(r));assert.equal(ready.points.length,3);assert.equal(sdk.pending.length,2);assert.equal(ready.legs.length,0);
 assert.equal(sdk.markers[1].label.style.backgroundColor,'#283f7a');sdk.markers[1].click();assert.equal(selected,1);
 sdk.pending.forEach(fn=>fn());const result=await promise;assert.equal(result.legs.length,2);assert.equal(sdk.lines.length,2);
});
test('Partial failure preserves successful segments and never reports a complete route',async()=>{
 mock({failLeg:1});let note='',legs;await routeMap({isConnected:true},route,'mock',t=>note=t,0,{onLegs:x=>legs=x});
 assert.deepEqual(legs.map(l=>l.ok),[true,false]);assert.match(note,/未完整返回/);
});
test('Cancelled view cannot draw late routes or publish late completion',async()=>{
 const sdk=mock({delayed:true});let current=true,completed=false;const promise=routeMap({isConnected:true},route,'mock',()=>{},0,{isCurrent:()=>current,onLegs:()=>completed=true});
 await new Promise(r=>setImmediate(r));current=false;sdk.pending.forEach(fn=>fn());assert.equal(await promise,undefined);assert.equal(sdk.lines.length,0);assert.equal(completed,false);
});
