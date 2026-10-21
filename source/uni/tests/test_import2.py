from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("file:///mnt/user-data/outputs/economat-pro/index.html")
    page.wait_for_timeout(300)
    page.evaluate("()=>new Promise(r=>{localStorage.clear(); var q=indexedDB.deleteDatabase('economat-pro'); q.onsuccess=q.onerror=q.onblocked=()=>r();})")
    page.reload()
    page.wait_for_timeout(400)

    # --- item 4: learned corrections modal, via RIMP + localStorage directly ---
    r4 = page.evaluate("""
    () => {
      var fixes = {'framboize': {to:'Framboise', n:3, ts:Date.now()}};
      localStorage.setItem('v4_ocrfix', JSON.stringify(fixes));
      RIMP.openFixes();
      var visible = document.getElementById('m-fixes').classList.contains('show');
      var html = document.getElementById('fixes-list').innerHTML;
      return {visible, html};
    }
    """)
    print("item4 openFixes visible:", r4['visible'], "shows Framboise:", 'Framboise' in r4['html'])

    r5 = page.evaluate("""
    () => {
      RIMP.delFix('framboize');
      var f = JSON.parse(LS.getItem('v4_ocrfix')||'{}');
      return Object.keys(f).length;
    }
    """)
    print("item4 delFix -> remaining:", r5)

    # --- item 5: fabricate a draft directly in localStorage (as persistDraft would), then resume ---
    fake_draft = {
        "name": "Brioche test", "cat": "Boulangerie", "emoji": "📖",
        "lines": [{"id":"l1","sel":True,"name":"Farine","originalName":"Farine","corrected":False,
                   "fixSource":"","qty":1,"unit":"kg","unitDetected":True,"unitInferred":False,
                   "unitGuessedKg":True,"confidence":80,"matchId":"","matchScore":0,"candidates":[],
                   "subName":"","useRecipeId":"","newCat":"Autre","newPrice":0,"newUnit":"kg",
                   "newUnitWeight":0,"newSupplier":""}],
        "subs": [], "process": [], "blocks": [],
        "src": {"thumb": None, "fileName": "test.pdf", "ts": 0}, "raw": ""
    }
    import json
    page.evaluate("(d) => (LS.setItem('v4_ridraft', JSON.stringify(d)), LS.flush())", fake_draft)
    page.evaluate("goPage('rec-import');")
    page.wait_for_timeout(150)
    banner = page.evaluate("document.getElementById('ri-resume').innerHTML")
    print("item5 resume banner text ok:", 'Reprendre' in banner and 'Brioche test' in banner)

    page.evaluate("RIMP.resumeDraft();")
    page.wait_for_timeout(150)
    r7 = page.evaluate("""
    () => ({
      curPage: CUR,
      nameField: document.getElementById('ri-name').value,
      resultVisible: document.getElementById('ri-result').style.display,
      linesHtml: document.getElementById('ri-lines').innerHTML
    })
    """)
    print("item5 resumeDraft -> page:", r7['curPage'], "name:", r7['nameField'], "resultVisible:", r7['resultVisible'])
    print("item5 unitGuessedKg warning rendered:", 'kg déduit' in r7['linesHtml'])

    page.evaluate("RIMP.discardDraft();")
    r8 = page.evaluate("LS.getItem('v4_ridraft')")
    print("item5 discardDraft cleared storage:", r8)

    print("errors:", errors)
    browser.close()
