/* Safe · storage
   Everything is kept on this device in IndexedDB (one record holding the whole app state).
   Nothing is ever sent to a server. */
(function(){
  const DB="safe",STORE="kv",KEY="state";
  let dbp=null;
  function open(){
    if(dbp)return dbp;
    dbp=new Promise((res,rej)=>{
      const rq=indexedDB.open(DB,1);
      rq.onupgradeneeded=()=>rq.result.createObjectStore(STORE);
      rq.onsuccess=()=>res(rq.result);
      rq.onerror=()=>rej(rq.error);
    });
    return dbp;
  }
  async function load(){
    try{
      const db=await open();
      return await new Promise((res,rej)=>{const t=db.transaction(STORE,"readonly").objectStore(STORE).get(KEY);t.onsuccess=()=>res(t.result||null);t.onerror=()=>rej(t.error);});
    }catch(e){
      try{const s=localStorage.getItem("safe-state");return s?JSON.parse(s):null;}catch(_){return null;}
    }
  }
  async function save(obj){
    const copy=JSON.parse(JSON.stringify(obj));
    try{
      const db=await open();
      await new Promise((res,rej)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(copy,KEY);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});
    }catch(e){
      try{localStorage.setItem("safe-state",JSON.stringify(copy));}catch(_){}
    }
  }
  async function persist(){
    try{if(navigator.storage&&navigator.storage.persist)return await navigator.storage.persist();}catch(e){}
    return false;
  }
  window.SafeStore={load,save,persist};
})();
