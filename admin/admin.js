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


// ---- Social feed sync (calls the sync-social Edge Function) ----
const syncSocialBtn = document.getElementById("syncSocialBtn");
const syncStatus = document.getElementById("syncStatus");
const lastSyncMeta = document.getElementById("lastSyncMeta");

async function loadLastSync() {
  if (!lastSyncMeta) return;
  const { data } = await db
    .from("social_posts")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1);
  lastSyncMeta.innerText =
    data && data[0]
      ? "Last sync: " + new Date(data[0].synced_at).toLocaleString()
      : "Last sync: never";
}

if (syncSocialBtn) {
  syncSocialBtn.addEventListener("click", async () => {
    syncSocialBtn.disabled = true;
    syncStatus.innerText = "Syncing from Facebook & Instagram...";
    const { data, error } = await db.functions.invoke("sync-social");
    syncSocialBtn.disabled = false;
    if (error) {
      let detail = error.message;
      try {
        if (error.context && typeof error.context.json === "function") {
          const body = await error.context.json();
          detail = body.error || body.message || JSON.stringify(body);
        }
      } catch (_) {}
      syncStatus.innerText = "Sync failed: " + detail;
    } else {
      syncStatus.innerText = `Done. Facebook: ${data.facebook}, Instagram: ${data.instagram} posts updated.`;
      loadLastSync();
    }
  });
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") loadLastSync();
  });
  loadLastSync();
}


// ---- Choose which social posts show on the website ----
const socialPostsList = document.getElementById("socialPostsList");

function escPost(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function loadSocialPicker() {
  if (!socialPostsList) return;
  const { data, error } = await db
    .from("social_posts")
    .select("id, platform, caption, media_url, posted_at, is_hidden")
    .order("posted_at", { ascending: false })
    .limit(60);

  if (error) {
    socialPostsList.innerHTML = `<div class="sync-meta">Could not load posts: ${escPost(error.message)}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    socialPostsList.innerHTML = `<div class="sync-meta">No synced posts yet. Click "Sync now" first.</div>`;
    return;
  }

  socialPostsList.innerHTML = data
    .map((p) => {
      const date = p.posted_at ? new Date(p.posted_at).toLocaleDateString() : "";
      const thumb = p.media_url
        ? `<img src="${escPost(p.media_url)}" alt="" />`
        : `<div class="post-thumb-empty">No image</div>`;
      return `
      <label class="post-pick-row">
        ${thumb}
        <div class="post-pick-info">
          <div class="post-pick-top"><span class="post-pick-platform">${escPost(p.platform)}</span> <span class="sync-meta">${escPost(date)}</span></div>
          <div class="post-pick-caption">${escPost((p.caption || "(no caption)").slice(0, 110))}</div>
        </div>
        <input type="checkbox" data-id="${escPost(p.id)}" ${p.is_hidden ? "" : "checked"} />
      </label>`;
    })
    .join("");

  socialPostsList.querySelectorAll('input[type="checkbox"]').forEach((box) => {
    box.addEventListener("change", async () => {
      box.disabled = true;
      const { error: upErr } = await db
        .from("social_posts")
        .update({ is_hidden: !box.checked })
        .eq("id", box.getAttribute("data-id"));
      box.disabled = false;
      if (upErr) {
        box.checked = !box.checked; // revert on failure
        alert("Could not update: " + upErr.message);
      }
    });
  });
}

if (socialPostsList) {
  db.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") loadSocialPicker();
  });
  loadSocialPicker();
  // refresh the list after a sync finishes
  if (syncSocialBtn) syncSocialBtn.addEventListener("click", () => setTimeout(loadSocialPicker, 4000));
}


/* ==========================================================================
   Import projects from GitHub (public repos, no token needed)
   Fills the project form from: repo name, description, topics, homepage,
   languages and the README (first paragraph + first image).
   ========================================================================== */
const ghUsername = document.getElementById("ghUsername");
const ghLoadBtn = document.getElementById("ghLoadBtn");
const ghHideForks = document.getElementById("ghHideForks");
const ghStatus = document.getElementById("ghStatus");
const ghRepoList = document.getElementById("ghRepoList");
let ghRepos = [];

try {
  const saved = localStorage.getItem("gh_username");
  if (saved && ghUsername) ghUsername.value = saved;
} catch (_) {}

async function ghFetch(path, raw = false) {
  const res = await fetch("https://api.github.com" + path, {
    headers: { Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" },
  });
  if (res.status === 403 || res.status === 429) {
    throw new Error("GitHub rate limit reached (60 requests/hour without a token). Try again later.");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("GitHub error " + res.status);
  return raw ? res.text() : res.json();
}

function ghPrettyName(name) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function ghResolveUrl(url, owner, repo) {
  if (/^https?:\/\//i.test(url)) return url;
  const clean = url.replace(/^\.?\//, "");
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${clean}`;
}

// Pull a usable summary paragraph and first real screenshot out of a README
function ghParseReadme(md, owner, repo) {
  if (!md) return { paragraph: "", image: "" };

  let image = "";
  const imgRegex = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)|<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRegex.exec(md))) {
    const src = m[1] || m[2];
    if (!src) continue;
    if (/shields\.io|badge|\.svg(\?|$)|githubusercontent\.com\/.*\/badges|travis-ci|codecov/i.test(src)) continue;
    image = ghResolveUrl(src, owner, repo);
    break;
  }

  const blocks = md
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/);

  let paragraph = "";
  for (const raw of blocks) {
    const line = raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[*_`>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!line || line.startsWith("#") || line.startsWith("|") || /^[-=+\s]+$/.test(line)) continue;
    if (line.length < 40) continue;
    paragraph = line;
    break;
  }
  return { paragraph, image };
}

// Make "myapp.vercel.app" into "https://myapp.vercel.app"
function ghNormalizeUrl(u) {
  if (!u) return "";
  u = u.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u)) return "https://" + u;
  return "";
}

const GH_HOSTING = /(vercel\.app|netlify\.app|pages\.dev|github\.io|onrender\.com|herokuapp\.com|web\.app|firebaseapp\.com|surge\.sh|railway\.app|fly\.dev|streamlit\.app|vercel\.com\/?$|glitch\.me|replit\.app|codesandbox\.io|stackblitz\.com)/i;
const GH_IGNORE = /(github\.com|shields\.io|npmjs\.com|linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|discord|youtube\.com|youtu\.be|img\.|badge|raw\.githubusercontent)/i;

// Find the live demo: homepage field -> GitHub Pages -> links in the README
function ghFindDemoUrl(repo, readme) {
  const home = ghNormalizeUrl(repo.homepage);
  if (home) return home;

  if (repo.has_pages) {
    const owner = repo.owner.login;
    return repo.name.toLowerCase() === `${owner}.github.io`.toLowerCase()
      ? `https://${owner}.github.io/`
      : `https://${owner}.github.io/${repo.name}/`;
  }

  if (readme) {
    const links = [];
    const mdLink = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)[^)]*\)/g;
    let m;
    while ((m = mdLink.exec(readme))) links.push({ text: m[1], url: m[2] });
    const bare = /(?<![\(\"'])\bhttps?:\/\/[^\s)<>"']+/g;
    while ((m = bare.exec(readme))) links.push({ text: "", url: m[0] });

    const clean = links.filter((l) => !GH_IGNORE.test(l.url) || GH_HOSTING.test(l.url));
    const labeled = clean.find((l) => /demo|live|visit|website|view|preview|try/i.test(l.text) && !/github\.com/i.test(l.url) && !/!/.test(l.text));
    const hosted = clean.find((l) => GH_HOSTING.test(l.url));
    const pick = (labeled && GH_HOSTING.test(labeled.url) ? labeled : null) || hosted || labeled;
    if (pick) return pick.url.replace(/[.,;]+$/, "");
  }
  return "";
}

function fnErrorDetail(error) {
  return (async () => {
    try {
      if (error.context && typeof error.context.json === "function") {
        const body = await error.context.json();
        return body.error || body.message || JSON.stringify(body);
      }
    } catch (_) {}
    return error.message;
  })();
}

// Ask the capture-screenshot Edge Function for a stored screenshot of a live URL
async function captureLandingPage(url) {
  const { data, error } = await db.functions.invoke("capture-screenshot", { body: { url } });
  if (error) throw new Error(await fnErrorDetail(error));
  if (!data || !data.url) throw new Error("No screenshot returned.");
  return data.url;
}

function ghRenderList() {
  const existing = new Set(
    (typeof cachedProjects !== "undefined" ? cachedProjects : [])
      .map((p) => (p.github_url || "").toLowerCase().replace(/\/$/, "")),
  );
  const list = ghRepos.filter((r) => !(ghHideForks.checked && r.fork));
  if (list.length === 0) {
    ghRepoList.innerHTML = `<div class="sync-meta">No repositories to show.</div>`;
    return;
  }
  ghRepoList.innerHTML = list
    .map((r) => {
      const added = existing.has(r.html_url.toLowerCase());
      return `
      <div class="gh-repo-row">
        <div class="gh-repo-info">
          <div class="gh-repo-name">${escPost(r.name)} ${r.fork ? '<span class="gh-pill">fork</span>' : ""} ${added ? '<span class="gh-pill gh-pill-ok">added</span>' : ""}</div>
          <div class="gh-repo-desc">${escPost(r.description || "No description")}</div>
        </div>
        <button type="button" class="btn btn-primary gh-import-btn" data-repo="${escPost(r.name)}">Import</button>
      </div>`;
    })
    .join("");
}

async function ghLoadRepos() {
  const user = ghUsername.value.trim();
  if (!user) {
    ghStatus.innerText = "Enter your GitHub username first.";
    return;
  }
  try { localStorage.setItem("gh_username", user); } catch (_) {}
  ghLoadBtn.disabled = true;
  ghStatus.innerText = "Loading repositories...";
  ghRepoList.innerHTML = "";
  try {
    const repos = await ghFetch(`/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`);
    if (!repos) {
      ghStatus.innerText = "User not found.";
    } else {
      ghRepos = repos;
      ghStatus.innerText = `${repos.length} public repositories found.`;
      ghRenderList();
    }
  } catch (err) {
    ghStatus.innerText = err.message;
  }
  ghLoadBtn.disabled = false;
}

async function ghImportRepo(name, btn) {
  const repo = ghRepos.find((r) => r.name === name);
  if (!repo) return;
  btn.disabled = true;
  btn.innerText = "Importing...";
  ghStatus.innerText = `Reading ${name}...`;
  try {
    const owner = repo.owner.login;
    const [langs, readme] = await Promise.all([
      ghFetch(`/repos/${owner}/${name}/languages`),
      ghFetch(`/repos/${owner}/${name}/readme`, true),
    ]);
    const { paragraph, image } = ghParseReadme(readme, owner, name);

    // Summary: description first, then README paragraph if it adds something
    let summary = repo.description || "";
    if (paragraph && !summary.toLowerCase().includes(paragraph.slice(0, 40).toLowerCase())) {
      summary = summary ? `${summary.replace(/\.?$/, ".")} ${paragraph}` : paragraph;
    }
    if (summary.length > 300) summary = summary.slice(0, 297).replace(/\s+\S*$/, "") + "...";

    // Tags: topics first, then top languages
    const langNames = Object.keys(langs || {}).slice(0, 4);
    const topics = (repo.topics || []).map(ghPrettyName);
    const tags = [...new Set([...topics, ...langNames])].slice(0, 8);

    resetFormMode();
    categoryInput.value = "Website & Web App Development";
    updateDynamicFields(categoryInput.value);
    titleInput.value = ghPrettyName(repo.name);
    summaryInput.value = summary;
    tagsInput.value = tags.join(", ");
    const demoUrl = ghFindDemoUrl(repo, readme);
    demoUrlInput.value = demoUrl;
    githubUrlInput.value = repo.html_url;

    // Fallback cover image (README screenshot, else GitHub's preview card)
    const fallbackImage = image || `https://opengraph.githubassets.com/1/${owner}/${name}`;
    existingMediaUrls = [fallbackImage];
    renderMediaQueue();
    projectForm.scrollIntoView({ behavior: "smooth", block: "start" });

    if (demoUrl) {
      ghStatus.innerText = `Imported "${repo.name}". Taking a screenshot of ${demoUrl} ...`;
      try {
        const shot = await captureLandingPage(demoUrl);
        // Landing page screenshot becomes the cover; README image (if any) follows
        existingMediaUrls = image ? [shot, image] : [shot];
        renderMediaQueue();
        ghStatus.innerText = `Imported "${repo.name}" with a landing page screenshot. Review the form, then click Publish.`;
      } catch (shotErr) {
        ghStatus.innerText = `Imported "${repo.name}". Screenshot failed (${shotErr.message}), so a fallback image was used. Review, then click Publish.`;
      }
    } else {
      ghStatus.innerText = `Imported "${repo.name}". No live demo URL was found, so add one in the form if it has one. Then click Publish.`;
    }
    await runSuggestions();
  } catch (err) {
    ghStatus.innerText = err.message;
  }
  btn.disabled = false;
  btn.innerText = "Import";
}

if (ghLoadBtn) {
  ghLoadBtn.addEventListener("click", ghLoadRepos);
  ghUsername.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); ghLoadRepos(); }
  });
  ghHideForks.addEventListener("change", ghRenderList);
  ghRepoList.addEventListener("click", (e) => {
    const btn = e.target.closest(".gh-import-btn");
    if (btn) ghImportRepo(btn.getAttribute("data-repo"), btn);
  });
}


// ---- Manual "Capture landing page screenshot" button next to the Live URL field ----
const captureShotBtn = document.getElementById("captureShotBtn");
const shotStatus = document.getElementById("shotStatus");

if (captureShotBtn) {
  captureShotBtn.addEventListener("click", async () => {
    const url = ghNormalizeUrl(demoUrlInput.value);
    if (!url) {
      shotStatus.innerText = "Enter a Live URL first.";
      return;
    }
    demoUrlInput.value = url;
    captureShotBtn.disabled = true;
    shotStatus.innerText = "Capturing... this can take 10-20 seconds.";
    try {
      const shot = await captureLandingPage(url);
      existingMediaUrls = [shot, ...existingMediaUrls.filter((u) => u !== shot)];
      renderMediaQueue();
      shotStatus.innerText = "Added as the first image.";
    } catch (err) {
      shotStatus.innerText = "Failed: " + err.message;
    }
    captureShotBtn.disabled = false;
  });
}


/* ==========================================================================
   Suggestions: detect tech stack (live site + repo) and suggest title / tags / summary
   ========================================================================== */
const titleSuggest = document.getElementById("titleSuggest");
const tagsSuggest = document.getElementById("tagsSuggest");
const summarySuggest = document.getElementById("summarySuggest");
const suggestBtn = document.getElementById("suggestBtn");
const suggestStatus = document.getElementById("suggestStatus");

let suggestState = { titles: [], tags: [], summaries: [] };

const LOW_VALUE_TAGS = new Set(["Google Fonts", "Font Awesome"]);

// package.json dependency -> display name
const PKG_MAP = {
  next: "Next.js", nuxt: "Nuxt", gatsby: "Gatsby", astro: "Astro",
  react: "React", vue: "Vue", svelte: "Svelte", "@angular/core": "Angular",
  vite: "Vite", typescript: "TypeScript", tailwindcss: "Tailwind CSS",
  bootstrap: "Bootstrap", sass: "Sass", "@mui/material": "Material UI",
  "framer-motion": "Framer Motion", gsap: "GSAP", three: "Three.js",
  "@supabase/supabase-js": "Supabase", firebase: "Firebase",
  express: "Express", mongoose: "MongoDB", prisma: "Prisma",
  "@prisma/client": "Prisma", "socket.io": "Socket.IO", "chart.js": "Chart.js",
  recharts: "Recharts", "react-router-dom": "React Router", redux: "Redux",
  "@reduxjs/toolkit": "Redux Toolkit", zustand: "Zustand", axios: "Axios",
};

async function ghDetectStack(owner, repo) {
  const raw = await ghFetch(`/repos/${owner}/${repo}/contents/package.json`, true);
  if (!raw) return [];
  let pkg;
  try { pkg = JSON.parse(raw); } catch (_) { return []; }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const out = [];
  for (const [name, label] of Object.entries(PKG_MAP)) {
    if (deps[name] && !out.includes(label)) out.push(label);
  }
  return out;
}

async function analyzeSite(url) {
  const { data, error } = await db.functions.invoke("analyze-site", { body: { url } });
  if (error) throw new Error(await fnErrorDetail(error));
  return data;
}

function cleanTitle(t) {
  if (!t) return "";
  return t.split(/\s[|\-–—·:]\s/)[0].trim().slice(0, 60);
}

function buildSummaries(title, tech, site) {
  const out = [];
  const add = (text, kind) => {
    let s = (text || "").replace(/\s+/g, " ").trim();
    if (s.length < 20) return;
    if (s.length > 300) s = s.slice(0, 297).replace(/\s+\S*$/, "") + "...";
    if (!out.some((o) => o.text.toLowerCase() === s.toLowerCase())) out.push({ text: s, kind });
  };

  if (site) {
    add(site.description, "From your live site");
    add(site.paragraph, "From your live site");
    if (site.headline && site.headline.length > 25) add(site.headline, "From your live site");
  }

  const stack = tech.filter((t) => !["HTML", "CSS", "JavaScript"].includes(t) && !LOW_VALUE_TAGS.has(t)).slice(0, 3);
  const stackText = stack.length
    ? stack.join(", ").replace(/, ([^,]*)$/, " and $1")
    : "HTML, CSS and JavaScript";
  const name = title || "This project";
  add(`${name} is a website built with ${stackText}.`, "Template draft: edit to match");
  add(`Designed and developed ${name} using ${stackText}, focused on a clean layout and a smooth user experience.`, "Template draft: edit to match");
  return out;
}

function renderSuggestions() {
  if (!titleSuggest) return;
  const curTitle = titleInput.value.trim().toLowerCase();
  const curTags = normalizeTags(tagsInput.value).map((t) => t.toLowerCase());

  titleSuggest.innerHTML = suggestState.titles
    .filter((t) => t.toLowerCase() !== curTitle)
    .map((t, i) => `<button type="button" class="sg-chip" data-kind="title" data-value="${escPost(t)}">${escPost(t)}</button>`)
    .join("");

  tagsSuggest.innerHTML = suggestState.tags
    .map((t) => `<button type="button" class="sg-chip ${curTags.includes(t.toLowerCase()) ? "sg-on" : ""}" data-kind="tag" data-value="${escPost(t)}">${curTags.includes(t.toLowerCase()) ? "✓ " : "+ "}${escPost(t)}</button>`)
    .join("");

  summarySuggest.innerHTML = suggestState.summaries
    .map((s, i) => `<button type="button" class="sg-block" data-kind="summary" data-i="${i}"><span class="sg-kind">${escPost(s.kind)}</span>${escPost(s.text)}</button>`)
    .join("");
}

async function runSuggestions() {
  if (!suggestBtn) return;
  suggestBtn.disabled = true;
  suggestStatus.innerText = "Analyzing live site and repository...";

  const demo = ghNormalizeUrl(demoUrlInput.value);
  const m = (githubUrlInput.value || "").match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i);
  let site = null;
  let pkg = [];
  const notes = [];

  await Promise.all([
    (async () => {
      if (!demo) return;
      try { site = await analyzeSite(demo); }
      catch (e) { notes.push("Live site scan unavailable (" + e.message + ")"); }
    })(),
    (async () => {
      if (!m) return;
      try { pkg = await ghDetectStack(m[1], m[2].replace(/\.git$/, "")); }
      catch (e) { notes.push(e.message); }
    })(),
  ]);

  const existing = normalizeTags(tagsInput.value);
  const detected = [...pkg, ...((site && site.tech) || [])];
  const candidates = [...new Set([...detected, ...existing])];

  // Add detected tags (skipping low-value ones) without removing what's already there
  const toAdd = detected.filter((t) => !LOW_VALUE_TAGS.has(t));
  const merged = [...existing];
  for (const t of toAdd) {
    if (!merged.some((x) => x.toLowerCase() === t.toLowerCase())) merged.push(t);
  }
  tagsInput.value = merged.slice(0, 10).join(", ");

  const siteTitle = cleanTitle(site && site.title);
  const titles = [siteTitle, site && site.headline && site.headline.length <= 60 ? site.headline : ""].filter(Boolean);
  suggestState = {
    titles: [...new Set(titles)],
    tags: candidates,
    summaries: buildSummaries(titleInput.value.trim() || siteTitle, merged, site),
  };

  // Fill the summary only if it's empty (never overwrite your own text)
  if (!summaryInput.value.trim() && suggestState.summaries.length) {
    summaryInput.value = suggestState.summaries[0].text;
  }

  renderSuggestions();
  const found = detected.filter((t) => !LOW_VALUE_TAGS.has(t));
  suggestStatus.innerText =
    (found.length ? `Detected: ${found.join(", ")}. ` : "No extra technologies detected. ") +
    (notes.length ? notes.join(" ") : "Tap the chips to adjust.");
  suggestBtn.disabled = false;
}

if (suggestBtn) {
  suggestBtn.addEventListener("click", runSuggestions);
  tagsInput.addEventListener("input", renderSuggestions);
  titleInput.addEventListener("input", renderSuggestions);

  const handleChip = (e) => {
    const el = e.target.closest("[data-kind]");
    if (!el) return;
    const kind = el.getAttribute("data-kind");
    if (kind === "title") {
      titleInput.value = el.getAttribute("data-value");
    } else if (kind === "tag") {
      const value = el.getAttribute("data-value");
      const cur = normalizeTags(tagsInput.value);
      const idx = cur.findIndex((x) => x.toLowerCase() === value.toLowerCase());
      if (idx >= 0) cur.splice(idx, 1); else cur.push(value);
      tagsInput.value = cur.join(", ");
    } else if (kind === "summary") {
      const s = suggestState.summaries[Number(el.getAttribute("data-i"))];
      if (s) summaryInput.value = s.text;
    }
    renderSuggestions();
  };
  [titleSuggest, tagsSuggest, summarySuggest].forEach((c) => c.addEventListener("click", handleChip));
}
