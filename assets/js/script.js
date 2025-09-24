'use strict';



// element toggle function
const elementToggleFunc = function (elem) { elem.classList.toggle("active"); }



// sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", function () { elementToggleFunc(sidebar); });



// ================= GitHub Repositories (replacing testimonials) =================
const repoList = document.getElementById('repo-list'); // 现在是 track
const repoCarousel = document.getElementById('repo-carousel');
const repoPrevBtn = document.getElementById('repo-prev');
const repoNextBtn = document.getElementById('repo-next');
let repoSlides = [];
let repoActiveIndex = 0;
// 触摸滑动相关状态
let repoIsDragging = false;
let repoDragStartX = 0;
let repoDragDeltaX = 0;
let repoDragWasMoved = false;
const REPO_SWIPE_THRESHOLD = 0.18; // 宽度 18% 触发翻页
// 自动播放相关
let repoAutoplayTimer = null;
const REPO_AUTOPLAY_INTERVAL = 6500; // 6.5s
let repoAutoplayPaused = false;
let repoAutoplayUserPaused = false; // 用户交互导致暂停
const repoLoading = document.getElementById('repo-loading');
// 进度指示圆点容器（如果在 HTML 中未写死，我们运行时创建）
let repoDotsContainer = document.getElementById('repo-dots');
if (!repoDotsContainer && repoCarousel) {
  repoDotsContainer = document.createElement('div');
  repoDotsContainer.id = 'repo-dots';
  repoDotsContainer.className = 'repo-dots';
  repoCarousel.parentNode.insertBefore(repoDotsContainer, repoCarousel.nextSibling);
}
let repoDots = [];
const modalContainer = document.querySelector('[data-modal-container]');
const modalCloseBtn = document.querySelector('[data-modal-close-btn]');
const overlay = document.querySelector('[data-overlay]');
const modalTitle = document.querySelector('[data-modal-title]');
const modalText = document.querySelector('[data-modal-text]');
const modalLink = document.querySelector('[data-modal-link]');
const modalUpdated = document.querySelector('[data-modal-updated]');

function toggleRepoModal()
{
  if (modalContainer.style.display === 'none' || !modalContainer.style.display) {
    // 使用 flex 以启用居中布局（CSS 中 .modal-container 已定义 display:flex）
    modalContainer.style.display = 'flex';
    requestAnimationFrame(() => modalContainer.classList.add('active'));
    overlay.classList.add('active');
  } else {
    modalContainer.classList.remove('active');
    overlay.classList.remove('active');
    setTimeout(() => { modalContainer.style.display = 'none'; }, 200);
  }
}

modalCloseBtn && modalCloseBtn.addEventListener('click', toggleRepoModal);
overlay && overlay.addEventListener('click', toggleRepoModal);

async function initRepos()
{
  if (!repoList) return;
  // 1) 优先缓存
  const cached = window.RepoAPI && RepoAPI.getCachedRepos();
  if (cached && cached.repos) {
    renderRepos(cached.repos);
    const lastEl = document.getElementById('repo-last-update');
    if (lastEl && cached.generated_at) {
      lastEl.textContent = 'Cached: ' + new Date(cached.generated_at).toLocaleString();
    }
  }
  // 2) 异步刷新网络
  try {
    const fresh = await RepoAPI.fetchRepos({ preferWorker: false, timeout: 5000 });
    if (fresh && fresh.repos) {
      renderRepos(fresh.repos);
      const lastEl = document.getElementById('repo-last-update');
      if (lastEl) {
        lastEl.textContent = 'Updated: ' + new Date(fresh.generated_at).toLocaleString();
      }
    }
  } catch (err) {
    console.error('[RepoAPI] network error:', err);
    if (!cached) {
      if (repoLoading) {
        const titleEl = repoLoading.querySelector('.h4');
        if (titleEl) titleEl.innerText = 'Failed to load repositories: ' + err.message;
      }
    }
  }
}

function renderRepos(repos)
{
  if (repoLoading) repoLoading.remove();
  repoList.innerHTML = '';
  repoSlides = [];

  if (!repos || !repos.length) {
    const empty = document.createElement('li');
    empty.className = 'repo-slide';
    empty.innerHTML = '<div class="content-card"><h4 class="h4 testimonials-item-title">No repositories found.</h4></div>';
    repoList.appendChild(empty);
    repoSlides.push(empty);
    updateRepoCarousel();
    return;
  }

  repos.forEach((repo, idx) =>
  {
    const li = document.createElement('li');
    li.className = 'repo-slide';
    li.setAttribute('data-index', String(idx));
    li.innerHTML = `
      <div class="content-card repo-card" data-repo tabindex="0" aria-label="Repository ${escapeHTML(repo.name)}">
        <h4 class="h4 testimonials-item-title">${escapeHTML(repo.name)}</h4>
        <div class="testimonials-text">
          <p>${repo.description ? escapeHTML(repo.description) : 'No description.'}</p>
          <p style="margin-top:0.5rem; font-size:0.75rem; opacity:0.75; letter-spacing:.5px;">⭐ ${repo.stargazers_count} • ${escapeHTML(repo.language || 'No Lang')} • Updated ${new Date(repo.updated_at).toLocaleDateString()}</p>
        </div>
      </div>`;
    li.addEventListener('click', () => openRepoModal(repo));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRepoModal(repo); } });
    repoList.appendChild(li);
    repoSlides.push(li);
  });
  repoActiveIndex = 0;
  updateRepoCarousel();
  bindRepoNav();
  buildRepoDots();
}

function updateRepoCarousel()
{
  if (!repoSlides.length) return;
  // 轨道移动
  if (!repoIsDragging) {
    const offset = repoActiveIndex * -100;
    // 使用统一类控制速度，避免闪烁
    if (!repoList.classList.contains('smooth-transition')) {
      repoList.classList.add('smooth-transition');
    }
    repoList.style.transform = `translateX(${offset}%)`;
  }

  // 状态类
  repoSlides.forEach((slide, i) =>
  {
    slide.classList.remove('is-active', 'is-prev', 'is-next');
    if (i === repoActiveIndex) slide.classList.add('is-active');
    else if (i === repoActiveIndex - 1) slide.classList.add('is-prev');
    else if (i === repoActiveIndex + 1) slide.classList.add('is-next');
  });

  // 按钮状态
  if (repoPrevBtn && repoNextBtn) {
    const few = repoSlides.length < 2;
    if (few) {
      repoPrevBtn.style.visibility = 'hidden';
      repoNextBtn.style.visibility = 'hidden';
    } else {
      repoPrevBtn.style.visibility = 'visible';
      repoNextBtn.style.visibility = 'visible';
      repoPrevBtn.disabled = repoActiveIndex <= 0;
      repoNextBtn.disabled = repoActiveIndex >= repoSlides.length - 1;
    }
  }

  // 左右渐隐提示 class 维护
  if (repoCarousel) {
    if (repoActiveIndex > 0) repoCarousel.classList.add('has-prev'); else repoCarousel.classList.remove('has-prev');
    if (repoActiveIndex < repoSlides.length - 1) repoCarousel.classList.add('has-next'); else repoCarousel.classList.remove('has-next');
  }

  // 更新 dots
  if (repoDots && repoDots.length) {
    repoDots.forEach((d, i) =>
    {
      if (i === repoActiveIndex) d.classList.add('active'); else d.classList.remove('active');
      d.setAttribute('aria-selected', i === repoActiveIndex ? 'true' : 'false');
      d.tabIndex = i === repoActiveIndex ? 0 : -1;
    });
  }
}

function buildRepoDots()
{
  if (!repoDotsContainer) return;
  repoDotsContainer.innerHTML = '';
  repoDots = [];
  if (repoSlides.length < 2) { repoDotsContainer.style.display = 'none'; return; } else { repoDotsContainer.style.display = 'flex'; }
  repoDotsContainer.setAttribute('role', 'tablist');
  repoSlides.forEach((_, i) =>
  {
    const b = document.createElement('button');
    b.className = 'repo-dot';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', 'Go to slide ' + (i + 1));
    b.addEventListener('click', () =>
    {
      repoActiveIndex = i;
      updateRepoCarousel();
      pauseRepoAutoplay(true);
    });
    b.addEventListener('keydown', (e) =>
    {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); repoActiveIndex = i; updateRepoCarousel(); pauseRepoAutoplay(true); }
    });
    repoDotsContainer.appendChild(b);
    repoDots.push(b);
  });
  updateRepoCarousel();
}

function repoAutoplayStep()
{
  if (repoAutoplayPaused || repoAutoplayUserPaused) return;
  if (repoActiveIndex < repoSlides.length - 1) {
    repoActiveIndex++;
    updateRepoCarousel();
  } else {
    // 循环回到开头
    repoActiveIndex = 0;
    updateRepoCarousel();
  }
}

function startRepoAutoplay()
{
  clearRepoAutoplay();
  repoAutoplayPaused = false;
  repoAutoplayTimer = setInterval(repoAutoplayStep, REPO_AUTOPLAY_INTERVAL);
}

function clearRepoAutoplay()
{
  if (repoAutoplayTimer) {
    clearInterval(repoAutoplayTimer);
    repoAutoplayTimer = null;
  }
}

function pauseRepoAutoplay(user = false)
{
  if (user) repoAutoplayUserPaused = true;
  repoAutoplayPaused = true;
  clearRepoAutoplay();
}

function resumeRepoAutoplay(delay = 6000)
{
  if (repoAutoplayUserPaused) return; // 用户主动暂停则不自动恢复
  repoAutoplayPaused = false;
  clearRepoAutoplay();
  setTimeout(() => { if (!repoAutoplayPaused && !repoAutoplayUserPaused) startRepoAutoplay(); }, delay);
}

function bindRepoNav()
{
  if (!repoPrevBtn || !repoNextBtn) return;
  if (!repoPrevBtn._bound) {
    repoPrevBtn.addEventListener('click', () => { if (repoActiveIndex > 0) { repoActiveIndex--; updateRepoCarousel(); } pauseRepoAutoplay(); resumeRepoAutoplay(10000); });
    repoPrevBtn._bound = true;
  }
  if (!repoNextBtn._bound) {
    repoNextBtn.addEventListener('click', () => { if (repoActiveIndex < repoSlides.length - 1) { repoActiveIndex++; updateRepoCarousel(); } pauseRepoAutoplay(); resumeRepoAutoplay(10000); });
    repoNextBtn._bound = true;
  }
  // 键盘方向键支持
  if (!repoCarousel._keydownBound) {
    repoCarousel.addEventListener('keydown', (e) =>
    {
      if (e.key === 'ArrowRight') { if (repoActiveIndex < repoSlides.length - 1) { repoActiveIndex++; updateRepoCarousel(); } }
      else if (e.key === 'ArrowLeft') { if (repoActiveIndex > 0) { repoActiveIndex--; updateRepoCarousel(); } }
      pauseRepoAutoplay();
      resumeRepoAutoplay(10000);
    });
    repoCarousel._keydownBound = true;
  }
  // Resize 处理
  if (!window._repoResizeBound) {
    window.addEventListener('resize', () => { updateRepoCarousel(); });
    window._repoResizeBound = true;
  }

  // 触摸/指针滑动绑定（仅绑定一次）
  if (!repoCarousel._pointerBound) {
    const onPointerDown = (e) =>
    {
      if (e.pointerType && e.pointerType !== 'touch' && e.pointerType !== 'pen') return; // 只处理触摸/笔
      if (!repoSlides.length) return;
      repoIsDragging = true;
      repoDragWasMoved = false;
      repoDragStartX = e.clientX;
      repoDragDeltaX = 0;
      repoList.style.transition = 'none';
      pauseRepoAutoplay();
      resumeRepoAutoplay(10000);
    };
    const onPointerMove = (e) =>
    {
      if (!repoIsDragging) return;
      repoDragDeltaX = e.clientX - repoDragStartX;
      if (Math.abs(repoDragDeltaX) > 3) repoDragWasMoved = true;
      const percent = (repoDragDeltaX / repoCarousel.clientWidth) * 100;
      const base = repoActiveIndex * -100;
      repoList.style.transform = `translateX(${base + percent}%)`;
    };
    const onPointerUp = (e) =>
    {
      if (!repoIsDragging) return;
      repoIsDragging = false;
      repoList.style.transition = ''; // 使用 CSS 过渡
      const width = repoCarousel.clientWidth || 1;
      const ratio = repoDragDeltaX / width;
      if (ratio > REPO_SWIPE_THRESHOLD && repoActiveIndex > 0) {
        repoActiveIndex--;
      } else if (ratio < -REPO_SWIPE_THRESHOLD && repoActiveIndex < repoSlides.length - 1) {
        repoActiveIndex++;
      }
      repoDragDeltaX = 0;
      updateRepoCarousel();
    };
    repoCarousel.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    repoCarousel._pointerBound = true;
  }

  // 初始启动自动播放（如果有多于 1 张）
  if (repoSlides.length > 1 && !repoAutoplayTimer && !repoAutoplayUserPaused) {
    startRepoAutoplay();
  }
}

function escapeHTML(str)
{
  return str.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[c]));
}

function openRepoModal(repo)
{
  modalTitle.textContent = repo.name;
  modalText.innerHTML = `<p>${repo.description ? escapeHTML(repo.description) : 'No description.'}</p>
    <p style="margin-top:0.75rem; font-size:0.85rem; opacity:0.85;">⭐ Stars: ${repo.stargazers_count} | Forks: ${repo.forks_count} | Issues: ${repo.open_issues_count}</p>`;
  modalLink.href = repo.html_url;
  modalUpdated.dateTime = repo.updated_at;
  modalUpdated.textContent = new Date(repo.updated_at).toLocaleString();
  toggleRepoModal();
}

// 初始化仓库数据
initRepos();


// custom select variables
const select = document.querySelector("[data-select]");
const selectItems = document.querySelectorAll("[data-select-item]");
const selectValue = document.querySelector("[data-selecct-value]");
const filterBtn = document.querySelectorAll("[data-filter-btn]");

select.addEventListener("click", function () { elementToggleFunc(this); });

// add event in all select items
for (let i = 0; i < selectItems.length; i++) {
  selectItems[i].addEventListener("click", function ()
  {

    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    elementToggleFunc(select);
    filterFunc(selectedValue);

  });
}

// filter variables
const filterItems = document.querySelectorAll("[data-filter-item]");

const filterFunc = function (selectedValue)
{

  for (let i = 0; i < filterItems.length; i++) {

    if (selectedValue === "all") {
      filterItems[i].classList.add("active");
    } else if (selectedValue === filterItems[i].dataset.category) {
      filterItems[i].classList.add("active");
    } else {
      filterItems[i].classList.remove("active");
    }

  }

}

// add event in all filter button items for large screen
let lastClickedBtn = filterBtn[0];

for (let i = 0; i < filterBtn.length; i++) {

  filterBtn[i].addEventListener("click", function ()
  {

    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    filterFunc(selectedValue);

    lastClickedBtn.classList.remove("active");
    this.classList.add("active");
    lastClickedBtn = this;

  });

}



// contact form variables
const form = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn = document.querySelector("[data-form-btn]");

// add event to all form input field
for (let i = 0; i < formInputs.length; i++) {
  formInputs[i].addEventListener("input", function ()
  {

    // check form validation
    if (form.checkValidity()) {
      formBtn.removeAttribute("disabled");
    } else {
      formBtn.setAttribute("disabled", "");
    }

  });
}



// page navigation variables
const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");

// add event to all nav link
for (let i = 0; i < navigationLinks.length; i++) {
  navigationLinks[i].addEventListener("click", function ()
  {

    for (let i = 0; i < pages.length; i++) {
      if (this.innerHTML.toLowerCase() === pages[i].dataset.page) {
        pages[i].classList.add("active");
        navigationLinks[i].classList.add("active");
        window.scrollTo(0, 0);
      } else {
        pages[i].classList.remove("active");
        navigationLinks[i].classList.remove("active");
      }
    }

  });
}