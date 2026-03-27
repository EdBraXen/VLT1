/* ═══════════════════════════════════════════════
   KNOWLEDGE VAULT — app.js
   Features:
   • Load / Add / Edit / Delete notes (REST API)
   • Delete protected by password (2@@7A)
   • YouTube auto-thumbnail detection
   • Category auto-detection per note
   • Category tab filtering
   • Fuzzy search (title + content)
   • Grid / List view toggle
   • Copy to clipboard
   • Star / Bookmark (localStorage)
   • Toast notification system
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ──────────────────────────────────────────
     TOAST SYSTEM
  ──────────────────────────────────────── */
  const toastsEl = document.getElementById('toasts');

  function toast(msg, type = 'info') {
    const iconMap = { success: 'ph-check-circle', error: 'ph-x-circle', info: 'ph-info' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="ph ${iconMap[type] || iconMap.info}"></i>${msg}`;
    toastsEl.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  /* ──────────────────────────────────────────
     THEME TOGGLE
  ──────────────────────────────────────── */
  const themeBtn = document.getElementById('themeToggle');
  const saved = localStorage.getItem('kv-theme');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
    themeBtn.querySelector('i').className = 'ph ph-moon';
  }

  themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    themeBtn.querySelector('i').className = isLight ? 'ph ph-moon' : 'ph ph-sun';
    localStorage.setItem('kv-theme', isLight ? 'light' : 'dark');
  });

  /* ──────────────────────────────────────────
     CONSTANTS & STATE
  ──────────────────────────────────────── */
  const DELETE_PASSWORD = '2@@7A';

  let allNotes    = [];
  let starred     = JSON.parse(localStorage.getItem('kv-starred') || '{}');
  let editingId   = null;
  let pendingDel  = null;
  let activeTab   = 'all';
  let searchTerm  = '';
  let isListView  = false;

  /* ──────────────────────────────────────────
     HELPER UTILS
  ──────────────────────────────────────── */
  function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /**
   * Detect YouTube video ID from a URL
   */
  function ytId(url) {
    if (!url) return null;
    const m = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }

  /**
   * Get domain from URL
   */
  function domain(url) {
    try { return new URL(url).hostname.replace('www.','').toUpperCase(); }
    catch { return url; }
  }

  /**
   * Auto-detect category of a note
   */
  function detectCat(note) {
    if (note.item_type === 'code') return 'kod';
    const u = (note.url || '').toLowerCase();
    const t = (note.title || '').toLowerCase();
    const c = (note.content || '').toLowerCase();
    if (u.includes('github.com') || u.includes('gitlab.com')) return 'github';
    if (u.includes('youtube.com') || u.includes('youtu.be') ||
        u.includes('vimeo.com') || t.includes('video')) return 'video';
    if (u.includes('openai') || u.includes('anthropic') || u.includes('claude') ||
        u.includes('gemini') || u.includes('huggingface') ||
        t.includes(' ai ') || c.includes('chatgpt') || c.includes('llm')) return 'ai';
    if (note.item_type === 'link') return 'link';
    return 'not';
  }

  /**
   * Badge HTML for a category
   */
  function badge(cat) {
    const map = {
      github: ['<i class="ph ph-hash"></i> GITHUB', 'badge-github'],
      video:  ['<i class="ph ph-hash"></i> VIDEO',  'badge-video'],
      ai:     ['<i class="ph ph-hash"></i> AI',     'badge-ai'],
      kod:    ['<i class="ph ph-hash"></i> KOD',    'badge-kod'],
      not:    ['<i class="ph ph-hash"></i> QEYD',   'badge-not'],
      link:   ['<i class="ph ph-hash"></i> LİNK',   'badge-link'],
    };
    const [label, cls] = map[cat] || map.not;
    return `<span class="badge ${cls}">${label}</span>`;
  }

  /* ──────────────────────────────────────────
     TAB COUNTS UPDATE
  ──────────────────────────────────────── */
  const cats = ['all','github','video','ai','kod','not','link'];

  function updateCounts(notes) {
    const counts = {};
    cats.forEach(c => counts[c] = 0);
    counts.all = notes.length;
    notes.forEach(n => {
      const c = detectCat(n);
      if (counts[c] !== undefined) counts[c]++;
    });
    cats.forEach(c => {
      const el = document.getElementById(`cnt-${c}`);
      if (el) el.textContent = counts[c];
    });
    document.getElementById('liveCount').textContent = `${notes.length} qeyd`;
  }

  /* ──────────────────────────────────────────
     FILTER & RENDER PIPELINE
  ──────────────────────────────────────── */
  function filtered() {
    return allNotes.filter(n => {
      if (activeTab !== 'all' && detectCat(n) !== activeTab) return false;
      if (searchTerm) {
        const hay = `${n.title} ${n.content} ${n.url}`.toLowerCase();
        if (!hay.includes(searchTerm)) return false;
      }
      return true;
    });
  }

  function renderNotes(notes) {
    const grid = document.getElementById('vaultGrid');
    grid.innerHTML = '';
    grid.className = isListView ? 'vault-grid list-view' : 'vault-grid';

    if (notes.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="ph ph-ghost"></i>
          <span>Heç bir nəticə tapılmadı.</span>
        </div>`;
      return;
    }

    notes.forEach(note => {
      const cat      = detectCat(note);
      const ytVid    = ytId(note.url);
      const isStarred= !!starred[note.id];

      /* thumbnail/video */
      let mediaHtml = '';
      if (!isListView) {
        if (ytVid) {
          mediaHtml = `
            <div class="card-video">
              <iframe src="https://www.youtube.com/embed/${ytVid}?controls=1&rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>`;
        } else if (cat !== 'not' && cat !== 'kod') {
          const iconMap = {
            github: '<i class="ph ph-github-logo"></i>',
            video:  '<i class="ph ph-youtube-logo"></i>',
            ai:     '<i class="ph ph-robot"></i>',
            link:   '<i class="ph ph-link"></i>'
          };
          mediaHtml = `
            <div class="card-thumb platform-logo logo-${cat}">
              ${iconMap[cat] || '<i class="ph ph-link"></i>'}
            </div>`;
        }
      }

      /* body text (left border) */
      let bodyContent = '';
      if (note.item_type === 'code') {
        bodyContent = `<div class="card-desc"><pre class="card-code">${esc(note.content)}</pre></div>`;
      } else if (note.content) {
        bodyContent = `<div class="card-desc">${esc(note.content)}</div>`;
      }

      let sourceHtml = '';
      if (note.url) {
        sourceHtml = `<p class="card-source"><span class="dot"></span> ${esc(domain(note.url))}</p>`;
      }

      const openBtn = note.url
        ? `<a class="btn-open" href="${esc(note.url)}" target="_blank" rel="noopener">Aç <i class="ph ph-arrow-square-out"></i></a>`
        : '';
      const copyVal = note.url || note.content || note.title || '';

      const card = document.createElement('article');
      card.className = 'vault-card';
      card.dataset.id = note.id;
      card.innerHTML = `
        <div class="card-body">
          <div class="card-top">
            ${badge(cat)}
            <button class="star-btn ${isStarred ? 'active' : ''}" data-id="${note.id}" title="Əlfəcin">
              <i class="ph ${isStarred ? 'ph-star-fill' : 'ph-star'}"></i>
            </button>
          </div>
          <h3 class="card-title">${esc(note.title)}</h3>
          ${sourceHtml}
          ${mediaHtml}
          ${bodyContent}
          <div class="card-footer">
            ${openBtn}
            <button class="btn-copy" data-copy="${esc(copyVal)}">
              Kopyala <i class="ph ph-copy"></i>
            </button>
            <div class="footer-spacer"></div>
            <button class="icon-btn edit" data-id="${note.id}" title="Redaktə">
              <i class="ph ph-pencil-simple"></i>
            </button>
            <button class="icon-btn del" data-id="${note.id}" title="Sil">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        </div>`;

      grid.appendChild(card);
    });

    /* ── bind card events ── */
    grid.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        starred[id] = !starred[id];
        if (!starred[id]) delete starred[id];
        localStorage.setItem('kv-starred', JSON.stringify(starred));
        btn.classList.toggle('active');
        btn.innerHTML = starred[id] ? '<i class="ph ph-star-fill"></i>' : '<i class="ph ph-star"></i>';
        toast(starred[id] ? 'Əlfəcinlərə əlavə edildi' : 'Əlfəcindən silindi', 'info');
      });
    });

    grid.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const val = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(val);
          btn.classList.add('copied');
          btn.innerHTML = '<i class="ph ph-check"></i> Kopyalandı';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="ph ph-copy"></i> Kopyala';
          }, 2000);
        } catch {
          toast('Kopyalamaq mümkün olmadı.', 'error');
        }
      });
    });

    grid.querySelectorAll('.play-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.open(btn.dataset.url, '_blank', 'noopener');
      });
    });

    grid.querySelectorAll('.icon-btn.edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const note = allNotes.find(n => n.id == btn.dataset.id);
        if (note) openAddModal(note);
      });
    });

    grid.querySelectorAll('.icon-btn.del').forEach(btn => {
      btn.addEventListener('click', () => openDelModal(+btn.dataset.id));
    });
  }

  function refresh() {
    updateCounts(allNotes);
    renderNotes(filtered());
  }

  /* ──────────────────────────────────────────
     LOAD FROM API
  ──────────────────────────────────────── */
  async function loadNotes() {
    try {
      const res = await fetch('/api/vaults');
      if (!res.ok) throw new Error();
      allNotes = await res.json();
      refresh();
    } catch {
      document.getElementById('vaultGrid').innerHTML = `
        <div class="empty-state">
          <i class="ph ph-wifi-slash"></i>
          <span>Serverə qoşulmaq mümkün olmadı. Backend işləyir?</span>
        </div>`;
    }
  }

  /* ──────────────────────────────────────────
     SEARCH
  ──────────────────────────────────────── */
  document.getElementById('searchInput').addEventListener('input', e => {
    searchTerm = e.target.value.toLowerCase().trim();
    refresh();
  });

  /* ──────────────────────────────────────────
     CATEGORY TABS
  ──────────────────────────────────────── */
  document.getElementById('tabBar').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.cat;
    refresh();
  });

  /* ──────────────────────────────────────────
     VIEW TOGGLE
  ──────────────────────────────────────── */
  document.getElementById('gridViewBtn').addEventListener('click', () => {
    isListView = false;
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
    refresh();
  });
  document.getElementById('listViewBtn').addEventListener('click', () => {
    isListView = true;
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
    refresh();
  });

  /* ──────────────────────────────────────────
     ADD / EDIT MODAL
  ──────────────────────────────────────── */
  const addModal  = document.getElementById('addModal');
  const fTitle    = document.getElementById('fTitle');
  const fType     = document.getElementById('fType');
  const fUrl      = document.getElementById('fUrl');
  const fUrlLabel = document.getElementById('fUrlLabel');
  const fContent  = document.getElementById('fContent');
  const saveBtn   = document.getElementById('saveBtn');

  function updateUrlField() {
    const show = fType.value === 'link';
    fUrl.style.display      = show ? '' : 'none';
    fUrlLabel.style.display = show ? '' : 'none';
    if (!show) fUrl.value = '';
  }

  fType.addEventListener('change', updateUrlField);

  function openAddModal(note = null) {
    editingId = note ? note.id : null;
    const titleEl = document.getElementById('addModalTitle');
    if (note) {
      titleEl.innerHTML = '<i class="ph ph-pencil-simple"></i> Qeydi Redaktə Et';
      fTitle.value   = note.title   || '';
      fType.value    = note.item_type || 'note';
      fUrl.value     = note.url      || '';
      fContent.value = note.content  || '';
    } else {
      titleEl.innerHTML = '<i class="ph ph-lightning"></i> Yeni Qeyd';
      fTitle.value = ''; fType.value = 'note';
      fUrl.value = ''; fContent.value = '';
    }
    updateUrlField();
    addModal.classList.add('active');
    setTimeout(() => fTitle.focus(), 80);
  }

  function closeAddModal() {
    addModal.classList.remove('active');
    editingId = null;
  }

  document.getElementById('addBtn').addEventListener('click', () => openAddModal());
  document.getElementById('closeAddModal').addEventListener('click', closeAddModal);
  document.getElementById('cancelAddModal').addEventListener('click', closeAddModal);
  addModal.addEventListener('click', e => { if (e.target === addModal) closeAddModal(); });

  saveBtn.addEventListener('click', async () => {
    const title   = fTitle.value.trim();
    const content = fContent.value.trim();
    const type    = fType.value;
    const url     = (fUrl.value || '').trim();

    if (!title) {
      toast('Başlıq daxil edilməlidir.', 'error');
      fTitle.focus(); return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="ph ph-spinner"></i> Saxlanılır...';

    const body = { title, content, url, item_type: type };
    try {
      const res = await fetch(
        editingId ? `/api/vaults/${editingId}` : '/api/vaults',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
      );
      if (res.ok) {
        closeAddModal();
        document.getElementById('searchInput').value = '';
        searchTerm = '';
        await loadNotes();
        toast(editingId ? 'Qeyd yeniləndi!' : 'Qeyd əlavə edildi!', 'success');
      } else {
        toast('Xəta baş verdi.', 'error');
      }
    } catch {
      toast('Serverə qoşulmaq alınmadı.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="ph ph-floppy-disk"></i> Yadda Saxla';
    }
  });

  /* ──────────────────────────────────────────
     DELETE MODAL (Password: 2@@7A)
  ──────────────────────────────────────── */
  const delModal  = document.getElementById('deleteModal');
  const fPw       = document.getElementById('fPw');
  const pwErr     = document.getElementById('pwErr');
  const pwEye     = document.getElementById('pwEye');
  const pwEyeIcon = document.getElementById('pwEyeIcon');
  const confirmBtn= document.getElementById('confirmDelBtn');

  pwEye.addEventListener('click', () => {
    const isText = fPw.type === 'text';
    fPw.type = isText ? 'password' : 'text';
    pwEyeIcon.className = `ph ${isText ? 'ph-eye' : 'ph-eye-slash'}`;
  });

  function openDelModal(id) {
    pendingDel = id;
    fPw.value  = ''; fPw.type = 'password';
    pwEyeIcon.className = 'ph ph-eye';
    pwErr.classList.remove('show');
    delModal.classList.add('active');
    setTimeout(() => fPw.focus(), 80);
  }

  function closeDelModal() {
    delModal.classList.remove('active');
    pendingDel = null;
    fPw.value = '';
    pwErr.classList.remove('show');
  }

  document.getElementById('closeDelModal').addEventListener('click', closeDelModal);
  document.getElementById('cancelDelModal').addEventListener('click', closeDelModal);
  delModal.addEventListener('click', e => { if (e.target === delModal) closeDelModal(); });

  fPw.addEventListener('keydown', e => { if (e.key === 'Enter') confirmBtn.click(); });

  confirmBtn.addEventListener('click', async () => {
    if (fPw.value !== DELETE_PASSWORD) {
      pwErr.classList.add('show');
      fPw.value = '';
      fPw.style.animation = 'none';
      void fPw.offsetHeight;
      fPw.style.animation = 'shake 0.38s ease';
      fPw.focus();
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="ph ph-spinner"></i> Silinir...';

    try {
      const res = await fetch(`/api/vaults/${pendingDel}`, { method: 'DELETE' });
      if (res.ok) {
        allNotes = allNotes.filter(n => n.id !== pendingDel);
        delete starred[pendingDel];
        localStorage.setItem('kv-starred', JSON.stringify(starred));
        refresh();
        closeDelModal();
        toast('Qeyd silindi.', 'success');
      } else {
        toast('Silinmə xətası.', 'error');
      }
    } catch {
      toast('Serverə qoşulmaq alınmadı.', 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="ph ph-trash"></i> Sil';
    }
  });

  /* ──────────────────────────────────────────
     KEYBOARD SHORTCUTS
  ──────────────────────────────────────── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAddModal(); closeDelModal(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openAddModal();
    }
  });

  /* ──────────────────────────────────────────
     INIT
  ──────────────────────────────────────── */
  updateUrlField();
  loadNotes();
});
