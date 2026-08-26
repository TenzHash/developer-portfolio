const db = window.supabaseClient;

let cachedProjects = [];
let existingMediaUrls = []; // Saved media URLs in DB for edit mode
let selectedFiles = []; // Staged new File objects

// DOM References
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginForm = document.getElementById("loginForm");
const projectForm = document.getElementById("projectForm");
const logoutBtn = document.getElementById("logoutBtn");
const projectList = document.getElementById("projectList");
const projectCount = document.getElementById("projectCount");
const submitProjectBtn = document.getElementById("submitProjectBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");

const projectIdInput = document.getElementById("projectId");
const categoryInput = document.getElementById("category");
const titleInput = document.getElementById("title");
const summaryInput = document.getElementById("summary");
const tagsInput = document.getElementById("tags");
const tagsLabel = document.getElementById("tagsLabel");
const demoUrlInput = document.getElementById("demoUrl");
const demoUrlLabel = document.getElementById("demoUrlLabel");
const githubUrlInput = document.getElementById("githubUrl");
const githubUrlLabel = document.getElementById("githubUrlLabel");
const fileInput = document.getElementById("mediaFiles");
const dropzoneText = document.getElementById("dropzoneText");
const mediaPreviewQueue = document.getElementById("mediaPreviewQueue");

// Helper: Video URL Checker
function isVideoUrl(url) {
  if (!url) return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  return (
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.endsWith(".mov") ||
    cleanUrl.endsWith(".m4v")
  );
}

// Helper: Normalize tags from any format (Array, string, Postgres literal)
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

// Category Schemas
const CATEGORY_SCHEMAS = {
  "Website & Web App Development": {
    tagsLabel: "Tech Stack (comma-separated)",
    tagsPlaceholder: "React, TypeScript, Supabase, Tailwind CSS, REST APIs",
    demoLabel: "Live Website / Demo URL",
    demoPlaceholder: "https://my-app.vercel.app",
    githubLabel: "Source Code / GitHub URL",
    githubPlaceholder: "https://github.com/username/repo",
  },
  "Virtual Assistance & Operations": {
    tagsLabel: "Skills, Tools & Deliverables",
    tagsPlaceholder:
      "Data Entry, Queue Processing, SOP Documentation, Google Sheets, Trello",
    demoLabel: "Live Workflow / Dashboard / Spreadsheet URL",
    demoPlaceholder: "https://docs.google.com/... or Notion link",
    githubLabel: "Case Study / Documentation URL",
    githubPlaceholder: "https://notion.so/... or Drive link",
  },
  "Graphic Design & Branding": {
    tagsLabel: "Creative Formats & Tools",
    tagsPlaceholder:
      "Canva Video, Adobe Photoshop, Figma, Logo Design, Social Ads",
    demoLabel: "Live Creative Preview / Video Link",
    demoPlaceholder: "https://drive.google.com/... or Behance/Vimeo link",
    githubLabel: "Asset Package / Portfolio Link",
    githubPlaceholder: "https://behance.net/... or Drive link",
  },
};

function updateDynamicFields(category) {
  const schema =
    CATEGORY_SCHEMAS[category] ||
    CATEGORY_SCHEMAS["Website & Web App Development"];
  tagsLabel.innerText = schema.tagsLabel;
  tagsInput.placeholder = schema.tagsPlaceholder;
  demoUrlLabel.innerText = schema.demoLabel;
  demoUrlInput.placeholder = schema.demoPlaceholder;
  githubUrlLabel.innerText = schema.githubLabel;
  githubUrlInput.placeholder = schema.githubPlaceholder;
}

categoryInput.addEventListener("change", (e) => {
  updateDynamicFields(e.target.value);
});

// File Selection Handler
fileInput.addEventListener("change", (e) => {
  const newFiles = Array.from(e.target.files);
  selectedFiles = [...selectedFiles, ...newFiles];
  fileInput.value = "";
  renderMediaQueue();
});

// Render Interactive Reorderable Media Grid
function renderMediaQueue() {
  if (existingMediaUrls.length === 0 && selectedFiles.length === 0) {
    mediaPreviewQueue.innerHTML = "";
    mediaPreviewQueue.style.display = "none";
    dropzoneText.innerText = "Click or drag images & MP4/WebM videos here";
    return;
  }

  mediaPreviewQueue.style.display = "flex";
  const totalCount = existingMediaUrls.length + selectedFiles.length;
  dropzoneText.innerText = `${totalCount} media asset(s) ready. First asset is used as cover preview.`;

  let html = `<div class="media-grid-label"><span>Media Order (First item is project cover):</span></div>`;
  html += `<div class="media-grid-container">`;

  // Render Existing Saved Media Cards
  existingMediaUrls.forEach((url, index) => {
    const isVid = isVideoUrl(url);
    const isFirst = index === 0;
    const isLast = index === existingMediaUrls.length - 1;

    html += `
      <div class="media-card-item ${isFirst ? "is-cover" : ""}">
        ${isFirst ? `<span class="cover-badge">COVER</span>` : ""}
        <div class="media-preview-box">
          ${
            isVid
              ? `<video src="${url}" muted preload="metadata"></video><span class="play-tag">▶ VIDEO</span>`
              : `<img src="${url}" alt="Media ${index + 1}" />`
          }
        </div>
        <div class="media-card-actions">
          <div class="reorder-btns">
            <button type="button" class="btn-shift" ${isFirst ? "disabled" : ""} onclick="shiftExistingMedia(${index}, -1)" title="Move Left">◀</button>
            <button type="button" class="btn-shift" ${isLast ? "disabled" : ""} onclick="shiftExistingMedia(${index}, 1)" title="Move Right">▶</button>
          </div>
          <button type="button" class="btn-delete-media" onclick="removeExistingMedia(${index})" title="Remove media">✕</button>
        </div>
      </div>
    `;
  });

  // Render Staged Newly Selected Files
  selectedFiles.forEach((file, index) => {
    const isVid = file.type.startsWith("video/");
    const previewUrl = URL.createObjectURL(file);
    const isFirst = index === 0 && existingMediaUrls.length === 0;
    const isLast = index === selectedFiles.length - 1;

    html += `
      <div class="media-card-item is-new ${isFirst ? "is-cover" : ""}">
        ${isFirst ? `<span class="cover-badge">COVER</span>` : ""}
        <span class="new-upload-tag">NEW</span>
        <div class="media-preview-box">
          ${
            isVid
              ? `<video src="${previewUrl}" muted preload="metadata"></video><span class="play-tag">▶ VIDEO</span>`
              : `<img src="${previewUrl}" alt="${file.name}" />`
          }
        </div>
        <div class="media-card-actions">
          <div class="reorder-btns">
            <button type="button" class="btn-shift" ${isFirst ? "disabled" : ""} onclick="shiftNewFile(${index}, -1)" title="Move Left">◀</button>
            <button type="button" class="btn-shift" ${isLast ? "disabled" : ""} onclick="shiftNewFile(${index}, 1)" title="Move Right">▶</button>
          </div>
          <button type="button" class="btn-delete-media" onclick="removeNewFile(${index})" title="Remove">✕</button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  mediaPreviewQueue.innerHTML = html;
}

window.shiftExistingMedia = function (index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= existingMediaUrls.length) return;

  const temp = existingMediaUrls[index];
  existingMediaUrls[index] = existingMediaUrls[targetIndex];
  existingMediaUrls[targetIndex] = temp;

  renderMediaQueue();
};

window.removeExistingMedia = function (index) {
  existingMediaUrls.splice(index, 1);
  renderMediaQueue();
};

window.shiftNewFile = function (index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= selectedFiles.length) return;

  const temp = selectedFiles[index];
  selectedFiles[index] = selectedFiles[targetIndex];
  selectedFiles[targetIndex] = temp;

  renderMediaQueue();
};

window.removeNewFile = function (index) {
  selectedFiles.splice(index, 1);
  renderMediaQueue();
};

// Auth Check
async function checkAuth() {
  const {
    data: { session },
    error,
  } = await db.auth.getSession();

  if (session && !error) {
    loginSection.style.display = "none";
    dashboardSection.style.display = "block";
    updateDynamicFields(categoryInput.value);
    loadAdminProjects();
  } else {
    loginSection.style.display = "block";
    dashboardSection.style.display = "none";
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const loginBtn = document.getElementById("loginBtn");

  loginBtn.disabled = true;
  loginBtn.innerText = "Signing In...";

  const { error } = await db.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.innerText = "Sign In";

  if (error) {
    alert("Authentication error: " + error.message);
  } else {
    loginForm.reset();
    checkAuth();
  }
});

logoutBtn.addEventListener("click", async () => {
  await db.auth.signOut();
  checkAuth();
});

// Load Projects
async function loadAdminProjects() {
  projectList.innerHTML =
    '<div class="loading-state">Fetching projects...</div>';

  const { data: projects, error } = await db
    .from("projects")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    projectList.innerHTML = `<div class="empty-state">Failed to load projects: ${error.message}</div>`;
    return;
  }

  cachedProjects = projects || [];
  renderProjectList();
}

function renderProjectList() {
  projectCount.innerText = cachedProjects.length;

  if (cachedProjects.length === 0) {
    projectList.innerHTML =
      '<div class="empty-state">No projects added yet. Publish one using the form.</div>';
    return;
  }

  projectList.innerHTML = cachedProjects
    .map((proj, index) => {
      const parsedTags = normalizeTags(proj.tags);
      const tagsHtml = parsedTags
        .map((tag) => `<span class="tag-pill">${tag}</span>`)
        .join("");
      const categoryHtml = proj.category
        ? `<span class="category-pill">${proj.category}</span>`
        : "";

      const primaryMedia =
        proj.media_urls && proj.media_urls.length > 0
          ? proj.media_urls[0]
          : proj.image_url;

      let thumbHtml = `<div class="project-thumb-placeholder">No Media</div>`;
      if (primaryMedia) {
        if (isVideoUrl(primaryMedia)) {
          thumbHtml = `<div class="project-thumb project-thumb-video"><span>▶ VIDEO</span></div>`;
        } else {
          thumbHtml = `<img src="${primaryMedia}" alt="${proj.title}" class="project-thumb" />`;
        }
      }

      const isFirst = index === 0;
      const isLast = index === cachedProjects.length - 1;

      return `
      <div class="project-item">
        <div class="order-controls">
          <button class="btn-order" ${isFirst ? "disabled" : ""} onclick="moveProject(${index}, 'up')" title="Move Up">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          <button class="btn-order" ${isLast ? "disabled" : ""} onclick="moveProject(${index}, 'down')" title="Move Down">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
        ${thumbHtml}
        <div class="project-info">
          <div class="project-heading-row">
            <h4>${proj.title}</h4>
            ${categoryHtml}
          </div>
          <div class="project-tags-row">${tagsHtml}</div>
        </div>
        <div class="project-item-actions">
          <button class="btn-action-icon" title="Edit Project" onclick="editProject('${proj.id}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="btn-action-icon btn-action-delete" title="Delete Project" onclick="deleteProject('${proj.id}', '${proj.image_url || ""}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

window.moveProject = async function (index, direction) {
  if (direction === "up" && index > 0) {
    [cachedProjects[index], cachedProjects[index - 1]] = [
      cachedProjects[index - 1],
      cachedProjects[index],
    ];
  } else if (direction === "down" && index < cachedProjects.length - 1) {
    [cachedProjects[index], cachedProjects[index + 1]] = [
      cachedProjects[index + 1],
      cachedProjects[index],
    ];
  } else {
    return;
  }

  renderProjectList();

  const updates = cachedProjects.map((proj, i) => {
    return db.from("projects").update({ display_order: i }).eq("id", proj.id);
  });

  try {
    await Promise.all(updates);
  } catch (err) {
    console.error("Order save failed: ", err);
    alert("Failed to save the new order. Refreshing list.");
    loadAdminProjects();
  }
};

// Edit Project (With Safe Tag Normalization)
window.editProject = function (id) {
  const project = cachedProjects.find((p) => p.id === id);
  if (!project) return;

  projectIdInput.value = project.id;
  categoryInput.value = project.category || "Website & Web App Development";
  updateDynamicFields(categoryInput.value);

  titleInput.value = project.title || "";
  summaryInput.value = project.summary || "";

  // Normalize tags so both legacy and newly formatted tags populate smoothly
  const parsedTags = normalizeTags(project.tags);
  tagsInput.value = parsedTags.join(", ");

  demoUrlInput.value = project.demo_url || "";
  githubUrlInput.value = project.github_url || "";

  existingMediaUrls =
    project.media_urls && project.media_urls.length > 0
      ? [...project.media_urls]
      : project.image_url
        ? [project.image_url]
        : [];

  selectedFiles = [];
  fileInput.value = "";
  renderMediaQueue();

  formTitle.innerText = "Edit Project";
  formSubtitle.innerText = `Editing "${project.title}"`;
  submitProjectBtn.innerText = "Update Project";
  cancelEditBtn.style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
};

function resetFormMode() {
  projectForm.reset();
  projectIdInput.value = "";
  existingMediaUrls = [];
  selectedFiles = [];
  fileInput.value = "";
  renderMediaQueue();

  categoryInput.value = "Website & Web App Development";
  updateDynamicFields("Website & Web App Development");

  formTitle.innerText = "Add New Project";
  formSubtitle.innerText =
    "Select a category to customize fields and upload media";
  submitProjectBtn.innerText = "Publish Project";
  cancelEditBtn.style.display = "none";
  dropzoneText.innerText = "Click or drag images & MP4/WebM videos here";
}

cancelEditBtn.addEventListener("click", resetFormMode);

// Form Submit (Save / Update)
projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const isEditing = Boolean(projectIdInput.value);
  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const summary = summaryInput.value.trim();
  const rawTags = tagsInput.value;
  const demo_url = demoUrlInput.value.trim();
  const github_url = githubUrlInput.value.trim();

  // Safely parse tags into a clean string array
  const tags = normalizeTags(rawTags);

  submitProjectBtn.disabled = true;
  submitProjectBtn.innerText = isEditing
    ? "Updating..."
    : "Uploading & Publishing...";

  const finalMediaUrls = [...existingMediaUrls];

  if (selectedFiles.length > 0) {
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { error: uploadError } = await db.storage
        .from("portfolio-media")
        .upload(fileName, file);

      if (uploadError) {
        alert(`Failed to upload ${file.name}: ` + uploadError.message);
        submitProjectBtn.disabled = false;
        submitProjectBtn.innerText = isEditing
          ? "Update Project"
          : "Publish Project";
        return;
      }

      const { data: publicUrlData } = db.storage
        .from("portfolio-media")
        .getPublicUrl(fileName);

      finalMediaUrls.push(publicUrlData.publicUrl);
    }
  }

  let nextDisplayOrder = 0;
  if (!isEditing && cachedProjects.length > 0) {
    const maxOrder = Math.max(
      ...cachedProjects.map((p) =>
        typeof p.display_order === "number" ? p.display_order : 0,
      ),
      0,
    );
    nextDisplayOrder = maxOrder + 1;
  }

  const payload = {
    title,
    category,
    summary,
    tags,
    demo_url,
    github_url,
    media_urls: finalMediaUrls,
    image_url: finalMediaUrls[0] || "",
    ...(isEditing ? {} : { display_order: nextDisplayOrder }),
  };

  let error;
  if (isEditing) {
    const res = await db
      .from("projects")
      .update(payload)
      .eq("id", projectIdInput.value);
    error = res.error;
  } else {
    const res = await db.from("projects").insert([payload]);
    error = res.error;
  }

  submitProjectBtn.disabled = false;

  if (error) {
    alert("Operation failed: " + error.message);
    submitProjectBtn.innerText = isEditing
      ? "Update Project"
      : "Publish Project";
  } else {
    resetFormMode();
    loadAdminProjects();
  }
});

// Delete Project
window.deleteProject = async function (id, imageUrl) {
  if (!confirm("Are you sure you want to permanently delete this project?"))
    return;

  const project = cachedProjects.find((p) => p.id === id);
  if (project && project.media_urls && project.media_urls.length > 0) {
    const fileNames = project.media_urls
      .map((url) => url.split("/").pop())
      .filter(Boolean);
    if (fileNames.length > 0) {
      await db.storage.from("portfolio-media").remove(fileNames);
    }
  } else if (imageUrl) {
    const fileName = imageUrl.split("/").pop();
    if (fileName) {
      await db.storage.from("portfolio-media").remove([fileName]);
    }
  }

  const { error } = await db.from("projects").delete().eq("id", id);

  if (error) {
    alert("Failed to delete: " + error.message);
  } else {
    if (projectIdInput.value === id) resetFormMode();
    loadAdminProjects();
  }
};

db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    checkAuth();
  }
});

checkAuth();
