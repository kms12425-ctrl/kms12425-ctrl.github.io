'use strict';



// element toggle function
const elementToggleFunc = function (elem) { elem.classList.toggle("active"); }



// sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", function () { elementToggleFunc(sidebar); });



// ================= GitHub Repositories (replacing testimonials) =================
const repoList = document.getElementById('repo-list');
const repoLoading = document.getElementById('repo-loading');
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

async function fetchRepos()
{
  if (!repoList) return;

  const workerEndpoint = 'https://github-proxy.kms12425-ctrl.workers.dev/api/repos';
  const publicFallback = 'https://api.github.com/users/kms12425-ctrl/repos?per_page=12&sort=updated';

  // 0) 先尝试读取 localStorage 的上次缓存，提升首屏（异步更新）
  try {
    const cached = localStorage.getItem('repos-cache-v1');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.repos)) {
        renderRepos(parsed.repos);
        const lastEl = document.getElementById('repo-last-update');
        if (lastEl && parsed.generated_at) {
          lastEl.textContent = 'Cached: ' + new Date(parsed.generated_at).toLocaleString();
        }
      }
    }
  } catch (_) { }

  // 包装 fetch 增加超时
  const fetchWithTimeout = (url, ms = 4500) =>
  {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    return fetch(url, { cache: 'no-store', signal: controller.signal })
      .finally(() => clearTimeout(t));
  };

  // 1) 优先访问 Worker（带超时）
  // try {
  //   const resp = await fetchWithTimeout(workerEndpoint, 4500);
  //   if (!resp.ok) throw new Error('Worker failed: ' + resp.status);
  //   const payload = await resp.json();
  //   if (payload && Array.isArray(payload.repos)) {
  //     // 若之前已经渲染缓存列表，这里可以进行差异更新（简单直接重绘）
  //     repoList.innerHTML = '';
  //     renderRepos(payload.repos);
  //     const lastEl = document.getElementById('repo-last-update');
  //     if (lastEl && payload.generated_at) {
  //       lastEl.textContent = 'Synced: ' + new Date(payload.generated_at).toLocaleString();
  //     }
  //     try { localStorage.setItem('repos-cache-v1', JSON.stringify(payload)); } catch (_) { }
  //     return;
  //   }
  //   throw new Error('Unexpected worker JSON shape');
  // } catch (e) {
  //   console.warn('[Worker fallback]', e);
  // }

  // 2) 回退直接 GitHub 公共 API（非授权，速率较低）
  try {
    const resp = await fetchWithTimeout(publicFallback, 5000);
    if (!resp.ok) throw new Error('GitHub API error ' + resp.status);
    const data = await resp.json();
    // 与 worker 返回字段不完全一致，这里直接渲染
    repoList.innerHTML = '';
    renderRepos(data);
  } catch (e2) {
    console.error('Fetch repos failed:', e2);
    if (repoLoading) {
      const titleEl = repoLoading.querySelector('.h4');
      if (titleEl) titleEl.innerText = 'Failed to load repositories: ' + e2.message;
    }
  }
}

function renderRepos(repos)
{
  if (repoLoading) repoLoading.remove();
  if (!repos || !repos.length) {
    const li = document.createElement('li');
    li.innerHTML = '<div class="content-card"><h4 class="h4 testimonials-item-title">No repositories found.</h4></div>';
    repoList.appendChild(li);
    return;
  }
  repos.forEach(repo =>
  {
    const li = document.createElement('li');
    li.className = 'testimonials-item';
    li.innerHTML = `
      <div class="content-card repo-card" data-repo>
        <h4 class="h4 testimonials-item-title">${repo.name}</h4>
        <div class="testimonials-text">
          <p>${repo.description ? escapeHTML(repo.description) : 'No description.'}</p>
          <p style="margin-top:0.5rem; font-size:0.85rem; opacity:0.8;">⭐ ${repo.stargazers_count} • ${repo.language || 'No Lang'} • Updated ${new Date(repo.updated_at).toLocaleDateString()}</p>
        </div>
      </div>`;
    li.addEventListener('click', () => openRepoModal(repo));
    repoList.appendChild(li);
  });
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

fetchRepos();


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