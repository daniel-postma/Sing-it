let player;
let mode = "edit";
let highlightIndex = -1;
let language = "kanji";

let currentSong = {
  title: "もう一度 (Mou Ichido)",
  artist: "Tani Yuuki",
  videoId: "uP8CtPMAd5Q",
  videoUrl: "https://www.youtube.com/watch?v=uP8CtPMAd5Q",
  lyrics: [
    {
      kanji: "ねえ いつになれば君に会えるの？",
      romaji: "Nee itsu ni nareba kimi ni aeru no?",
      english: "Hey, when will I be able to see you again?",
      time: null,
    },
    {
      kanji: "ねえ いつになれば世界は戻るの？",
      romaji: "Nee itsu ni nareba sekai wa modoru no?",
      english: "Hey, when will the world return to normal?",
      time: null,
    },
    {
      kanji: "あとどれくらい続いてくのだろう？",
      romaji: "Ato dore kurai tsuzuiteku no darou?",
      english: "I wonder how much longer this will continue",
      time: null,
    },
  ],
};

let lyrics = currentSong.lyrics;

const lyricsContainer = document.getElementById("lyrics");
const modeBtn = document.getElementById("modeBtn");
const langSelect = document.getElementById("langSelect");
const loadBtn = document.getElementById("loadBtn");
const saveBtn = document.getElementById("saveBtn");
const fileInput = document.getElementById("fileInput");

// -------------------- YOUTUBE API --------------------
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "360",
    width: "640",
    videoId: currentSong.videoId,
  });
}

// -------------------- RENDER LYRICS --------------------
function renderLyrics() {
  lyricsContainer.innerHTML = "";
  lyrics.forEach((line, i) => {
    const div = document.createElement("div");
    div.className = "line";
    const showTime = mode === "edit" && line.time !== null;
    div.innerHTML =
      line[language] +
      (showTime
        ? ` <span style="color:gray">(${line.time.toFixed(1)}s)</span>`
        : "");
    div.onclick = () => handleLineClick(i);
    lyricsContainer.appendChild(div);
  });
  document.querySelector(
    "h1"
  ).textContent = `🎵 ${currentSong.title} - ${currentSong.artist}`;
}

// -------------------- CLICK HANDLER --------------------
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

// -------------------- MODE TOGGLE --------------------
modeBtn.onclick = () => {
  mode = mode === "edit" ? "play" : "edit";
  modeBtn.textContent = `Switch to ${mode === "edit" ? "Play" : "Edit"} Mode`;
  renderLyrics();
};

// -------------------- LANGUAGE SWITCH --------------------
langSelect.onchange = (e) => {
  language = e.target.value;
  renderLyrics();
};

// -------------------- LOAD SONG --------------------
loadBtn.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();

  try {
    const json = JSON.parse(text);

    // Handle structured song JSON
    if (json.lyrics && Array.isArray(json.lyrics)) {
      currentSong = json;
      lyrics = json.lyrics;

      if (player && json.videoId) {
        player.loadVideoById(json.videoId);
      }

      document.querySelector(
        "h1"
      ).textContent = `🎵 ${json.title} - ${json.artist}`;
      renderLyrics();
      alert(`✅ Loaded song: ${json.title}`);
    } else {
      throw new Error("Invalid song structure");
    }
  } catch (err) {
    alert("❌ Failed to load song JSON: " + err.message);
  }
};

// -------------------- EXPORT SONG --------------------
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

// -------------------- SYNC + SCROLL --------------------
setInterval(() => {
  if (mode !== "play" || !player?.getCurrentTime) return;
  const time = player.getCurrentTime();
  let idx = -1;

  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time && lyrics[i].time <= time) idx = i;
  }

  if (idx !== highlightIndex) {
    highlightIndex = idx;
    const lines = document.querySelectorAll(".line");
    lines.forEach((l, i) => l.classList.toggle("highlight", i === idx));

    if (idx >= 0) {
      const lineEl = lines[idx];
      const offset = lineEl.offsetTop - lyricsContainer.clientHeight / 3;
      lyricsContainer.scrollTo({ top: offset, behavior: "smooth" });
    }
  }
}, 200);

renderLyrics();
