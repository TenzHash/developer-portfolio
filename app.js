const db = window.supabaseClient;
const projectGrid = document.getElementById("projectGrid");
const filterBtns = document.querySelectorAll(".filter-btn");

const projectModal = document.getElementById("projectModal");
const modalMedia = document.getElementById("modalMedia");
const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalTags = document.getElementById("modalTags");
const modalSummary = document.getElementById("modalSummary");
const modalActions = document.getElementById("modalActions");

// Mobile Navigation Drawer Toggle
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const navLinks = document.getElementById("navLinks");

if (mobileMenuBtn && navLinks) {
  mobileMenuBtn.addEventListener("click", () => {
    mobileMenuBtn.classList.toggle("open");
    navLinks.classList.toggle("open");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenuBtn.classList.remove("open");
      navLinks.classList.remove("open");
    });
  });
}

let allProjects = [];
let activeFilter = "all";

// Helper: Video URL Checker
function isVideoUrl(url) {
  if (!url) return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  return (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v") ||
    cleanUrl.endsWith(".ogg")
  );
}

// Helper: Normalize tags from any storage format (Array, string, Postgres literal)
function normalizeTags(rawTags) {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) {
    return rawTags.map((t) => String(t).trim()).filter(Boolean);
  }

  let str = String(rawTags).trim();
  if (str.startsWith("{") && str.endsWith("}")) {
    str = str.slice(1, -1);
  }

  return str
    .split(",")
    .map((t) => t.replace(/["']/g, "").trim())
    .filter(Boolean);
}

// 1. Fetch & Load Projects (Ordered by custom display_order)
async function loadPublicProjects() {
  const { data: projects, error } = await db
    .from("projects")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    projectGrid.innerHTML = `
      <div class="state-message">
        Unable to load projects right now. Please try again later.
      </div>
    `;
    return;
  }

  allProjects = projects || [];
  renderFilteredProjects();
}

function getButtonLabels(category) {
  switch (category) {
    case "Virtual Assistance & Operations":
      return { primary: "View Workflow / Sheet ↗", secondary: "Documentation" };
    case "Graphic Design & Branding":
      return {
        primary: "View Creatives / Video ↗",
        secondary: "Asset Package",
      };
    default:
      return { primary: "Live Website ↗", secondary: "Source Code" };
  }
}

// 2. Render Project Cards on Grid
function renderFilteredProjects() {
  const filtered =
    activeFilter === "all"
      ? allProjects
      : allProjects.filter((p) => p.category === activeFilter);

  if (filtered.length === 0) {
    projectGrid.innerHTML = `
      <div class="state-message">
        No projects found under "${activeFilter}".
      </div>
    `;
    return;
  }

  projectGrid.innerHTML = filtered
    .map((proj) => {
      const mediaList =
        proj.media_urls && proj.media_urls.length > 0
          ? proj.media_urls
          : proj.image_url
            ? [proj.image_url]
            : [];

      const firstMedia = mediaList[0];
      let coverElement = "";

      if (firstMedia) {
        const isVid = isVideoUrl(firstMedia);
        coverElement = `
        <div class="project-cover-wrapper">
          ${
            isVid
              ? `<video src="${firstMedia}" class="project-cover video-cover" muted loop playsinline autoplay preload="metadata"></video>`
              : `<img src="${firstMedia}" alt="${proj.title}" class="project-cover" loading="lazy" />`
          }
          <div class="project-cover-overlay">
            <span class="project-view-badge">
              ${mediaList.length > 1 ? `View Gallery (${mediaList.length} Items)` : "View Details"}
            </span>
          </div>
          ${mediaList.length > 1 ? `<span class="media-count-indicator">${mediaList.length} Media</span>` : ""}
        </div>
      `;
      }

      const categoryBadge = proj.category
        ? `<span class="project-cat-badge">${proj.category}</span>`
        : "";

      const parsedTags = normalizeTags(proj.tags);
      const tagsElement =
        parsedTags && parsedTags.length > 0
          ? `<div class="project-tags">${parsedTags
              .slice(0, 4)
              .map((tag) => `<span class="tag-badge">${tag}</span>`)
              .join(
                "",
              )}${parsedTags.length > 4 ? `<span class="tag-badge">+${parsedTags.length - 4}</span>` : ""}</div>`
          : "";

      return `
      <article class="project-card reveal" onclick="openProjectModal('${proj.id}')">
        ${coverElement}
        <div class="project-body">
          <div class="project-top-row">
            ${categoryBadge}
          </div>
          <h3 class="project-card-title">${proj.title}</h3>
          ${tagsElement}
          <div class="project-card-footer">
            <span class="btn-card-details">
              Read Details & View Media
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </span>
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  initScrollReveal();
}

// 3. Multi-Media Modal Viewer
window.openProjectModal = function (projectId) {
  const project = allProjects.find((p) => p.id === projectId);
  if (!project) return;

  const mediaList =
    project.media_urls && project.media_urls.length > 0
      ? project.media_urls
      : project.image_url
        ? [project.image_url]
        : [];

  if (mediaList.length > 0) {
    let viewerHtml = `
      <div class="modal-primary-view" id="modalPrimaryView">
        ${renderMediaElement(mediaList[0])}
      </div>
    `;

    // Multi-item thumbnail strip
    if (mediaList.length > 1) {
      viewerHtml += `<div class="modal-thumb-strip">`;
      mediaList.forEach((url, i) => {
        const isVid = isVideoUrl(url);
        viewerHtml += `
          <button type="button" class="modal-thumb-btn ${i === 0 ? "active" : ""}" onclick="switchModalMedia('${url}', this)">
            ${isVid ? `<div class="thumb-video-indicator">▶ Video ${i + 1}</div>` : `<img src="${url}" alt="Thumbnail ${i + 1}" />`}
          </button>
        `;
      });
      viewerHtml += `</div>`;
    }

    modalMedia.innerHTML = viewerHtml;
    modalMedia.style.display = "block";
  } else {
    modalMedia.innerHTML = "";
    modalMedia.style.display = "none";
  }

  modalCategory.innerText = project.category || "Featured Project";
  modalTitle.innerText = project.title || "";
  modalSummary.innerText =
    project.summary || "No detailed description available.";

  const parsedTags = normalizeTags(project.tags);
  if (parsedTags && parsedTags.length > 0) {
    modalTags.innerHTML = parsedTags
      .map((t) => `<span class="tag-badge">${t}</span>`)
      .join("");
    modalTags.style.display = "flex";
  } else {
    modalTags.style.display = "none";
  }

  const { primary: primaryLabel, secondary: secondaryLabel } = getButtonLabels(
    project.category,
  );
  const demoBtn = project.demo_url
    ? `<a href="${project.demo_url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">${primaryLabel}</a>`
    : "";
  const githubBtn = project.github_url
    ? `<a href="${project.github_url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">${secondaryLabel}</a>`
    : "";

  modalActions.innerHTML = `${demoBtn} ${githubBtn}`;

  projectModal.classList.add("active");
  projectModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

function renderMediaElement(url) {
  if (isVideoUrl(url)) {
    return `
      <div class="video-container">
        <video src="${url}" class="modal-video" controls autoplay muted playsinline></video>
      </div>
    `;
  }
  return `
    <div class="image-container">
      <img src="${url}" alt="Project preview" class="modal-image" />
    </div>
  `;
}

window.switchModalMedia = function (url, buttonEl) {
  const currentVideo = modalMedia.querySelector("video");
  if (currentVideo) currentVideo.pause();

  document
    .querySelectorAll(".modal-thumb-btn")
    .forEach((btn) => btn.classList.remove("active"));
  buttonEl.classList.add("active");
  document.getElementById("modalPrimaryView").innerHTML =
    renderMediaElement(url);
};

window.closeProjectModal = function () {
  projectModal.classList.remove("active");
  projectModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  const video = modalMedia.querySelector("video");
  if (video) video.pause();
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && projectModal.classList.contains("active")) {
    closeProjectModal();
  }
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.getAttribute("data-filter");
    renderFilteredProjects();
  });
});

function initScrollReveal() {
  const revealElements = document.querySelectorAll(
    ".reveal, .content-section, .value-card, .service-card, .timeline-item, .stat-item",
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -30px 0px",
    },
  );

  revealElements.forEach((el) => {
    el.classList.add("reveal");
    observer.observe(el);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  loadPublicProjects();
});
