// api.js
window.FORM_ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbyKVcB_G-om0cT_OhqG7B3VxMnudGKM2iPV4g9wGfcm8DxoDfmqH-bRAe6YyuEhwN4eYw/exec";

async function postForm(obj){
  try{
    const body = new URLSearchParams({ payload: JSON.stringify(obj) });
    const r = await fetch(window.FORM_ENDPOINT_URL, {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body
    });
    const txt = await r.text().catch(()=> '');
    if (window.setDebug) window.setDebug(txt || '(no text)');
    try { return JSON.parse(txt); }
    catch(_){ return r.ok ? {ok:true, opaque:true} : {ok:false, error:'HTTP '+r.status}; }
  }catch(e){
    if (window.setDebug) window.setDebug(String(e));
    return {ok:false, error:String(e)};
  }
}
