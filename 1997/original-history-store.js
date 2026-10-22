import {createOriginalHistory,originalHistoryOpen,addOriginalHistorySample} from './original-records.js';
import {localRecordDate} from './original-record-store.js';
const KEY='retro-native-speed-history-v1';
const persist=(state,storage)=>{try{storage.setItem(KEY,JSON.stringify(state));}catch{}return state;};
export function loadOriginalSpeedHistory(storage,today=localRecordDate()){
 let state;try{const raw=JSON.parse(storage.getItem(KEY)||'null');if(raw&&Array.isArray(raw.slots)&&raw.slots.length===360&&Number.isInteger(raw.index)&&raw.index>=0&&raw.index<360)state=raw;}catch{}
 state??=createOriginalHistory();originalHistoryOpen(state,today);return persist(state,storage);
}
export function appendOriginalSpeedHistory(state,sample,storage){
 addOriginalHistorySample(state,{...sample,date:sample.date||localRecordDate()});return persist(state,storage);
}
