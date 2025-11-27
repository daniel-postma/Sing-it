let player;
let mode = "play";
let highlightIndex = -1;

let currentSong;
let lyrics = [];

const lyricsContainer = document.getElementById("lyrics");
const modeBtn = document.getElementById("modeBtn");
const loadBtn = document.getElementById("loadBtn");
const saveBtn = document.getElementById("saveBtn");
const fileInput = document.getElementById("fileInput");

const showKanji = document.getElementById("showKanji");
const showKana = document.getElementById("showKana");
const showRomaji = document.getElementById("showRomaji");
const showEnglish = document.getElementById("showEnglish");
const showVocab = document.getElementById("showVocab"); // ← NEW

function extractVideoId(urlOrId) {
  if (!urlOrId) return "";
  const match = urlOrId.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : urlOrId;
}

function onYouTubeIframeAPIReady() {
  const id = extractVideoId(
    currentSong?.videoUrl || currentSong?.videoId || "uP8CtPMAd5Q"
  );
  player = new YT.Player("player", {
    height: "360",
    width: "640",
    videoId: id,
    playerVars: { autoplay: 0 },
  });
}

// Load default song
fetch("mou_ichido.json")
  .then((response) => response.json())
  .then((json) => {
    currentSong = json;
    lyrics = json.lyrics;
    const id = extractVideoId(json.videoUrl || json.videoId);
    if (player) player.loadVideoById(id);
    renderLyrics();
    console.log(`✅ Loaded default song: ${json.title}`);
  })
  .catch((err) => console.error("❌ Failed to load default JSON:", err));

function renderLyrics() {
  lyricsContainer.innerHTML = "";
  lyrics.forEach((line, i) => {
    const div = document.createElement("div");
    div.className = "line";

    let content = [];

    // ORDER: Kanji → Kana → Romaji → English → Vocab
    if (showKanji.checked && line.kanji) {
      content.push(`<div class="kanji-line">${line.kanji}</div>`);
    }

    if (showKana.checked && line.kana) {
      content.push(`<div class="kana-line">${line.kana}</div>`);
    }

    if (showRomaji.checked && line.romaji) {
      content.push(`<div class="romaji-line">${line.romaji}</div>`);
    }

    if (showEnglish.checked && line.english) {
      content.push(`<div class="english-line">${line.english}</div>`);
    }

    // NEW: vocab line (short conceptual defs, precomputed in JSON)
    if (showVocab.checked && line.vocab) {
      content.push(`<div class="vocab-line">${line.vocab}</div>`);
    }

    const showTime =
      mode === "edit" && line.time !== null && line.time !== undefined;
    if (showTime) {
      content.push(
        `<div style="color:gray;font-size:12px;">(${line.time.toFixed(
          1
        )}s)</div>`
      );
    }

    // Fallback if nothing is toggled on
    if (content.length === 0) {
      const fallback =
        line.kanji || line.kana || line.romaji || line.english || "";
      content.push(`<div class="kanji-line">${fallback}</div>`);
    }

    div.innerHTML = content.join("");
    div.onclick = () => handleLineClick(i);
    lyricsContainer.appendChild(div);
  });

  if (currentSong?.title && currentSong?.artist) {
    document.querySelector(
      "h1"
    ).textContent = `🎵 ${currentSong.title} - ${currentSong.artist}`;
  }

  // Hide or show buttons depending on mode
  if (mode === "play") {
    loadBtn.style.display = "none";
    saveBtn.style.display = "none";
  } else {
    loadBtn.style.display = "inline-block";
    saveBtn.style.display = "inline-block";
  }
}

function handleLineClick(index) {
  if (!player) return;

  if (mode === "edit") {
    const t = player.getCurrentTime();
    lyrics[index].time = t;
    renderLyrics();
  } else if (mode === "play" && lyrics[index].time != null) {
    player.seekTo(lyrics[index].time, true);
    player.playVideo();
  }
}

modeBtn.onclick = () => {
  mode = mode === "edit" ? "play" : "edit";
  modeBtn.textContent = `Switch to ${mode === "edit" ? "Play" : "Edit"} Mode`;
  renderLyrics();
};

// Re-render when any visibility toggle changes
[showKanji, showKana, showRomaji, showEnglish, showVocab].forEach((cb) => {
  if (cb) cb.addEventListener("change", renderLyrics);
});

loadBtn.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();

  try {
    const json = JSON.parse(text);
    if (json.lyrics && Array.isArray(json.lyrics)) {
      currentSong = json;
      lyrics = json.lyrics;
      const id = extractVideoId(json.videoUrl || json.videoId);
      if (player) player.loadVideoById(id);
      renderLyrics();
      alert(`✅ Loaded song: ${json.title}`);
    } else {
      throw new Error("Invalid song structure");
    }
  } catch (err) {
    alert("❌ Failed to load song JSON: " + err.message);
  }
};

saveBtn.onclick = () => {
  const exportData = {
    title: currentSong.title,
    artist: currentSong.artist,
    videoId: currentSong.videoId,
    videoUrl: currentSong.videoUrl,
    lyrics: lyrics,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentSong.title.replace(/\s+/g, "_")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  alert("💾 Song exported successfully!");
};

setInterval(() => {
  if (mode !== "play" || !player?.getCurrentTime) return;
  const time = player.getCurrentTime();
  let idx = -1;

  for (let i = 0; i < lyrics.length; i++) {
    if (typeof lyrics[i].time === "number" && lyrics[i].time <= time) {
      idx = i;
    }
  }

  if (idx !== highlightIndex) {
    highlightIndex = idx;
    const lines = document.querySelectorAll(".line");
    lines.forEach((l, i) => l.classList.toggle("highlight", i === idx));

    if (idx >= 0) {
      const lineEl = lines[idx];
      const offset = Math.max(0, lineEl.offsetTop - 169);
      lyricsContainer.scrollTo({ top: offset, behavior: "smooth" });
    }
  }
}, 200);

renderLyrics();
