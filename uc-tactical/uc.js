// Uplift Communities tactical meeting — shared by the form and the board.
// Nothing here is shared with the rest of AA Mastery.

var UC_SUPABASE_URL='https://mrxhydaoxlxuampmgaoi.supabase.co';
var UC_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yeGh5ZGFveGx4dWFtcG1nYW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTg2NDgsImV4cCI6MjA4OTMzNDY0OH0.STQzp2Berri61IHeoDFHnDUkg_9eSV-giVCrUhHHk64';

// The people who file a report. Add a name here and it appears on both the
// form dropdown and the board.
var UC_PEOPLE=['Rachel','Jeeramel','Achumboro'];

// The four parts of the report, in the order the board walks through them.
// key is the uc_tactical column.
var UC_SECTIONS=[
  {key:'rocks',     label:'ROCK Updates',                      short:'Rock Updates',
   hint:'List your company Rocks and then your individual Rocks.'},
  {key:'headlines', label:'Customer / Contractors Headlines',  short:'Customer / Contractors Headlines',
   hint:'Good or bad news from customers and contractors this week.'},
  {key:'issues',    label:'Issues: Identify / Discuss / Resolve', short:'Issues: Identify / Discuss / Resolve',
   hint:'List your issues. On average, about three to five issues on the list. Start with only the top three.'},
  {key:'actions',   label:'Action Items / Priorities',          short:'Action Items / Priorities', required:true,
   hint:'List your next 3 or more next steps and priorities for the week.'}
];

var UC_FORM_PATH='/uc-tactical/form';
var UC_BOARD_PATH='/uc-tactical';

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

// Tactical calls are on Wednesdays. Any date belongs to the call on or after it.
function ucWednesdayOf(iso){
  var d=parseISO(iso);
  if(!d) return null;
  d.setDate(d.getDate()+((3-d.getDay()+7)%7));
  return isoOf(d);
}

function ucAddDays(iso,n){
  var d=parseISO(iso);
  d.setDate(d.getDate()+n);
  return isoOf(d);
}

function ucPrettyDate(iso,withDay){
  var d=parseISO(iso);
  if(!d) return '';
  var opts={month:'long',day:'numeric',year:'numeric'};
  if(withDay) opts.weekday='long';
  return d.toLocaleDateString('en-US',opts);
}

function ucApi(path,opts){
  opts=opts||{};
  var headers={
    'apikey':UC_SUPABASE_ANON_KEY,
    'Authorization':'Bearer '+UC_SUPABASE_ANON_KEY,
    'Content-Type':'application/json'
  };
  for(var k in (opts.headers||{})) headers[k]=opts.headers[k];
  return fetch(UC_SUPABASE_URL+'/rest/v1/'+path,{method:opts.method||'GET',headers:headers,body:opts.body});
}

async function ucFetchWeek(weekOf){
  var res=await ucApi('uc_tactical?week_of=eq.'+encodeURIComponent(weekOf)+'&select=*');
  if(!res.ok) throw new Error('load '+res.status);
  return res.json();
}

async function ucFetchReport(person,weekOf){
  var res=await ucApi('uc_tactical?person=eq.'+encodeURIComponent(person)+
                      '&week_of=eq.'+encodeURIComponent(weekOf)+'&select=*');
  if(!res.ok) throw new Error('load '+res.status);
  var rows=await res.json();
  return rows[0]||null;
}

async function ucFetchWeeks(){
  var res=await ucApi('uc_tactical?select=week_of&order=week_of.desc&limit=500');
  if(!res.ok) throw new Error('load '+res.status);
  var seen={},out=[];
  (await res.json()).forEach(function(r){ if(!seen[r.week_of]){seen[r.week_of]=1;out.push(r.week_of);} });
  return out;
}

// Same person + same Wednesday replaces the earlier report.
async function ucSaveReport(rec){
  return ucApi('uc_tactical?on_conflict=person,week_of',{
    method:'POST',
    headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify(rec)
  });
}

function ucFormLink(){return location.origin+UC_FORM_PATH;}
