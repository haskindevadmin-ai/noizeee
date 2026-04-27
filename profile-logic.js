import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (ЗЕРКАЛО APP.JS) ---
let libr = []; 
let allLyrics = {}; 
let currentTrackIndex = -1;
let lastActiveIndex = -1;

const audio = document.getElementById('audio');
const pausebtn = document.getElementById('pausebtn');
const profileTracksContainer = document.getElementById('profile-tracks');
const template = document.getElementById('track-template');
const fullBar = document.getElementById('full-progress-bar');
const fullDot = document.getElementById('full-progress-dot');

// --- 1. АВТОРИЗАЦИЯ И ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ ---
onAuthStateChanged(auth, async (user) => {
    const nameElement = document.getElementById('username');
    const avatarElement = document.getElementById('avatar');

    if (user) {
        // Ник из почты
        if (nameElement) nameElement.innerText = user.email.split('@')[0];

        // Аватарка из Firestore
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.avatar && avatarElement) {
                    avatarElement.src = data.avatar;
                }
                
                // Загружаем контент на основе лайков пользователя
                await loadMusicForProfile(data);
            } else {
                // Если документа юзера нет, просто грузим музыку (пустой список)
                await loadMusicForProfile({});
            }
        } catch (e) {
            console.error("Ошибка загрузки данных профиля:", e);
        }
    } else {
        window.location.href = 'index.html';
    }
});

// --- 2. ЗАГРУЗКА МУЗЫКИ (ТЕПЕРЬ ИЗ МАССИВА likedTracks) ---
async function loadMusicForProfile(userData) {
    try {
        // 1. Получаем ID треков из массива likedTracks
        // Если массива нет или он пуст, используем пустой список
        const likedIds = userData.likedTraks || []; 

        // 2. Получаем все треки из коллекции "tracks"
        const querySnapshot = await getDocs(collection(db, "tracks"));
        libr = [];
        
        querySnapshot.forEach((doc) => {
            const track = doc.data();
            // Проверяем, есть ли ID текущего трека в нашем массиве лайков
            // Используем Number(), если в массиве или в базе хранятся числа
            if (likedIds.includes(Number(track.id)) || likedIds.includes(String(track.id))) {
                libr.push({
                    id: track.id,
                    title: track.title,
                    artist: track.artist,
                    coverSrc: track.coverSrc || "covers/plcover.jpg",
                    audioSrc: track.audioSrc
                });
            }
        });

        console.log("Понравившиеся треки найдены:", libr);
        renderLikedTracks();

    } catch (err) {
        console.error("Ошибка загрузки музыки из профиля:", err);
    }
    
    // Загрузка лирики (оставляем как было)
    try {
      const githubLyricsUrl = 'https://raw.githubusercontent.com/haskindevadmin-ai/other/main/lyrics.json';
      const lyrResponse = await fetch(githubLyricsUrl);
      if (lyrResponse.ok) {
        allLyrics = await lyrResponse.json();
        console.log("✅ Тексты песен синхронизированы");
      }
    } catch (lyrErr) {
      console.error("❌ Ошибка загрузки текстов:", lyrErr);
      allLyrics = {};
    }
}

// --- 3. ОТРИСОВКА ЧЕРЕЗ ШАБЛОН ---
// --- 3. ОТРИСОВКА ЧЕРЕЗ ШАБЛОН ---
function renderLikedTracks() {
    if (!profileTracksContainer || !template) return;
    
    // Находим родительский контейнер, который нужно скрыть целиком
    // Если у тебя нет ID у всей секции, добавь его в HTML (например, id="liked-section")
    const likedSection = document.getElementById('liked-section');
    
    // Если лайков 0 — скрываем всю секцию и выходим из функции
    if (libr.length === 0) {
        if (likedSection) likedSection.style.display = 'none';
        return;
    } else {
        // Если треки есть — показываем секцию обратно
        if (likedSection) likedSection.style.display = 'block';
    }
    
    profileTracksContainer.innerHTML = '';
    const fullListContainer = document.getElementById('full-tracks-list'); 
    if (fullListContainer) fullListContainer.innerHTML = '';

    libr.forEach((track, index) => {
        // Создаем клон для основного экрана (только первые 5)
        if (index < 5) {
            const mainClone = createTrackElement(track, index);
            profileTracksContainer.appendChild(mainClone);
        }

        // Создаем клон для полноэкранного блока (все треки)
        if (fullListContainer) {
            const fullClone = createTrackElement(track, index);
            fullListContainer.appendChild(fullClone);
        }
        
        getDuration(track.audioSrc, `dur-${track.id}`);
    });

    const showAllBtn = document.getElementById('show-all-btn');
    if (showAllBtn) {
        showAllBtn.style.display = libr.length > 5 ? 'block' : 'none';
    }
}

// Вспомогательная функция, чтобы не дублировать код создания элементов
function createTrackElement(track, index) {
    const clone = template.content.cloneNode(true);
    const trackItem = clone.querySelector('.profile-track-item') || clone.querySelector('.track');

    clone.querySelector('.number').innerText = index + 1;
    clone.querySelector('img').src = track.coverSrc;
    clone.querySelector('.t-name').innerText = track.title;
    clone.querySelector('.t-artist').innerText = track.artist;
    
    const durEl = clone.querySelector('.t-duration');
    if (durEl) durEl.id = `dur-${track.id}`;

    trackItem.onclick = () => {
        currentTrackIndex = index;
        playTrack(libr[index]);
        const fullPlayer = document.getElementById("FullPlayer");
        if (fullPlayer) {
            fullPlayer.classList.add('open');
            // allTracksModal.classList.remove('open');
            setTimeout(moveTabBg, 150); 
        }
    };
    return clone;
}

// Логика открытия/закрытия
const showAllBtn = document.getElementById('show-all-btn');
const allTracksModal = document.getElementById('all-tracks-modal');
const closeAllBtn = document.getElementById('close-all-tracks');

if (showAllBtn && allTracksModal) {
    showAllBtn.onclick = () => {
        allTracksModal.classList.add('open'); // Используем класс open
        document.body.style.overflow = 'hidden'; // Запрещаем скролл сайта под блоком
    };
}

if (closeAllBtn && allTracksModal) {
    closeAllBtn.onclick = () => {
        allTracksModal.classList.remove('open');
        document.body.style.overflow = ''; // Возвращаем скролл
    };
}

function getDuration(src, elementId) {
    const tempAudio = new Audio(src);
    tempAudio.addEventListener('loadedmetadata', () => {
        const min = Math.floor(tempAudio.duration / 60);
        const sec = Math.floor(tempAudio.duration % 60);
        const el = document.getElementById(elementId);
        if (el) el.innerText = `${min}:${sec < 10 ? '0' + sec : sec}`;
    });
}

// --- 4. ЛОГИКА ПЛЕЕРА (ИЗ APP.JS) ---
function playTrack(track) {
    const miniPlayer = document.getElementById("PlayerHi");
      if (miniPlayer) {
      miniPlayer.classList.add('show'); 
          
          // ВОТ ЭТО ДОБАВЛЯЕМ:
          // Добавляем отступ основному контейнеру, чтобы плеер ничего не закрывал
          main.classList.add('padding-for-player');

          const fullPlayer = document.getElementById("FullPlayer");
          if (fullPlayer) {
              fullPlayer.classList.add('open');
              setTimeout(moveTabBg, 150); 
          }
        }
    

    audio.src = track.audioSrc;
    audio.play();
    pausebtn.src = "imgs/pause.png";

    document.getElementById("hiddentrackname").innerText = track.title;
     document.getElementById("hiddenartist").innerText = track.artist;
    document.getElementById("full-trackname").innerText = track.title;
     document.getElementById("full-artist").innerText = track.artist;
    document.getElementById("hiddencover").src = track.coverSrc;
    document.getElementById("full-cover").src = track.coverSrc;

    renderLyrics();
    updateQueue();
}

function updateQueue() {
  const queueList = document.getElementById('queue-list');
  if (!queueList) return;
  queueList.innerHTML = ''; 

  libr.forEach((track, index) => {
    const item = document.createElement('div');
    const isActive = (index === currentTrackIndex);
    item.className = `queue-item ${isActive ? 'active' : '' }`;
    
    item.innerHTML = `
      <img src="${track.coverSrc || 'covers/plcover.jpg'}">
      <div class="queue-item-info">
        <h5>${track.title}</h5>
        <p>${track.artist}</p>
      </div>
    `;
    
    item.onclick = () => {
      currentTrackIndex = index;
      playTrack(libr[currentTrackIndex]);
    };

    queueList.appendChild(item);
  });
}

// Функция переключения Пауза / Плей
function togglePlay() {
    if (audio.paused) {
        audio.play();
        // Меняем иконки на "паузу" во всех плеерах сразу
        document.querySelectorAll('#pausebtn, #full-pausebtn').forEach(img => {
            img.src = 'imgs/pause.png'; // Путь к твоей иконке паузы
        });
    } else {
        audio.pause();
        // Меняем иконки на "плей"
        document.querySelectorAll('#pausebtn, #full-pausebtn').forEach(img => {
            img.src = 'imgs/play.png'; // Путь к твоей иконке плей
        });
    }
}

// Вешаем событие на кнопку БОЛЬШОГО плеера
// Проверь, какой ID у кнопки в FullPlayer (я назову его full-pausebtn)
    const fullPauseBtn = document.getElementById('full-pausebtn');
    pausebtn.src = "imgs/pause.png";
    if (fullPauseBtn) { fullPauseBtn.src = "imgs/pause.png";
}
// 3. Обработчики кликов (ВАЖНО: stopPropagation лечит прыжки тайминга)

// Пауза в маленьком плеере
pausebtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
});

// Пауза в большом плеере
const fullPauseBtnElement = document.getElementById('full-pausebtn');
if (fullPauseBtnElement) {
    fullPauseBtnElement.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay();
    });
};

function changeTrack(dir) {
    if (libr.length === 0) return;
    currentTrackIndex += dir;
    if (currentTrackIndex < 0) currentTrackIndex = libr.length - 1;
    if (currentTrackIndex >= libr.length) currentTrackIndex = 0;
    playTrack(libr[currentTrackIndex]);
}

// --- 5. ТЕКСТЫ И СИНХРОНИЗАЦИЯ ---
function renderLyrics() {
    const container = document.getElementById('lyrics-container');
    const currentTrack = libr[currentTrackIndex];
    
    if (!currentTrack || !allLyrics[currentTrack.id]) {
        container.innerHTML = '<div style="color: #555; padding: 20px;">Текст отсутствует</div>';
        return;
    }

    const trackData = allLyrics[currentTrack.id]; // Данные конкретного трека
    const lyricsLines = trackData.lines;         // Массив строк
    const hasTimings = trackData.timings === "yes";

    container.innerHTML = '';
    container.scrollTop = 0;

    lyricsLines.forEach((line, index) => {
        const div = document.createElement('div');
        
        // Если timings: "no", сразу делаем всех белыми
        div.className = !hasTimings ? 'lyric-line active' : 'lyric-line';
        
        if (hasTimings) {
            div.id = `line-${index}`;
            div.dataset.time = line.time;
            div.onclick = () => {
                audio.currentTime = line.time;
                lastActiveIndex = -1;
            };
        }

        div.style.marginBottom = '15px';
        div.innerText = line.text;
        container.appendChild(div);
    });

    // Сохраняем флаг текущего трека в глобальную переменную
    allLyrics.isCurrentTrackTimed = hasTimings;
    lastActiveIndex = -1;
}

function updateLyrics(currentTime) {
    const track = libr[currentTrackIndex];
    if (!track) return;
    const lyrics = allLyrics[track.title] || [];
    
    let activeIndex = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (currentTime >= lyrics[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    if (activeIndex !== -1 && activeIndex !== lastActiveIndex) {
        if (lastActiveIndex !== -1) {
            document.getElementById(`lyric-${lastActiveIndex}`)?.classList.remove('active');
        }
        const activeLine = document.getElementById(`lyric-${activeIndex}`);
        if (activeLine) {
            activeLine.classList.add('active');
            activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        lastActiveIndex = activeIndex;
    }
}

window.addEventListener('keydown', (e) => {
  if (e.code === "Space") {
    // Если фокус не в поле ввода (вдруг ты чат сделаешь), то работаем
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault(); 
        togglePlay();
    }
  }
});

audio.addEventListener('timeupdate', () => {
    const { currentTime, duration } = audio;
    if (isNaN(duration)) return;

    const percent = (currentTime / duration) * 100;
    document.getElementById('progress-bar').style.width = `${percent}%`;
    if (fullBar) fullBar.style.width = `${percent}%`;
    if (fullDot) fullDot.style.left = `${percent}%`;

    const curM = Math.floor(currentTime / 60);
    const curS = Math.floor(currentTime % 60);
    const timeDisplay = document.getElementById('current-time');
    if (timeDisplay) timeDisplay.innerText = `${curM}:${curS < 10 ? '0' + curS : curS}`;
    
        const currentTrack = libr[currentTrackIndex];
    if (!currentTrack || !allLyrics[currentTrack.id]) return;
    const trackData = allLyrics[currentTrack.id];

    // Заглушка: если в JSON timings: "no", скролл не трогаем
    if (trackData.timings === "no" || trackData.timigs === "no") return;

    const lyricsLines = document.querySelectorAll('.lyric-line');
    let currentLineIndex = -1;

    lyricsLines.forEach((line, index) => {
        if (audio.currentTime >= parseFloat(line.dataset.time)) {
            currentLineIndex = index;
        }
    });

    if (currentLineIndex !== -1 && currentLineIndex !== lastActiveIndex) {
        lyricsLines.forEach(l => l.classList.remove('active'));
        const activeLine = lyricsLines[currentLineIndex];
        
        if (activeLine) {
            activeLine.classList.add('active');
            const container = document.getElementById('lyrics-container');

            // Расчет позиции: offsetTop строки относительно верха контейнера
            const lineTop = activeLine.offsetTop; 
            const containerHeight = container.offsetHeight;
            const targetScroll = lineTop - (containerHeight / 2) + (activeLine.offsetHeight / 2);

            // ЛОГИКА:
            // Если расчетный скролл меньше 0 (строка в верхней части), ставим 0.
            // Если больше 0, значит пора центрировать.
            container.scrollTo({
                top: targetScroll > 0 ? targetScroll : 0,
                behavior: 'smooth'
            });
        }
        lastActiveIndex = currentLineIndex;
    }

    updateLyrics(currentTime);
});

// Перемотка в маленьком плеере
const miniProgressContainer = document.getElementById('progress-container');
if (miniProgressContainer) {
    miniProgressContainer.addEventListener('click', (e) => {
        // Получаем точные размеры контейнера
        const rect = miniProgressContainer.getBoundingClientRect();
        // Считаем клик относительно начала полоски, а не всего экрана
        const x = e.clientX - rect.left; 
        const width = rect.width;
        
        // Если трек загружен, меняем время
        if (audio.duration) {
            audio.currentTime = (x / width) * audio.duration;
        }
    });
}

audio.onended = () => changeTrack(1);

// --- 6. ОБРАБОТЧИКИ СОБЫТИЙ (КНОПКИ И ТАБЫ) ---

const btnNext = document.getElementById('nextbtn');
const btnBack = document.getElementById('backbtn');
if (btnNext) btnNext.onclick = () => changeTrack(1);
if (btnBack) btnBack.onclick = () => changeTrack(-1);

const progressContainer = document.getElementById('full-progress-container');
if (progressContainer) {
    progressContainer.onclick = (e) => {
        const width = progressContainer.clientWidth;
        const clickX = e.offsetX;
        audio.currentTime = (clickX / width) * audio.duration;
    };
}

// Показ большого плеера
const hiddenCover = document.getElementById('hiddencover');
if (hiddenCover) {
hiddenCover.onclick = () => {
    document.getElementById('FullPlayer').classList.add('open');
   allTracksModal.classList.remove('open');
    setTimeout(moveTabBg, 150);
};
}

const btnCloseFull = document.getElementById('close-full');
if (btnCloseFull) {
    btnCloseFull.onclick = () => {
        document.getElementById('FullPlayer').classList.remove('open');
    };
}

function moveTabBg() {
    const activeTab = document.querySelector('.queue-tabs span.active');
    const bg = document.querySelector('.tab-bg');
    
    if (activeTab && bg) {
        // 1. Добавляем класс для эффекта "в полете" (непрозрачность)
        bg.classList.add('moving');
        
        // 2. Устанавливаем координаты и ширину
        bg.style.width = activeTab.offsetWidth + 'px';
        bg.style.left = activeTab.offsetLeft + 'px';
        
        // 3. Убираем класс плотности через 400мс (когда закончится transition в CSS)
        setTimeout(() => {
            bg.classList.remove('moving');
        }, 400); 
    }
}

const tabLyrics = document.getElementById('tab-lyrics');
if (tabLyrics) {
    tabLyrics.onclick = () => {
        document.getElementById('queue-list').style.display = 'none';
        document.getElementById('lyrics-container').style.display = 'block';
        document.getElementById('tab-lyrics').classList.add('active');
        document.getElementById('tab-queue').classList.remove('active');
        moveTabBg();
    };
}

const tabQueue = document.getElementById('tab-queue');
if (tabQueue) {
    tabQueue.onclick = () => {
        document.getElementById('queue-list').style.display = 'block';
        document.getElementById('lyrics-container').style.display = 'none';
        document.getElementById('tab-queue').classList.add('active');
        document.getElementById('tab-lyrics').classList.remove('active');
        moveTabBg();
    };
}
