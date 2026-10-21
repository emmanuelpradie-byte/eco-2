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

    # --- Test item 3: unitGuessedKg flag ---
    r = page.evaluate("""
    () => {
      var ing = extractIngredient('Farine de sarrasin 0,390 kg\\u2063');
      var ing2 = extractIngredient('Sel 12 g');
      return {guessed: ing, normal: ing2};
    }
    """)
    print("item3 extractIngredient:", r)

    r2 = page.evaluate("""
    () => {
      var lines = normalizeUnitlessQty(['Farine de sarrasin 0,390']);
      return lines;
    }
    """)
    print("item3 normalizeUnitlessQty:", r2)
    print("contains marker:", '⁣' in r2[0])

    # mkLine + renderLines badge check
    r3 = page.evaluate("""
    () => {
      var l = mkLine({detectedName:'Farine de sarrasin', quantity:0.39, unit:'kg', unitDetected:true, unitGuessedKg:true, confidence:80});
      return {unitGuessedKg: l.unitGuessedKg};
    }
    """)
    print("item3 mkLine propagation:", r3)

    # --- Test item 4: learned corrections modal ---
    r4 = page.evaluate("""
    () => {
      learnCorrection('Framboize','Framboise');
      RIMP.openFixes();
      var visible = document.getElementById('m-fixes').classList.contains('show');
      var html = document.getElementById('fixes-list').innerHTML;
      return {visible: visible, html: html};
    }
    """)
    print("item4 openFixes:", r4['visible'], 'Framboise' in r4['html'])

    r5 = page.evaluate("""
    () => {
      RIMP.delFix(cslug('Framboize'));
      var f = loadFixes();
      return Object.keys(f).length;
    }
    """)
    print("item4 delFix -> remaining fixes:", r5)

    # --- Test item 5: draft persistence + resume ---
    r6 = page.evaluate("""
    () => {
      draft = buildDraft({recipeName:'Brioche test', main:[{detectedName:'Farine',quantity:1,unit:'kg',unitDetected:true,confidence:90}], subRecipes:[], process:[]}, {src:{},thumb:null,fileName:'test.pdf'}, []);
      persistDraft();
      var saved = LS.getItem('v4_ridraft');
      return !!saved;
    }
    """)
    print("item5 persistDraft saved:", r6)

    # simulate reload -> draft should be gone from memory but recoverable via resume banner
    page.evaluate("draft=null;")
    page.evaluate("goPage('rec-import');")
    page.wait_for_timeout(100)
    banner = page.evaluate("document.getElementById('ri-resume').innerHTML")
    print("item5 resume banner shown:", 'Reprendre' in banner, 'Brioche test' in banner)

    page.evaluate("RIMP.resumeDraft();")
    page.wait_for_timeout(100)
    r7 = page.evaluate("""
    () => ({ name: draft && draft.name, cur: CUR, resultVisible: document.getElementById('ri-result').style.display })
    """)
    print("item5 resumeDraft:", r7)

    # discard
    page.evaluate("RIMP.discardDraft();")
    r8 = page.evaluate("LS.getItem('v4_ridraft')")
    print("item5 discardDraft cleared:", r8)

    print("errors:", errors)
    browser.close()
