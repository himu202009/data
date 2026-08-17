let studentsData = [];
let filteredStudents = [];
let currentPage = 1;
const itemsPerPage = 20;

const grid = document.getElementById('student-grid');
const paginationEl = document.getElementById('pagination');
const resultsCountEl = document.getElementById('results-count');
const searchInput = document.getElementById('search-input');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

/* ============ Utilities ============ */

// Prevent any stray HTML/characters in the data from breaking markup (XSS-safe rendering)
function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Show a friendly placeholder instead of "null" / "undefined" / 0 for missing fields
function displayValue(value) {
    if (value === null || value === undefined || value === '' || value === 0) {
        return 'N/A';
    }
    return escapeHTML(value);
}

// Normalize phone numbers (data may store them as plain numbers, e.g. 8801885199017)
function formatPhone(phone) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) return 'N/A';
    if (digits.startsWith('880') && digits.length === 13) return '+' + digits;
    if (digits.startsWith('0') && digits.length === 11) return '+88' + digits;
    return String(phone);
}

function getId(student) {
    return student['ID(used in students profile photo)'] || student['ID'] || '';
}

function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/* ============ Data load ============ */

function showStatus(message, isError = false) {
    grid.innerHTML = `
        <p class="status-message${isError ? ' error' : ''}">
            ${escapeHTML(message)}
            ${isError ? '<br><button class="retry-btn" id="retry-btn" type="button">Retry</button>' : ''}
        </p>`;
    paginationEl.innerHTML = '';
    if (isError) {
        document.getElementById('retry-btn').addEventListener('click', loadStudents);
    }
}

function loadStudents() {
    showStatus('Loading students…');

    fetch('students.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            studentsData = Array.isArray(data) ? data : [];
            filteredStudents = studentsData;
            currentPage = 1;
            displayStudents(currentPage);
        })
        .catch(error => {
            console.error('Data load exception:', error);
            showStatus('Could not load student data. Please check your connection and try again.', true);
        });
}

loadStudents();

/* ============ Search ============ */

function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();

    if (query === '') {
        filteredStudents = studentsData;
    } else {
        filteredStudents = studentsData.filter(student => {
            const haystack = [
                student['Student Name'],
                getId(student),
                student['Institution'],
                student['Batch'],
                student['Phone'],
                student['Email'],
                student['Access Code']
            ].map(v => String(v ?? '').toLowerCase());

            return haystack.some(field => field.includes(query));
        });
    }

    currentPage = 1;
    displayStudents(currentPage);
}

searchInput.addEventListener('input', debounce(handleSearch, 250));

/* ============ Grid render ============ */

function updateResultsCount() {
    const total = studentsData.length;
    const found = filteredStudents.length;
    resultsCountEl.textContent = searchInput.value.trim()
        ? `Showing ${found.toLocaleString()} of ${total.toLocaleString()} students`
        : `${total.toLocaleString()} students total`;
}

function displayStudents(page) {
    currentPage = page;
    grid.innerHTML = '';
    updateResultsCount();

    if (filteredStudents.length === 0) {
        grid.innerHTML = '<p class="status-message">No student found matching your search!</p>';
        paginationEl.innerHTML = '';
        return;
    }

    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedStudents = filteredStudents.slice(start, end);

    const fragment = document.createDocumentFragment();

    paginatedStudents.forEach((student) => {
        const name = student['Student Name'] || 'Unknown';
        const id = getId(student);
        const photoUrl = student.photo || `profile_photos/${id}.jpg`;
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

        const card = document.createElement('div');
        card.className = 'card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `View details for ${name}`);
        card.onclick = () => openModal(student);
        card.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openModal(student);
            }
        };

        card.innerHTML = `
            <div class="card-photo-wrap">
                <img
                    src="${escapeHTML(photoUrl)}"
                    width="100"
                    height="100"
                    loading="lazy"
                    decoding="async"
                    fetchpriority="low"
                    alt="${escapeHTML(name)}"
                    onload="this.classList.add('loaded'); this.parentElement.classList.add('loaded');"
                    onerror="this.onerror=null; this.src='${fallbackUrl}';"
                >
            </div>
            <h3>${escapeHTML(name)}</h3>
            <p>ID: ${escapeHTML(id)}</p>
        `;

        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    renderPagination();
}

/* ============ Pagination ============ */

function renderPagination() {
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
    paginationEl.innerHTML = '';
    if (totalPages <= 1) return;

    paginationEl.appendChild(
        createBtn('‹ Prev', () => gotoPage(currentPage - 1), currentPage === 1, 'Previous page')
    );

    getPageRange(currentPage, totalPages).forEach(item => {
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
        createBtn('Next ›', () => gotoPage(currentPage + 1), currentPage === totalPages, 'Next page')
    );
}

function createBtn(text, onClick, disabled = false, label = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.disabled = disabled;
    btn.onclick = onClick;
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

/* ============ Modal ============ */

function openModal(student) {
    const name = student['Student Name'] || 'Unknown';
    const id = getId(student);
    const photoUrl = student.photo || `profile_photos/${id}.jpg`;
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    modalBody.innerHTML = `
        <img
            src="${escapeHTML(photoUrl)}"
            loading="lazy"
            decoding="async"
            alt="${escapeHTML(name)}"
            onerror="this.onerror=null; this.src='${fallbackUrl}';"
        >
        <h2 id="modal-name">${escapeHTML(name)}</h2>
        <p><strong>ID:</strong> ${displayValue(id)}</p>
        <p><strong>Email:</strong> ${displayValue(student['Email'])}</p>
        <p><strong>Phone:</strong> ${escapeHTML(formatPhone(student['Phone']))}</p>
        <p><strong>Batch:</strong> ${displayValue(student['Batch'])}</p>
        <p><strong>Institution:</strong> ${displayValue(student['Institution'])}</p>
        <p><strong>HSC Batch:</strong> ${displayValue(student['HscBatch'])}</p>
        <p><strong>Access Code:</strong> ${displayValue(student['Access Code'])}</p>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('modal').querySelector('.close-btn').focus();
}

function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Close on backdrop click
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Close on Escape key; close-btn already supports Enter/Space via role="button"
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
});
document.querySelector('.close-btn').addEventListener('keydown', (e) => {
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
        themeToggleBtn.setAttribute('aria-label', 'Switch to light mode');
        themeToggleBtn.setAttribute('aria-pressed', 'true');
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.textContent = '🌙';
        themeToggleBtn.setAttribute('aria-label', 'Switch to dark mode');
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

// Follow the OS theme unless the user has explicitly chosen one here
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
    }
});

initTheme();
