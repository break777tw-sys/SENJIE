// Bounded, deterministic natural-language search. No model, network or paid API.
// Only the documented supplier question is supported; other questions fail closed.
import {filterCards} from './model.js';
const normalizeSearchText=value=>String(value??'').normalize('NFKC').replace(/臺/g,'台').trim();
export function parsePeopleQuery(query){
 const compact=normalizeSearchText(query).replace(/\s+/g,'').replace(/[?？。！!]+$/,'').replace(/^(?:請問|請幫我找|幫我找|請找|想找)/,'');
 if(/^(?:台南市?)(?:誰|有誰|有哪些人)(?:能|可以|可)提供(?:場地|活動空間)$/.test(compact))return {mode:'natural',intent:'offer',city:'台南',resource:'場地'};
 if(/誰|哪位|哪些|有沒有人|幫我找|請找|想找|推薦/.test(compact))return {mode:'unsupported',message:'這個問句尚未支援；目前可問「台南誰能提供場地」。未忽略額外條件或混用關鍵字結果。'};
 return {mode:'keyword'};
}
function currentPeople_(cards){
 const byId=new Map(),conflicts=new Set();
 for(const card of cards){
  if(!card||typeof card.id!=='string'||!card.id)continue;
  const version=card.version==null?0:Number(card.version);
  if(!Number.isInteger(version)||version<0){conflicts.add(card.id);continue;}
  const old=byId.get(card.id);
  if(!old||version>old.version){byId.set(card.id,{card,version});conflicts.delete(card.id);}
  else if(version===old.version&&JSON.stringify(card)!==JSON.stringify(old.card))conflicts.add(card.id);
 }
 return [...byId.values()].filter(({card})=>!conflicts.has(card.id)).map(({card})=>card);
}
function confirmedField_(card,key){
 if(card.status!=='已確認')return false;
 const fields=card.provenance?.fields;
 if(!fields)return true; // Legacy records: cite record status, do not invent field receipts.
 const field=fields[key];
 return field?.status==='使用者確認'&&typeof field.value==='string'&&field.value===card[key];
}
function supplyQuote_(offers){
 if(typeof offers!=='string')return null;
 if(/暫停|停止|停業|歇業|關閉|撤回/.test(offers))return null;
 const clauses=offers.split(/[，,；;。\n]|但是|不過|但/).map(s=>s.trim()).filter(s=>/場地|活動空間/.test(s));
 if(!clauses.length)return null;
 const negative=/(?:不再|無法|不能|不|未|暫停|停止)(?:對外|直接|繼續|免費|協助)?(?:提供|供應|出租|出借|開放)|(?:沒有|暫無|無)(?:自有|合適|可用|可提供的)?(?:場地|活動空間)/;
 const demandOrUncertain=/需要|需求|尋找|尋求|找尋|想找|求租|求借|徵求|欠缺|缺乏|媒合|轉介|如果|若有|可能|也許|預計|計畫|規劃|推測|尚待|待確認|確認中|[?？]/;
 // Conflicting/negative resource clauses are not silently overridden by positives.
 if(clauses.some(s=>negative.test(s)||demandOrUncertain.test(s)))return null;
 return clauses.join('；');
}
function fieldEvidence_(card,key,label){
 const receipt=card.provenance?.fields?.[key];
 return {field:key,label,quote:card[key],recordId:card.id,version:card.version??null,confirmation:receipt?'逐欄使用者確認':'人物紀錄已確認；無逐欄回條',method:receipt?.method||card.source||'未提供來源說明',sourceIds:Array.isArray(receipt?.sourceIds)?[...receipt.sourceIds]:[]};
}
export function searchPeople(cards,query='',category='',status=''){
 const parsed=parsePeopleQuery(query);
 if(parsed.mode==='keyword')return {mode:'keyword',matches:filterCards(cards,query,category,status).map(card=>({card,evidence:null})),message:'關鍵字模式：會搜尋供給、需求與談話。可試問「台南誰能提供場地」。'};
 if(parsed.mode==='unsupported')return {mode:'unsupported',matches:[],message:parsed.message};
 const matches=[];
 for(const card of currentPeople_(cards)){
  if(category&&card.category!==category||status&&card.status!==status)continue;
  if(!/^台南市?$/.test(normalizeSearchText(card.city))||!confirmedField_(card,'city')||!confirmedField_(card,'offers'))continue;
  const quote=supplyQuote_(card.offers);if(!quote)continue;
  matches.push({card,evidence:{recordId:card.id,version:card.version??null,updatedAt:card.updatedAt||null,source:card.source||'未提供來源說明',resourceQuote:quote,fields:[fieldEvidence_(card,'city','地區'),fieldEvidence_(card,'offers','能提供什麼')]}});
 }
 return {mode:'natural',intent:parsed,matches,message:'解讀：台南／場地供給。只以已確認的地區與「能提供什麼」欄位列出；需求、職稱與談話不作供給依據。這是紀錄條件比對，未查場地地址、檔期或報價。'};
}
