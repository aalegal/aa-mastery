// AA Team tactical meeting — shared by the form (/tactical) and the board
// (/tactical/board). Reads and writes public.tactical, the same table the
// leadership panel uses. Needs /qc-engine.js loaded first for QC.tacticalWeekOf.

var AA_SUPABASE_URL='https://mrxhydaoxlxuampmgaoi.supabase.co';
var AA_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeGh5ZGFveGx4dWFtcG1nYW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTg2NDgsImV4cCI6MjA4OTMzNDY0OH0.STQzp2Berri61IHeoDFHnDUkg_9eSV-giVCrUhHHk64';

// The people who file a report. Kept in step with LEAD_TACTICAL_PEOPLE in the
// main app so the leadership panel and this board agree on who is missing.
var AA_PEOPLE=['Glory','Junior','Simon','Achumboro','Jeff'];

// Kept in step with TACTICAL_SECTIONS in the main app. key is the column.
var AA_SECTIONS=[
  {key:'rocks',     label:'ROCK Updates',                         short:'Rock Updates',
   hint:'List your company Rocks and then your individual Rocks.'},
  {key:'headlines', label:'Customer / Contractors Headlines',     short:'Customer / Contractors Headlines',
   hint:'Good or bad news from customers and contractors this week.'},
  {key:'issues',    label:'Issues: Identify / Discuss / Resolve', short:'Issues: Identify / Discuss / Resolve',
   hint:'List your issues. On average, about three to five issues on the list. Start with only the top three.'},
  {key:'actions',   label:'Action Items / Priorities',            short:'Action Items / Priorities', required:true,
   hint:'List your next 3 or more next steps and priorities for the week.'}
];

var AA_FORM_PATH='/tactical';
var AA_BOARD_PATH='/tactical/board';

function el(id){return document.getElementById(id);}

function esc(v){
  return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function isoOf(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function todayISO(){return isoOf(new Date());}

function parseISO(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||'')) return null;
  var p=iso.split('-');
  var d=new Date(+p[0],+p[1]-1,+p[2]);
  return isNaN(d)?null:d;
}

// The meeting a date belongs to. Same Mon-Sun rule as the leadership panel.
function aaWeekOf(iso){return parseISO(iso)?QC.tacticalWeekOf(iso):null;}

// The next Wednesday on or after today: the date people should file for.
function aaNextCall(){
  var d=new Date();
  d.setDate(d.getDate()+((3-d.getDay()+7)%7));
  return isoOf(d);
}

function aaAddDays(iso,n){
  var d=parseISO(iso);
  d.setDate(d.getDate()+n);
  return isoOf(d);
}

function aaPrettyDate(iso,withDay){
  var d=parseISO(iso);
  if(!d) return '';
  var opts={month:'long',day:'numeric',year:'numeric'};
  if(withDay) opts.weekday='long';
  return d.toLocaleDateString('en-US',opts);
}

function aaApi(path,opts){
  opts=opts||{};
  var headers={
    'apikey':AA_SUPABASE_ANON_KEY,
    'Authorization':'Bearer '+AA_SUPABASE_ANON_KEY,
    'Content-Type':'application/json'
  };
  for(var k in (opts.headers||{})) headers[k]=opts.headers[k];
  return fetch(AA_SUPABASE_URL+'/rest/v1/'+path,{method:opts.method||'GET',headers:headers,body:opts.body});
}

async function aaFetchWeek(weekOf){
  var res=await aaApi('tactical?week_of=eq.'+encodeURIComponent(weekOf)+'&select=*&order=id.desc');
  if(!res.ok) throw new Error('load '+res.status);
  return res.json();
}

async function aaFetchReport(person,weekOf){
  var res=await aaApi('tactical?person=eq.'+encodeURIComponent(person)+
                      '&week_of=eq.'+encodeURIComponent(weekOf)+'&select=*&limit=1');
  if(!res.ok) throw new Error('load '+res.status);
  var rows=await res.json();
  return rows[0]||null;
}

async function aaFetchWeeks(){
  var res=await aaApi('tactical?select=week_of&week_of=not.is.null&order=week_of.desc&limit=1000');
  if(!res.ok) throw new Error('load '+res.status);
  var seen={},out=[];
  (await res.json()).forEach(function(r){ if(!seen[r.week_of]){seen[r.week_of]=1;out.push(r.week_of);} });
  return out;
}

// One report per person per week. The (person, week_of) index is partial, so
// PostgREST cannot upsert on it: look the report up, then edit or add.
// Public edits always come back as an unconfirmed form report for leadership.
async function aaSaveReport(rec){
  rec.source='form'; rec.confirmed=false;
  var existing=await aaFetchReport(rec.person,rec.week_of);
  if(existing){
    return aaApi('tactical?id=eq.'+existing.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify(rec)});
  }
  var res=await aaApi('tactical',{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify(rec)});
  if(res.status===409){
    existing=await aaFetchReport(rec.person,rec.week_of);
    if(existing) return aaApi('tactical?id=eq.'+existing.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify(rec)});
  }
  return res;
}

function aaFormLink(){return location.origin+AA_FORM_PATH;}

// The AA mark: gold triangle on sapphire, as on the main site's login.
var AA_LOGO='<svg width="34" height="34" viewBox="0 0 100 100" fill="none" aria-hidden="true"><defs>'+
  '<linearGradient id="aa-tg" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">'+
  '<stop offset="0%" stop-color="#f5d060"/><stop offset="50%" stop-color="#d4a82a"/><stop offset="100%" stop-color="#7eb8f7"/></linearGradient></defs>'+
  '<path d="M50 14 L86 74 L14 74 Z" stroke="url(#aa-tg)" stroke-width="6" fill="none" stroke-linejoin="round"/>'+
  '<path d="M50 30 L72 68 L28 68 Z" fill="url(#aa-tg)" opacity="0.9"/></svg>';
