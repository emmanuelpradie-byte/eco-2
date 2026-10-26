import sys, json
from playwright.sync_api import sync_playwright
FILE=sys.argv[1]; PDF=sys.argv[2]; SHOW=int(sys.argv[3]) if len(sys.argv)>3 else 99
D='/home/claude/.npm-global/lib/node_modules/pdfjs-dist/build/'
SHIM="""window.__pdfjsP = import('https://local.pdfjs/pdf.mjs');
window.pdfjsLib = { GlobalWorkerOptions:{}, getDocument:function(o){ return { promise: window.__pdfjsP.then(function(m){
  m.GlobalWorkerOptions.workerSrc='https://local.pdfjs/pdf.worker.mjs'; return m.getDocument(o).promise; }) }; } };"""
def route(r):
    u=r.request.url; hdr={'Access-Control-Allow-Origin':'*','Content-Type':'application/javascript'}
    if 'pdf.js/3.11.174/pdf.min.js' in u: return r.fulfill(body=SHIM, headers=hdr)
    if u.endswith('/pdf.mjs'): return r.fulfill(body=open(D+'pdf.mjs').read(), headers=hdr)
    if u.endswith('/pdf.worker.mjs'): return r.fulfill(body=open(D+'pdf.worker.mjs').read(), headers=hdr)
    return r.abort()
def dump(page):
    return page.evaluate("""() => ({name:document.getElementById('ri-name').value,
      lines:Array.from(document.querySelectorAll('#ri-lines .ri-row')).map(r=>{var i=r.querySelectorAll('.ri-grid input');var s=r.querySelector('.ri-grid select');return (i[0]?i[0].value:'')+' | '+(i[1]?i[1].value:'')+' '+(s?s.value:'');}),
      heads:Array.from(document.querySelectorAll('#ri-lines > div:not(.ri-row)')).map(d=>d.textContent),
      nproc:document.querySelectorAll('#ri-process div[style*="flex:1"]').length,
      proc:Array.from(document.querySelectorAll('#ri-process div[style*="flex:1"]')).map(d=>d.textContent).slice(0,3)})""")
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(); errs=[]
    page.on('pageerror',lambda e: errs.append(str(e))); page.on('dialog',lambda d:d.accept())
    page.route('https://cdnjs.cloudflare.com/**', route); page.route('https://local.pdfjs/**', route)
    page.goto('file:///mnt/user-data/outputs/'+FILE); page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})"); page.reload(); page.wait_for_timeout(500)
    page.evaluate("goPage('rec-import')"); page.set_input_files('#ri-f-pdf', PDF)
    page.wait_for_function("document.getElementById('ri-result').style.display==='block' || document.getElementById('ri-fail').style.display==='block'", timeout=120000)
    page.wait_for_timeout(1500)
    print('LOG:', page.evaluate("document.getElementById('ri-log').innerText").replace('\n',' / ')[-400:])
    nq=page.evaluate("document.querySelectorAll('#ri-queuenav .ri-badge').length")
    print('RECIPES:', nq)
    for k in range(min(max(1,nq),SHOW)):
        if nq: page.evaluate("RIMP.queueGo(%d)"%k); page.wait_for_timeout(120)
        o=dump(page)
        print('== %d. %s  sections=%s  proc=%d'%(k+1,o['name'],o['heads'],o['nproc']))
        for l in o['lines']: print('     ',l)
    print('errors:',errs); b.close()
