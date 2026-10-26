import sys
from playwright.sync_api import sync_playwright
FILE=sys.argv[1]; XS=sys.argv[2:]
def dump(page):
    return page.evaluate("""() => ({name:document.getElementById('ri-name').value, cat:document.getElementById('ri-cat').value,
      lines:Array.from(document.querySelectorAll('#ri-lines .ri-row')).map(r=>{var i=r.querySelectorAll('.ri-grid input');var s=r.querySelector('.ri-grid select');return (i[0]?i[0].value:'')+' | '+(i[1]?i[1].value:'')+' '+(s?s.value:'')+(r.innerText.indexOf('déduit')>=0?' [unité déduite]':'');}),
      heads:Array.from(document.querySelectorAll('#ri-lines > div:not(.ri-row)')).map(d=>d.textContent),
      subs:document.getElementById('ri-subs').innerText.replace(/\\s+/g,' ').slice(0,110),
      proc:Array.from(document.querySelectorAll('#ri-process div[style*="flex:1"]')).map(d=>d.textContent),
      nav:(document.getElementById('ri-queuenav')||{innerText:''}).innerText.replace(/\\n/g,' | ')})""")
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(); errs=[]
    page.on('pageerror',lambda e: errs.append(str(e))); page.on('dialog',lambda d:d.accept())
    page.goto('file:///mnt/user-data/outputs/'+FILE); page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})"); page.reload(); page.wait_for_timeout(500)
    for x in XS:
        page.evaluate("goPage('rec-import')")
        page.set_input_files('#ri-f-xls', x)
        page.wait_for_function("document.getElementById('ri-result').style.display==='block' || document.getElementById('ri-fail').style.display==='block'", timeout=20000)
        page.wait_for_timeout(900)
        print('#####', x); print('LOG:', page.evaluate("document.getElementById('ri-log').innerText").replace('\n',' / '))
        fail=page.evaluate("document.getElementById('ri-fail').innerText")
        if fail.strip(): print('FAIL:', fail[:300]); continue
        o=dump(page); nq=page.evaluate("document.querySelectorAll('#ri-queuenav .ri-badge').length")
        for k in range(max(1,nq)):
            if nq: page.evaluate("RIMP.queueGo(%d)"%k); page.wait_for_timeout(150); o=dump(page)
            print('  RECETTE:', o['name'], '| cat:', o['cat'], '| sections:', o['heads'])
            for l in o['lines']: print('     ', l)
            if o['subs']: print('     SUBS:', o['subs'])
            if o['proc']: print('     PROC:', o['proc'][:6])
        page.evaluate("document.getElementById('ri-cancel').click()"); page.wait_for_timeout(200)
    print('errors:',errs); b.close()
