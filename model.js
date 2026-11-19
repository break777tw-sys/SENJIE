export const demoCards=[
 {id:'DEMO0001',name:'林沐禾',alias:'木木',company:'青禾文化工作室（虛構）',role:'企劃統籌',city:'台南',category:'文化表演',status:'已確認',offers:'文化體驗',needs:'場地合作',notes:'範例：在交流活動認識，討論文化體驗課程。',next:'整理合作主題，安排交流',date:'',source:'虛構示範資料',tone:0},
 {id:'DEMO0002',name:'陳映山',alias:'Alex',company:'山映學習設計（虛構）',role:'課程設計師',city:'高雄',category:'教育培訓',status:'待確認',offers:'團隊課程',needs:'戶外活動資源',notes:'範例：職稱與服務內容尚待本人確認。',next:'核對課程合作需求',date:'',source:'虛構示範資料',tone:1},
 {id:'DEMO0003',name:'周晴川',alias:'晴晴',company:'晴川空間（虛構）',role:'場地窗口',city:'嘉義',category:'場地資源',status:'已確認',offers:'活動空間',needs:'',notes:'範例：可作為活動空間的調查線索。',next:'',date:'',source:'虛構示範資料',tone:2}
];
const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
export function filterCards(cards,query='',category='',status=''){
 const tokens=normalize(query).split(/\s+/).filter(Boolean);
 return cards.filter(card=>(!category||card.category===category)&&(!status||card.status===status)&&tokens.every(token=>normalize(Object.values(card).join(' ')).includes(token)));
}
export function findDuplicates(cards,candidate){return cards.filter(c=>c.id!==candidate.id&&normalize(c.name)===normalize(candidate.name)&&normalize(c.company)===normalize(candidate.company));}
