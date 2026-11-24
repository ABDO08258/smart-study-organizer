// ===== ١. فتح قاعدة البيانات =====
let db;

const request = indexedDB.open("StudyOrganizerDB", 1);

request.onupgradeneeded = function (event) {
  db = event.target.result;
  db.createObjectStore("subjects", { keyPath: "id", autoIncrement: true });
  db.createObjectStore("tasks", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = function (event) {
  db = event.target.result;
  loadSubjects();
  loadTasks();
};

request.onerror = function () {
  alert("تعذر فتح قاعدة البيانات");
};

// ===== ٢. إضافة مادة =====
document.getElementById("subject-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const nameInput = document.getElementById("subject-name");

  const tx = db.transaction("subjects", "readwrite");
  tx.objectStore("subjects").add({ name: nameInput.value.trim() });

  tx.oncomplete = function () {
    nameInput.value = "";
    loadSubjects();
  };
});

// ===== ٣. عرض المواد في قائمة الاختيار =====
function loadSubjects() {
  const tx = db.transaction("subjects", "readonly");
  const req = tx.objectStore("subjects").getAll();

  req.onsuccess = function () {
    const select = document.getElementById("task-subject");
    select.innerHTML = '<option value="">اختر المادة</option>';

    req.result.forEach(function (subject) {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      select.appendChild(option);
    });
  };
}

// ===== ٤. إضافة مهمة =====
document.getElementById("task-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const select = document.getElementById("task-subject");

  // طلب إذن إشعارات المتصفح (اختياري)
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  const task = {
    title: document.getElementById("task-title").value.trim(),
    subject: select.options[select.selectedIndex].text,
    date: document.getElementById("task-date").value,
    time: document.getElementById("task-time").value,
    remind: document.getElementById("task-remind").value,
    priority: document.getElementById("task-priority").value,
    done: false,
    alerted: false
  };

  const tx = db.transaction("tasks", "readwrite");
  tx.objectStore("tasks").add(task);

  tx.oncomplete = function () {
    document.getElementById("task-form").reset();
    loadTasks();
  };
});

// ===== ٥. عرض المهام (مرتبة وملونة) =====
function loadTasks() {
  const tx = db.transaction("tasks", "readonly");
  const req = tx.objectStore("tasks").getAll();

  req.onsuccess = function () {
    const tasks = req.result;
    const list = document.getElementById("tasks-list");
    list.innerHTML = "";

    updateProgress(tasks);

    if (tasks.length === 0) {
      list.innerHTML = "<p>لا توجد مهام بعد.</p>";
      return;
    }

    // ترتيب: غير المنجزة أولاً، ثم حسب أقرب موعد
    tasks.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.date.localeCompare(b.date);
    });

    const todayStr = new Date().toLocaleDateString("en-CA");

    tasks.forEach(function (task) {
      const daysLeft = Math.round(
        (new Date(task.date) - new Date(todayStr)) / 86400000
      );

      let className = "task";
      if (task.done) {
        className += " done";
      } else if (daysLeft < 0) {
        className += " late";
      } else if (daysLeft <= 2) {
        className += " soon";
      }

      const div = document.createElement("div");
      div.className = className;

      const info = document.createElement("div");
      info.textContent =
        task.title + " | " + task.subject + " | " + task.date + (task.time ? " " + task.time : "") + " | " + task.priority;

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const doneBtn = document.createElement("button");
      doneBtn.textContent = task.done ? "إلغاء الإنجاز" : "تم";
      doneBtn.onclick = function () {
        toggleTask(task.id);
      };

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "حذف";
      deleteBtn.className = "delete-btn";
      deleteBtn.onclick = function () {
        deleteTask(task.id);
      };

      actions.appendChild(doneBtn);
      actions.appendChild(deleteBtn);
      div.appendChild(info);
      div.appendChild(actions);
      list.appendChild(div);
    });
  };
}

// ===== ٦. تعديل حالة المهمة =====
function toggleTask(id) {
  const tx = db.transaction("tasks", "readwrite");
  const store = tx.objectStore("tasks");
  const req = store.get(id);

  req.onsuccess = function () {
    const task = req.result;
    task.done = !task.done;
    store.put(task);
  };

  tx.oncomplete = function () {
    loadTasks();
  };
}

// ===== ٧. حذف مهمة =====
function deleteTask(id) {
  const tx = db.transaction("tasks", "readwrite");
  tx.objectStore("tasks").delete(id);

  tx.oncomplete = function () {
    loadTasks();
  };
}

// ===== ٨. نسبة الإنجاز لكل مادة =====
function updateProgress(tasks) {
  const box = document.getElementById("progress");
  box.innerHTML = "";

  if (tasks.length === 0) {
    box.innerHTML = "<p>أضف مهاماً لتظهر النسبة.</p>";
    return;
  }

  const stats = {};
  tasks.forEach(function (task) {
    if (!stats[task.subject]) {
      stats[task.subject] = { total: 0, done: 0 };
    }
    stats[task.subject].total++;
    if (task.done) stats[task.subject].done++;
  });

  Object.keys(stats).forEach(function (subject) {
    const s = stats[subject];
    const percent = Math.round((s.done / s.total) * 100);

    const item = document.createElement("div");
    item.className = "progress-item";

    const label = document.createElement("div");
    label.textContent = subject + ": " + percent + "% (" + s.done + " من " + s.total + ")";

    const bar = document.createElement("div");
    bar.className = "progress-bar";

    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = percent + "%";

    bar.appendChild(fill);
    item.appendChild(label);
    item.appendChild(bar);
    box.appendChild(item);
  });
}

// ===== ٩. المنبه =====
function checkReminders() {
  if (!db) return;

  const tx = db.transaction("tasks", "readwrite");
  const store = tx.objectStore("tasks");
  const req = store.getAll();

  req.onsuccess = function () {
    const now = new Date();

    req.result.forEach(function (task) {
      if (task.done || task.alerted || !task.time) return;

      const due = new Date(task.date + "T" + task.time);
      const minutesLeft = (due - now) / 60000;

      if (minutesLeft <= Number(task.remind)) {
        task.alerted = true;
        store.put(task);
        showAlarm(task, minutesLeft);
      }
    });
  };
}

function showAlarm(task, minutesLeft) {
  let msg;
  if (minutesLeft <= 0) {
    msg = "⏰ انتهى موعد المهمة: " + task.title;
  } else {
    const left = Math.ceil(minutesLeft);
    const text = left >= 60 ? Math.round(left / 60) + " ساعة" : left + " دقيقة";
    msg = "⏰ اقترب موعد المهمة: " + task.title + " (باقي " + text + ")";
  }

  const box = document.getElementById("alert-box");
  const div = document.createElement("div");
  div.className = "alert";

  const span = document.createElement("span");
  span.textContent = msg;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "إغلاق";
  closeBtn.onclick = function () {
    div.remove();
  };

  div.appendChild(span);
  div.appendChild(closeBtn);
  box.appendChild(div);

  playBeep();

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("منبه الدراسة", { body: msg });
  }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.2);
    }
  } catch (err) {
    console.log("تعذر تشغيل الصوت");
  }
}

setTimeout(checkReminders, 1500);
setInterval(checkReminders, 30000);

// ===== ١٠. تصدير البيانات (لبرنامج بايثون) =====
function getAllTasks() {
  return new Promise(function (resolve, reject) {
    const req = db.transaction("tasks", "readonly").objectStore("tasks").getAll();
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

document.getElementById("exportBtn").addEventListener("click", async () => {
  const tasks = await getAllTasks();
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tasks.json";
  a.click();
});

// ===== ١١. مؤقت بومودورو =====
const STUDY_MIN = 25, BREAK_MIN = 5;
let pomoSeconds = STUDY_MIN * 60;
let pomoIsStudy = true;
let pomoInterval = null;

function pomoRender() {
  const m = String(Math.floor(pomoSeconds / 60)).padStart(2, "0");
  const s = String(pomoSeconds % 60).padStart(2, "0");
  document.getElementById("pomoTime").textContent = m + ":" + s;
  document.getElementById("pomoMode").textContent = pomoIsStudy ? "وقت المذاكرة" : "وقت الراحة";
}

function pomoBeep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.frequency.value = 880;
  osc.start();
  osc.stop(ctx.currentTime + 0.6);
}

function pomoTick() {
  pomoSeconds--;
  if (pomoSeconds <= 0) {
    pomoBeep();
    pomoIsStudy = !pomoIsStudy;
    pomoSeconds = (pomoIsStudy ? STUDY_MIN : BREAK_MIN) * 60;
  }
  pomoRender();
}

document.getElementById("pomoStart").addEventListener("click", () => {
  if (!pomoInterval) pomoInterval = setInterval(pomoTick, 1000);
});
document.getElementById("pomoPause").addEventListener("click", () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
});
document.getElementById("pomoReset").addEventListener("click", () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
  pomoIsStudy = true;
  pomoSeconds = STUDY_MIN * 60;
  pomoRender();
});
pomoRender();

// ===== ١٢. البحث والفلترة =====
const TASK_SELECTOR = ".task";
const DONE_CLASS = "done";
const LATE_CLASS = "late";
const TASK_LIST_SELECTOR = "#tasks-list";

let currentFilter = "all";

function applyFilter() {
  const text = document.getElementById("searchBox").value.trim().toLowerCase();
  document.querySelectorAll(TASK_SELECTOR).forEach(task => {
    const matchText = task.firstElementChild.textContent.toLowerCase().includes(text);
    let matchStatus = true;
    if (currentFilter === "done") matchStatus = task.classList.contains(DONE_CLASS);
    if (currentFilter === "late") matchStatus = task.classList.contains(LATE_CLASS);
    task.style.display = (matchText && matchStatus) ? "" : "none";
  });
}

document.getElementById("searchBox").addEventListener("input", applyFilter);
document.querySelectorAll(".filterBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    applyFilter();
  });
});

const taskListEl = document.querySelector(TASK_LIST_SELECTOR);
if (taskListEl) {
  new MutationObserver(applyFilter).observe(taskListEl, { childList: true });
}
