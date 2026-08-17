/* ============================================================
   ✏️  SITE TEXT SETTINGS — edit anything you see below
   ============================================================
   This is the ONLY file you need to open to change any word,
   label, or message on the website. You do not need to touch
   index.html, style.css, or script.js.

   HOW TO EDIT:
   1. Find the line with the text you want to change.
   2. Type your new text between the "quote marks".
   3. Save the file and refresh the page in your browser.
   4. Do NOT delete the quote marks, commas, or colons — only
      change the text that is INSIDE the quote marks.

   Want to change COLORS instead of text? Open style.css and
   look at the top of the file for a section marked
   "🎨 EDIT COLORS HERE".
   ============================================================ */

const SITE_CONFIG = {

  // Browser tab title (shown at the top of the browser tab)
  pageTitle: "Student Profiles",

  // Big heading at the top of the page
  heroHeading: "Student Profiles",

  // The search box's placeholder text (shown before typing)
  searchPlaceholder: "Search by Name, ID, Institution, Phone, Batch...",

  // Button that switches between light and dark mode
  themeToggleLightLabel: "Switch to dark mode",
  themeToggleDarkLabel: "Switch to light mode",

  // Messages shown while the page is working
  loadingText: "Loading students…",
  errorText: "Could not load student data. Please check your connection and try again.",
  retryButtonText: "Retry",
  noResultsText: "No student found matching your search!",

  // Text above the student grid, e.g. "1,234 students total"
  resultsCountAllText: (total) => `${total.toLocaleString()} students total`,
  resultsCountFilteredText: (found, total) =>
    `Showing ${found.toLocaleString()} of ${total.toLocaleString()} students`,

  // Labels used inside each student's detail popup (modal)
  labels: {
    id: "ID",
    email: "Email",
    phone: "Phone No.",
    institution: "Institution",
    hscBatch: "HSC Batch",
    transactionId: "Access Code",
  },

  // Shown when a field has no value
  emptyValueText: "N/A",

  // Copy-to-clipboard button
  copyButtonLabel: "Copy",
  copiedButtonLabel: "Copied!",
  copyAriaLabel: (fieldName) => `Copy ${fieldName}`,

  // Pagination buttons
  prevPageLabel: "‹ Prev",
  nextPageLabel: "Next ›",

  // Close button in the popup
  closeButtonAriaLabel: "Close",
};
