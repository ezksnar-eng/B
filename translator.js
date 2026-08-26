// translator.js - النسخة الشغالة والمحدثة بالكامل
(function () {
  // ========== 1. تحميل فايربيس تلقائياً بدون import ==========
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ========== 2. الإعدادات والروابط ==========
  const MANHUA_INDEX_URL = 'http://m.yueman1.cc/manhua/o/m_waplistindex.html';
  
  // بروكسيات حديثة ومحدثة لفك الحظر
  const CORS_PROXIES = [
    'https://cors-proxy.htmldriven.com/?url=',
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?'
  ];

  // ⚠️ ضع بيانات فايربيس الخاصة بمشروعك هنا ⚠️
  const firebaseConfig = {
    apiKey: "ضع_الـ_API_KEY_هنا",
    authDomain: "مشروعك.firebaseapp.com",
    projectId: "اسم_مشروعك",
    storageBucket: "مشروعك.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
  };

  let db = null;

  // تهيئة الفايربيس
  async function initFirebase() {
    try {
      await loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js");

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      console.log("🔥 تم الاتصال بـ Firebase بنجاح!");
    } catch (e) {
      console.error("❌ فشل تحميل فايربيس، يرجى التأكد من بيانات الكونفيج:", e);
    }
  }

  // دالة حفظ البيانات في Firestore
  async function saveToDatabase(collectionName, data) {
    if (!db) {
      console.warn("⚠️ الفايربيس غير متصل، لن يتم الحفظ.");
      return;
    }
    try {
      const docRef = await db.collection(collectionName).add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ تم الحفظ في Firestore بنجاح! ID: ${docRef.id}`);
    } catch (e) {
      console.error("❌ خطأ أثناء الحفظ في Firestore:", e);
    }
  }

  // جلب المحتوى عبر البروكسي
  async function fetchWithCors(url, proxyIndex = 0) {
    if (proxyIndex >= CORS_PROXIES.length) {
      console.error('❌ جميع البروكسيات فشلت في جلب الرابط:', url);
      return null;
    }

    const proxy = CORS_PROXIES[proxyIndex];
    const fullUrl = proxy + encodeURIComponent(url);

    try {
      console.log(`📡 محاولة جلب الداتا عبر: ${proxy}`);
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (!text || text.length < 50) throw new Error('استجابة فارغة');
      
      console.log('✅ تم جلب الصفحة بنجاح!');
      return text;
    } catch (error) {
      console.warn(`⚠️ فشل البروكسي ${proxy}، جاري التجربة على البروكسي التالي...`);
      return fetchWithCors(url, proxyIndex + 1);
    }
  }

  // استخراج الفصول
  function extractChapterLinks(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a'));
    const chapterLinks = [];

    links.forEach((link, idx) => {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      if (href && href.length > 2) {
        try {
          const fullUrl = new URL(href, 'http://m.yueman1.cc').href;
          chapterLinks.push({ url: fullUrl, title: text || `فصل ${idx + 1}` });
        } catch (e) {}
      }
    });

    return chapterLinks.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
  }

  // استخراج الصور
  function extractImageUrls(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));
    
    return images
      .map(img => img.getAttribute('src') || img.getAttribute('data-src'))
      .filter(src => src && !src.includes('logo') && !src.includes('icon'))
      .map(src => src.startsWith('//') ? 'http:' + src : (src.startsWith('http') ? src : 'http://m.yueman1.cc' + src));
  }

  // بناء واجهة المستخدم
  function createUI() {
    let container = document.getElementById('translator-manhua-container');
    if (container) container.remove();

    container = document.createElement('div');
    container.id = 'translator-manhua-container';
    container.style.cssText = `
      position: relative; z-index: 99999; background: #fff; padding: 15px;
      margin: 10px; border: 2px solid #333; border-radius: 8px; direction: rtl;
      font-family: sans-serif; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    `;

    container.innerHTML = `
      <h3 style="margin:0 0 10px; color:#222;">🚀 سارق ومترجم المانهاوا (Pure Scan)</h3>
      <div id="fetch-status" style="font-size:13px; color:#666; margin-bottom:8px;">جاري التهيئة...</div>
      <select id="chapter-select" style="width:100%; padding:8px; margin-bottom:10px;"></select>
      <div id="manhua-images" style="display:flex; flex-direction:column; align-items:center; max-height:500px; overflow-y:auto; background:#eee; padding:10px;"></div>
    `;

    document.body.insertBefore(container, document.body.firstChild);
    return {
      chapterSelect: container.querySelector('#chapter-select'),
      imagesDiv: container.querySelector('#manhua-images'),
      statusDiv: container.querySelector('#fetch-status')
    };
  }

  // تحميل صور الفصل
  async function loadChapterImages(chapterUrl, imagesDiv, statusDiv) {
    imagesDiv.innerHTML = '<p>⏳ جاري سحب الصور من الفصل...</p>';
    statusDiv.textContent = 'جاري الاتصال بالفصل...';

    const html = await fetchWithCors(chapterUrl);
    if (!html) {
      imagesDiv.innerHTML = '<p style="color:red;">❌ فشل جلب الفصل. موقع المانجا قد يكون محظوراً بالبروكسي.</p>';
      return;
    }

    const imageUrls = extractImageUrls(html);
    if (imageUrls.length === 0) {
      imagesDiv.innerHTML = '<p>لم يتم العثور على صور بالداخل.</p>';
      return;
    }

    // رفع للداتابيز
    saveToDatabase("manhua_chapters", {
      chapterUrl: chapterUrl,
      totalImages: imageUrls.length,
      images: imageUrls
    });

    statusDiv.textContent = `تم العثور على ${imageUrls.length} صورة!`;
    imagesDiv.innerHTML = '';

    imageUrls.forEach((src) => {
      const img = document.createElement('img');
      img.src = src;
      img.style.cssText = 'max-width:100%; margin:5px 0; border:1px solid #ccc;';
      imagesDiv.appendChild(img);
    });
  }

  // الدالة الرئيسية
  async function init() {
    const ui = createUI();
    await initFirebase();

    ui.statusDiv.textContent = 'جاري سحب الفهرس الرئيسي...';
    const indexHtml = await fetchWithCors(MANHUA_INDEX_URL);

    if (!indexHtml) {
      ui.statusDiv.textContent = '❌ فشل جلب الفهرس. افحص الـ Console.';
      return;
    }

    const chapters = extractChapterLinks(indexHtml);
    if (chapters.length === 0) {
      ui.statusDiv.textContent = '❌ لم يتم العثور على فصول بالصفحة.';
      return;
    }

    saveToDatabase("manhua_index", {
      sourceUrl: MANHUA_INDEX_URL,
      totalChapters: chapters.length,
      chaptersList: chapters
    });

    ui.statusDiv.textContent = `تم سحب ${chapters.length} فصل بنجاح!`;

    chapters.forEach((ch) => {
      const opt = document.createElement('option');
      opt.value = ch.url;
      opt.textContent = ch.title;
      ui.chapterSelect.appendChild(opt);
    });

    ui.chapterSelect.addEventListener('change', () => {
      loadChapterImages(ui.chapterSelect.value, ui.imagesDiv, ui.statusDiv);
    });

    if (chapters.length > 0) {
      loadChapterImages(chapters[0].url, ui.imagesDiv, ui.statusDiv);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
