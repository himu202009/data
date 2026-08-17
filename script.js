/* ============================================================
   Student Profiles — app logic
   Text shown on the page comes from config.js (SITE_CONFIG).
   Colors come from style.css (:root variables).
   You normally don't need to edit this file.
   ============================================================ */

// Fallback so the page still works if config.js is missing/renamed.
const CFG = Object.assign({
    pageTitle: "Student Profiles",
    heroHeading: "Student Profiles",
    searchPlaceholder: "Search...",
    themeToggleLightLabel: "Switch to dark mode",
    themeToggleDarkLabel: "Switch to light mode",
    loadingText: "Loading students…",
    errorText: "Could not load student data. Please check your connection and try again.",
    retryButtonText: "Retry",
    noResultsText: "No student found matching your search!",
    resultsCountAllText: (t) => `${t.toLocaleString()} students total`,
    resultsCountFilteredText: (f, t) => `Showing ${f.toLocaleString()} of ${t.toLocaleString()} students`,
    labels: { id: "ID", email: "Email", phone: "Phone", institution: "Institution", hscBatch: "HSC Batch", transactionId: "Transaction ID" },
    emptyValueText: "N/A",
    copyButtonLabel: "Copy",
    copiedButtonLabel: "Copied!",
    copyAriaLabel: (f) => `Copy ${f}`,
    prevPageLabel: "‹ Prev",
    nextPageLabel: "Next ›",
    closeButtonAriaLabel: "Close",
}, typeof SITE_CONFIG !== "undefined" ? SITE_CONFIG : {});

let studentsData = [];
let filteredStudents = [];
let currentPage = 1;
const itemsPerPage = 20;
const CACHE_NAME = "student-directory-v1";

const grid = document.getElementById('student-grid');
const paginationEl = document.getElementById('pagination');
const resultsCountEl = document.getElementById('results-count');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

/* ============ Apply editable text from config.js ============ */

function applyConfigText() {
    document.title = CFG.pageTitle;
    document.getElementById('page-heading').textContent = CFG.heroHeading;
    searchInput.placeholder = CFG.searchPlaceholder;
    themeToggleBtn.setAttribute('aria-label', CFG.themeToggleLightLabel);
    document.getElementById('modal-close-btn').setAttribute('aria-label', CFG.closeButtonAriaLabel);
}

/* ============ Utilities ============ */

function getInitials(name) {
    const cleanName = String(name || 'Unknown').trim();
    const parts = cleanName.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return cleanName.substring(0, 2).toUpperCase();
}

function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function displayValue(value) {
    if (value === null || value === undefined || value === '' || value === 0) {
        return CFG.emptyValueText;
    }
    return escapeHTML(value);
}

function formatPhone(phone) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) return CFG.emptyValueText;
    if (digits.startsWith('880') && digits.length === 13) return '+' + digits;
    if (digits.startsWith('0') && digits.length === 11) return '+88' + digits;
    return String(phone);
}

function getId(student) {
    return student['student_id'] || student['ID'] || student['ID(used in students profile photo)'] || '';
}

function getName(student) {
    return student['name'] || student['Student Name'] || 'Unknown';
}

function getInstitution(student) {
    return student['institution'] || student['Institution'];
}

function getBatch(student) {
    return student['hscBatch'] || student['Batch'] || student['HscBatch'];
}

function getPhoneRaw(student) {
    return student['phone'] || student['Phone'];
}

function getEmail(student) {
    return student['email'] || student['Email'];
}

function getTransactionId(student) {
    return student['transactionId'] || student['Transaction ID'];
}

function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/* ============ Data load (cached + indexed for fast search) ============ */

function showStatus(message, isError = false) {
    grid.innerHTML = `
        <p class="status-message${isError ? ' error' : ''}">
            ${escapeHTML(message)}
            ${isError ? `<br><button class="retry-btn" id="retry-btn" type="button">${escapeHTML(CFG.retryButtonText)}</button>` : ''}
        </p>`;
    paginationEl.innerHTML = '';
    if (isError) {
        document.getElementById('retry-btn').addEventListener('click', loadStudents);
    }
}

function showSkeletonGrid() {
    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < itemsPerPage; i++) {
        const skel = document.createElement('div');
        skel.className = 'card';
        skel.setAttribute('aria-hidden', 'true');
        skel.innerHTML = `
            <div class="card-photo-wrap"></div>
            <h3 style="width:70%;height:14px;border-radius:6px;background:var(--skeleton-base);"></h3>`;
        fragment.appendChild(skel);
    }
    grid.appendChild(fragment);
}

// Fetch students.json through the Cache Storage API so repeat visits
// render instantly, while a fresh copy is quietly fetched in the
// background in case the data changed since the last visit.
async function fetchStudentsWithCache() {
    if (!('caches' in window)) {
        return fetch('students.json');
    }
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match('students.json');

    if (cached) {
        fetch('students.json')
            .then((fresh) => { if (fresh.ok) cache.put('students.json', fresh.clone()); })
            .catch(() => {});
        return cached;
    }

    const response = await fetch('students.json');
    if (response.ok) cache.put('students.json', response.clone());
    return response;
}

async function loadStudents() {
    showStatus(CFG.loadingText);
    showSkeletonGrid();

    try {
        const response = await fetchStudentsWithCache();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        studentsData = Array.isArray(data) ? data : [];

        // Build a single lowercase search string per student ONCE,
        // instead of re-joining every field on every keystroke.
        studentsData.forEach((student) => {
            student.__search = [
                getName(student),
                getId(student),
                getInstitution(student),
                getBatch(student),
                getPhoneRaw(student),
                getEmail(student),
            ].map((v) => String(v ?? '').toLowerCase()).join(' ');
        });

        filteredStudents = studentsData;
        currentPage = 1;
        displayStudents(currentPage);
    } catch (error) {
        console.error('Data load exception:', error);
        showStatus(CFG.errorText, true);
    }
}

/* ============ Search ============ */

function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();

    filteredStudents = query === ''
        ? studentsData
        : studentsData.filter((student) => student.__search.includes(query));

    currentPage = 1;
    displayStudents(currentPage);
}

searchInput.addEventListener('input', debounce(handleSearch, 200));

/* ============ Grid render ============ */

function updateResultsCount() {
    const total = studentsData.length;
    const found = filteredStudents.length;
    resultsCountEl.textContent = searchInput.value.trim()
        ? CFG.resultsCountFilteredText(found, total)
        : CFG.resultsCountAllText(total);
}

function displayStudents(page) {
    currentPage = page;
    grid.innerHTML = '';
    updateResultsCount();

    if (filteredStudents.length === 0) {
        grid.innerHTML = `<p class="status-message">${escapeHTML(CFG.noResultsText)}</p>`;
        paginationEl.innerHTML = '';
        return;
    }

    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedStudents = filteredStudents.slice(start, end);

    const fragment = document.createDocumentFragment();

    paginatedStudents.forEach((student) => {
        fragment.appendChild(buildCard(student));
    });

    grid.appendChild(fragment);
    renderPagination();
}

function buildCard(student) {
    const name = getName(student);
    const id = getId(student);
    const batch = getBatch(student);
    const photoUrl = student.photo || '';

    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View details for ${name}`);
    card.addEventListener('click', () => openModal(student));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(student);
        }
    });

    const photoWrap = document.createElement('div');
    photoWrap.className = 'card-photo-wrap';

    if (photoUrl) {
        const img = document.createElement('img');
        img.src = photoUrl;
        img.width = 92;
        img.height = 92;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = name;
        img.addEventListener('load', () => {
            img.classList.add('loaded');
            photoWrap.classList.add('loaded');
        });
        img.addEventListener('error', () => {
            photoWrap.classList.add('loaded');
            photoWrap.innerHTML = `<div class="initials-avatar">${escapeHTML(getInitials(name))}</div>`;
        }, { once: true });
        photoWrap.appendChild(img);
    } else {
        photoWrap.classList.add('loaded');
        photoWrap.style.background = 'none';
        photoWrap.style.animation = 'none';
        photoWrap.innerHTML = `<div class="initials-avatar">${escapeHTML(getInitials(name))}</div>`;
    }

    const heading = document.createElement('h3');
    heading.textContent = name;

    const idEl = document.createElement('p');
    idEl.className = 'card-id';
    idEl.textContent = id ? `ID: ${id}` : '';

    card.appendChild(photoWrap);
    card.appendChild(heading);
    card.appendChild(idEl);

    if (batch && batch !== 0) {
        const badge = document.createElement('span');
        badge.className = 'batch-badge';
        badge.textContent = `Batch ${batch}`;
        card.appendChild(badge);
    }

    return card;
}

/* ============ Pagination ============ */

function renderPagination() {
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    paginationEl.innerHTML = '';
    if (totalPages <= 1) return;

    paginationEl.appendChild(
        createBtn(CFG.prevPageLabel, () => gotoPage(currentPage - 1), currentPage === 1, 'Previous page')
    );

    getPageRange(currentPage, totalPages).forEach((item) => {
        if (item === '...') {
            const dots = document.createElement('span');
            dots.className = 'dots';
            dots.textContent = '...';
            paginationEl.appendChild(dots);
        } else {
            const pageBtn = createBtn(item, () => gotoPage(item), false, `Page ${item}`);
            if (item === currentPage) {
                pageBtn.classList.add('active');
                pageBtn.setAttribute('aria-current', 'page');
            }
            paginationEl.appendChild(pageBtn);
        }
    });

    paginationEl.appendChild(
        createBtn(CFG.nextPageLabel, () => gotoPage(currentPage + 1), currentPage === totalPages, 'Next page')
    );
}

function createBtn(text, onClick, disabled = false, label = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.disabled = disabled;
    btn.addEventListener('click', onClick);
    if (label) btn.setAttribute('aria-label', label);
    return btn;
}

function gotoPage(page) {
    displayStudents(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getPageRange(current, total) {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = [1];
    if (current > 3) pages.push('...');

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

/* ============ Copy-to-clipboard ============ */

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="2"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    // Fallback for older browsers / non-HTTPS pages
    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
            resolve();
        } catch (err) {
            reject(err);
        } finally {
            document.body.removeChild(textarea);
        }
    });
}

function buildInfoRow(fieldName, value, copyValue) {
    const row = document.createElement('div');
    row.className = 'info-row';

    const textWrap = document.createElement('div');
    textWrap.className = 'info-row-text';

    const label = document.createElement('span');
    label.className = 'info-label';
    label.textContent = fieldName;

    const valueEl = document.createElement('span');
    valueEl.className = 'info-value';
    if (fieldName === CFG.labels.id || fieldName === CFG.labels.transactionId || fieldName === CFG.labels.phone) {
        valueEl.classList.add('mono');
    }
    valueEl.textContent = value;

    textWrap.appendChild(label);
    textWrap.appendChild(valueEl);
    row.appendChild(textWrap);

    const isCopyable = copyValue && copyValue !== CFG.emptyValueText;
    if (isCopyable) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'copy-btn';
        btn.setAttribute('aria-label', CFG.copyAriaLabel(fieldName));
        btn.innerHTML = `${COPY_ICON}<span class="copy-btn-text">${escapeHTML(CFG.copyButtonLabel)}</span>`;

        btn.addEventListener('click', () => {
            copyToClipboard(String(copyValue)).then(() => {
                btn.classList.add('copied');
                btn.innerHTML = `${CHECK_ICON}<span class="copy-btn-text">${escapeHTML(CFG.copiedButtonLabel)}</span>`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `${COPY_ICON}<span class="copy-btn-text">${escapeHTML(CFG.copyButtonLabel)}</span>`;
                }, 1600);
            }).catch(() => {});
        });

        row.appendChild(btn);
    }

    return row;
}

/* ============ Modal ============ */

function openModal(student) {
    const name = getName(student);
    const id = getId(student);
    const photoUrl = student.photo || '';
    const batch = getBatch(student);
    const email = getEmail(student);
    const phoneFormatted = formatPhone(getPhoneRaw(student));
    const institution = getInstitution(student);
    const transactionId = getTransactionId(student);

    modalBody.innerHTML = '';

    const photoWrap = document.createElement('div');
    photoWrap.className = 'modal-photo-wrap';
    if (photoUrl) {
        const img = document.createElement('img');
        img.src = photoUrl;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = name;
        img.addEventListener('error', () => {
            photoWrap.innerHTML = `<div class="initials-avatar">${escapeHTML(getInitials(name))}</div>`;
        }, { once: true });
        photoWrap.appendChild(img);
    } else {
        photoWrap.innerHTML = `<div class="initials-avatar">${escapeHTML(getInitials(name))}</div>`;
    }

    const heading = document.createElement('h2');
    heading.id = 'modal-name';
    heading.textContent = name;

    modalBody.appendChild(photoWrap);
    modalBody.appendChild(heading);

    if (batch && batch !== 0) {
        const batchWrap = document.createElement('div');
        batchWrap.className = 'modal-batch';
        batchWrap.innerHTML = `<span class="batch-badge">Batch ${escapeHTML(batch)}</span>`;
        modalBody.appendChild(batchWrap);
    }

    const idDisplay = displayValue(id);
    const emailDisplay = displayValue(email);
    const phoneDisplay = phoneFormatted;
    const institutionDisplay = displayValue(institution);
    const batchDisplay = displayValue(batch);
    const transactionDisplay = displayValue(transactionId);

    modalBody.appendChild(buildInfoRow(CFG.labels.id, idDisplay, id));
    modalBody.appendChild(buildInfoRow(CFG.labels.email, emailDisplay, email));
    modalBody.appendChild(buildInfoRow(CFG.labels.phone, phoneDisplay, phoneDisplay !== CFG.emptyValueText ? phoneDisplay : null));
    modalBody.appendChild(buildInfoRow(CFG.labels.institution, institutionDisplay, institution));
    modalBody.appendChild(buildInfoRow(CFG.labels.hscBatch, batchDisplay, null));
    modalBody.appendChild(buildInfoRow(CFG.labels.transactionId, transactionDisplay, transactionId));

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('modal-close-btn').focus();
}

function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
});

document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-close-btn').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        closeModal();
    }
});

/* ============ Dark / light mode ============ */

const THEME_KEY = 'student-directory-theme';
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = themeToggleBtn.querySelector('.theme-icon');

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.textContent = '☀️';
        themeToggleBtn.setAttribute('aria-label', CFG.themeToggleDarkLabel);
        themeToggleBtn.setAttribute('aria-pressed', 'true');
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.textContent = '🌙';
        themeToggleBtn.setAttribute('aria-label', CFG.themeToggleLightLabel);
        themeToggleBtn.setAttribute('aria-pressed', 'false');
    }
}

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
        applyTheme(saved);
        return;
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
}

themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
    }
});

/* ============ Init ============ */

applyConfigText();
initTheme();
loadStudents();
