import json, sys
from playwright.sync_api import sync_playwright
FILE = sys.argv[1] if len(sys.argv)>1 else "economat-pro/index.html"
words = json.load(open('/tmp/fake_words.json'))
CDN_TESS = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.0/tesseract.min.js'

init = """
window.__FAKE_WORDS = %s;
window.__MODE = 'crop';
window.Tesseract = { createWorker: function(){ return Promise.resolve({
  setParameters: function(){ return Promise.resolve(); },
  recognize: function(){ var w=window.__FAKE_WORDS[window.__MODE];
    return Promise.resolve({data:{text:w.map(function(x){return x.text;}).join(' '), words:w, lines:[]}}); },
  terminate: function(){ return Promise.resolve(); } }); } };
document.addEventListener('DOMContentLoaded', function(){
  var s=document.createElement('script'); s.setAttribute('data-src', '%s'); document.head.appendChild(s);
});
""" % (json.dumps(words, ensure_ascii=False), CDN_TESS)

def run(page, mode):
    page.evaluate("m => window.__MODE=m", mode)
    page.evaluate("goPage('rec-import')")
    page.set_input_files('#ri-f-img', '/root/.claude/uploads/68738804-a68f-5f46-9b52-b8b51de84108/1ba32947-image.png')
    page.wait_for_function("document.getElementById('ri-result').style.display==='block' || (document.getElementById('ri-fail') && document.getElementById('ri-fail').style.display==='block')", timeout=20000)
    page.wait_for_timeout(300)
    out = page.evaluate("""() => ({
      name: document.getElementById('ri-name').value,
      lines: Array.from(document.querySelectorAll('#ri-lines .ri-row')).map(r => {
        var inp = r.querySelectorAll('.ri-grid input');
        return (inp[0]?inp[0].value:'?')+' | '+(inp[1]?inp[1].value:'')+' '+((r.querySelector('.ri-grid select')||{}).value||'');
      }),
      headers: Array.from(document.querySelectorAll('#ri-lines > div:not(.ri-row)')).map(d=>d.textContent),
      subs: document.getElementById('ri-subs').innerText.replace(/\\s+/g,' ').slice(0,300),
      proc: Array.from(document.querySelectorAll('#ri-process .ri-badge.b-new')).map(b=>b.textContent),
      log: document.getElementById('ri-log').innerText
    })""")
    return out

with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page()
    errs=[]; page.on("pageerror", lambda e: errs.append(str(e))); page.on("dialog", lambda d: d.accept())
    page.add_init_script(init)
    page.goto("file:///mnt/user-data/outputs/"+FILE); page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})"); page.reload(); page.wait_for_timeout(500)
    for mode in (sys.argv[2].split(',') if len(sys.argv)>2 else ['crop','full']):
        o = run(page, mode)
        print("=== MODE", mode, "=== name:", repr(o['name']))
        print("section headers:", o['headers'])
        for l in o['lines']: print("  ", l)
        print("subs card:", o['subs'])
        print("process tagged sub:", len(o['proc']), set(o['proc']))
        page.wait_for_timeout(600); pr = page.evaluate("() => { var d=JSON.parse(LS.getItem('v4_ridraft')||'{}'); d=d.single||d; return (d.process||[]).map(p=>(p.section?'['+p.section+'] ':'')+p.text); }")
        for x in pr: print('     proc:', x)
        if mode=='full' and False:
            page.evaluate("document.getElementById('ri-save').click()"); page.wait_for_timeout(300)
            r = page.evaluate("""() => recipes.slice(0,3).map(r=>({name:r.name, n:r.items.length,
                items:r.items.map(i=>i.type==='recipe'?('⊛'+(recipes.find(x=>x.id===i.refId)||{}).name+' x'+i.qty):((ingredients.find(x=>x.id===i.refId)||{}).name+' '+i.qty+i.unit)),
                notes:r.notes.slice(0,160)}))""")
            print(json.dumps(r, ensure_ascii=False, indent=1))
        else:
            print('CUR after import:', page.evaluate('CUR'), '| name:', page.evaluate("document.getElementById('r-name').value"), '| rows:', page.evaluate("document.querySelectorAll('#r-items .ir').length")); page.evaluate("RIMP.abandon()")
    print("errors:", errs)
    b.close()
