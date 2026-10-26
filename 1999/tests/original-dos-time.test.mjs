import test from'node:test';import assert from'node:assert/strict';import{originalDosTime,originalBrowserTimeSeed}from'../original-dos-time.js';
// Numeric outputs from unchanged original instructions in Unicorn2.1.4.
const vectors=[[[1980,1,1,0,0,0],315550800],[[1999,1,1,0,0,0],915166800],[[1999,4,4,1,59,59],923209199],[[1999,4,4,2,0,0],923205600],[[1999,10,31,1,59,59],941349599],[[1999,10,31,2,0,0],941353200],[[2026,3,8,12,0,0],1772989200],[[2026,4,5,1,59,59],1775372399],[[2026,4,5,2,0,0],1775368800],[[2026,10,25,1,59,59],1792907999],[[2026,10,25,2,0,0],1792911600],[[2026,10,26,8,0,0],1793019600],[[2028,2,29,12,34,56],1835458496]];
test('DOS calendar conversion matches original machine-code time outputs',()=>{for(const[[year,month,day,hour,minute,second],expected]of vectors)assert.equal(originalDosTime({year,month,day,hour,minute,second}),expected);});
test('browser seed consumes local calendar fields, ignores milliseconds and modern timezone rules',()=>{
 const clock={getFullYear:()=>2026,getMonth:()=>9,getDate:()=>26,getHours:()=>8,getMinutes:()=>0,getSeconds:()=>0};assert.equal(originalBrowserTimeSeed(clock),20176);
 const d=new Date(2026,9,26,8,0,0,0),later=new Date(2026,9,26,8,0,0,999);assert.equal(originalBrowserTimeSeed(d),originalBrowserTimeSeed(later));
});
test('invalid/unsupported calendar inputs fail explicitly',()=>{
 for(const fields of[{year:1979,month:1,day:1},{year:2100,month:1,day:1},{year:2026,month:2,day:29},{year:2026,month:4,day:31},{year:2026,month:1,day:1,hour:24},{year:NaN,month:1,day:1}])assert.throws(()=>originalDosTime(fields),RangeError);
});
