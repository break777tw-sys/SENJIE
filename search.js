// Bounded, deterministic natural-language search. No model, network or paid API.
// Only the documented supplier questions are supported; other questions fail closed.
import {filterCards} from './model.js';
const normalizeSearchText=value=>String(value??'').normalize('NFKC').replace(/臺/g,'台').trim();
export function parsePeopleQuery(query){
 const compact=normalizeSearchText(query).replace(/\s+/g,'').replace(/[?？。！!]+$/,'').replace(/^(?:請問|請幫我找|幫我找|請找|想找)/,'');
 if(/^(?:台南市?)(?:誰|有誰|有哪些人)(?:能|可以|可)提供(?:場地|活動空間)$/.test(compact))return {mode:'natural',intent:'offer',city:'台南',resource:'場地'};
 if(/^上次在交流會認識[，,、]?(?:能|可以|可)提供台南市?的?(?:場地|活動空間)的人有哪些$/.test(compact))return {mode:'natural',intent:'offer',city:'台南',resource:'場地',meeting:'latest-exchange'};
 if(/誰|哪位|哪些|有沒有人|幫我找|請找|想找|推薦/.test(normalizeSearchText(query)))return {mode:'unsupported',message:'這個問句尚未支援；可問「台南誰能提供場地」或「上次在交流會認識、能提供台南的場地的人有哪些？」。未忽略額外條件或混用關鍵字結果。'};
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
 if(!fields)return typeof card[key]==='string'&&!!card[key].trim(); // Legacy record status, no invented field receipts.
 const field=fields[key];
 return field?.status==='使用者確認'&&typeof field.value==='string'&&field.value===card[key];
}
function supplyQuote_(offers){
 if(typeof offers!=='string')return null;
 const text=normalizeSearchText(offers).replace(/\s+/g,'');
 if(/暫停|停止|停業|歇業|關閉|撤回|(?:僅|只)(?:供|限|提供給|提供予).*?(?:內部|內用|員工|會員)|內部(?:使用|專用)|不對外|不外借|不外租/.test(text))return null;
 const clauses=text.split(/[，,；;。\n]|但是|不過|但/).filter(s=>/場地|活動空間/.test(s));
 if(!clauses.length)return null;
 const negative=/(?:沒有辦法|沒辦法|沒有能力|無能力|無法|不能|不再|不|未)(?:對外|直接|繼續|免費|協助)?(?:提供|供應|出租|出借|開放)|(?:沒有|暫無|無)(?:自有|合適|可用|可提供的)?(?:場地|活動空間)/;
 const demandOrUncertain=/需要|需求|尋找|尋求|找尋|想找|求租|求借|徵求|欠缺|缺乏|媒合|轉介|如果|若有|可能|也許|預計|計畫|規劃|推測|尚待|待確認|確認中|不確定|[?？]/;
 // Conflicting/negative resource clauses are not silently overridden by positives.
 if(clauses.some(s=>negative.test(s)||demandOrUncertain.test(s)))return null;
 // Venue location must occur in the supply clause itself; a person's city is not evidence.
 // Mixed cities in one clause are ambiguous in this bounded parser and fail closed.
 const otherCity=/台北|新北|桃園|新竹|苗栗|台中|彰化|南投|雲林|嘉義|高雄|屏東|宜蘭|花蓮|台東|基隆|澎湖|金門|連江/;
 const supplied=clauses.filter(s=>/台南/.test(s)&&!otherCity.test(s)&&/(?:提供|供應|出租|出借|開放)/.test(s));
 return supplied.length?supplied.join('；'):null;
}
function latestMeeting_(cards){
 const records=[];let unknown=false;
 for(const card of cards){
  if(!confirmedField_(card,'notes')||typeof card.notes!=='string')continue;
  for(const clause of card.notes.split(/[。；;\n]/).map(s=>s.trim()).filter(Boolean)){
   if(!/交流會/.test(clause)||!/認識|初識/.test(clause))continue;
   const match=clause.match(/^(\d{4}-\d{2}-\d{2})\s*在([^，,。；;\n]{0,40}交流會)(?:上)?(?:認識|初識)[。！!]?$/);
   if(!match){unknown=true;continue;}
   const [,date,event]=match,parsed=new Date(date+'T00:00:00Z');
   if(!Number.isFinite(parsed.valueOf())||parsed.toISOString().slice(0,10)!==date){unknown=true;continue;}
   records.push({cardId:card.id,date,event,quote:clause});
  }
 }
 if(unknown)return {error:'無法判定「上次」：已確認的交流會認識紀錄有缺日期或格式不明；請先核對認識日期與場合。'};
 if(!records.length)return {error:'無法判定「上次」：沒有可核對日期與場合的已確認交流會認識紀錄。'};
 const date=records.reduce((latest,r)=>r.date>latest?r.date:latest,''),latest=records.filter(r=>r.date===date);
 if(new Set(latest.map(r=>r.event)).size!==1)return {error:'無法判定「上次」：最近日期有不同交流會，請先確認是哪一場。'};
 return {date,event:latest[0].event,records:latest};
}
function fieldEvidence_(card,key,label){
 const receipt=card.provenance?.fields?.[key];
 return {field:key,label,quote:card[key],recordId:card.id,version:card.version??null,confirmation:receipt?'逐欄使用者確認':'人物紀錄已確認；無逐欄回條',method:receipt?.method||card.source||'未提供來源說明',sourceIds:Array.isArray(receipt?.sourceIds)?[...receipt.sourceIds]:[]};
}
export function searchPeople(cards,query='',category='',status=''){
 const parsed=parsePeopleQuery(query);
 if(parsed.mode==='keyword')return {mode:'keyword',matches:filterCards(cards,query,category,status).map(card=>({card,evidence:null})),message:'關鍵字模式：會搜尋供給、需求與談話。可試問「台南誰能提供場地」。'};
 if(parsed.mode==='unsupported')return {mode:'unsupported',matches:[],message:parsed.message};
 const current=currentPeople_(cards),meeting=parsed.meeting?latestMeeting_(current):null;
 if(meeting?.error)return {mode:'natural',intent:parsed,matches:[],message:meeting.error};
 const matches=[];
 for(const card of current){
  if(category&&card.category!==category||status&&card.status!==status)continue;
  if(!confirmedField_(card,'offers'))continue;
  const quote=supplyQuote_(card.offers);if(!quote)continue;
  const met=meeting?.records.find(r=>r.cardId===card.id);if(meeting&&!met)continue;
  const fields=[...(confirmedField_(card,'city')?[fieldEvidence_(card,'city','人物地區（非場地依據）')]:[]),fieldEvidence_(card,'offers','場地供給與所在地')];
  if(met)fields.push(fieldEvidence_(card,'notes','認識日期與場合'));
  matches.push({card,evidence:{recordId:card.id,version:card.version??null,updatedAt:card.updatedAt||null,source:card.source||'未提供來源說明',resourceQuote:quote,...(met?{meeting:met}:{}),fields}});
 }
 const context=meeting?'「上次」依目前已載入且已確認的認識紀錄，指 '+meeting.date+'「'+meeting.event+'」；未核對其他未載入場次。':'';
 return {mode:'natural',intent:parsed,matches,message:context+'解讀：台南場地供給。僅用已確認供給欄位中的台南場地原文；人物地區不代替場地所在地，需求、職稱與談話不作供給依據。這是紀錄條件比對，未查實際地址、檔期或報價。'};
}
