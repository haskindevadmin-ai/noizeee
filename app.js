import { db, auth } from './firebase-config.js'; 
import { collection, getDocs, doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore"; 
import { onAuthStateChanged } from "firebase/auth";

let libr = []; // Твой основной список треков
const mainContainer = document.getElementById('main');
const trackTemplate = document.getElementById('track-temp');
  const miniPlayer = document.getElementById("PlayerHi");

// Следим за кнопками профиля
onAuthStateChanged(auth, (user) => {
  const signupLink = document.getElementById('nav-signup-link');
  const profileLink = document.getElementById('nav-profile-link');
  if (user) {
    if (signupLink) signupLink.style.display = 'none';
    if (profileLink) profileLink.style.display = 'block';
  } else {
    if (signupLink) signupLink.style.display = 'block';
    if (profileLink) profileLink.style.display = 'none';
  }
});
let allLyrics = {}; 
let currentTrackIndex = -1;
let lastActiveIndex = -1; 

const template = document.getElementById('track-temp');
const main = document.getElementById('main');
const audio = document.getElementById('audio');
const pausebtn = document.getElementById('pausebtn');
const fullBar = document.getElementById('full-progress-bar');
const fullDot = document.getElementById('full-progress-dot');
 

async function toggleLike(trackId, btnElement) {
  const user = auth.currentUser;
  if (!user) {
    alert("Войди в аккаунт!");
    return;
  }

  const userRef = doc(db, "users", user.uid);
   const icon = btnElement.querySelector('.like-icon');

  try {
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    const likedTraks = userData.likedTraks || [];

    if (likedTraks.includes(String(trackId))) {
      // Если уже лайкнут — удаляем
      await updateDoc(userRef, {
        likedTraks: arrayRemove(String(trackId))
      });
      if (icon) icon.src = "imgs/heart-empty.png";
      console.log(`Удалено из лайков: ${trackId}`);
    } else {
      // Если еще не лайкнут — добавляем
      await updateDoc(userRef, {
        likedTraks: arrayUnion(String(trackId))
      });
      if (icon) icon.src = "imgs/heart-filled.png";
      console.log(`Добавлено в лайки: ${trackId}`);
    }
  } catch (err) {
    console.error("Ошибка при переключении лайка:", err);
  }
}

async function loadMusic() {
  try {
    console.log("🚀 Запуск загрузки Noizeee...");
    let tracksFromFirebase = [];
    
    // 1. Получаем данные из Firestore (твои ссылки на GitHub лежат тут)
    const querySnapshot = await getDocs(collection(db, "tracks"));
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Формируем объект трека. 
      // Мы НЕ добавляем папки "covers/" или "music/", так как в базе уже полные ссылки GitHub Raw
      tracksFromFirebase.push({
        id: data.id, // ID документа из Firebase (должен совпадать с ключами в lyrics.json)
        title: data.title || data.name || "Unknown Title",
        artist: data.artist || "Unknown Artist",
        coverSrc: data.coverSrc || data.cover || "covers/plcover.jpg",
        src: data.audioSrc || "" // Ссылка на .mp3 файл с GitHub
      });
    });

    // 2. Решаем, что использовать в качестве библиотеки
    if (tracksFromFirebase.length > 0) {
      libr = tracksFromFirebase;
      console.log("✅ Треки подгружены из Firebase (GitHub Links)");
    } else {
      console.warn("⚠️ Firebase пуст, используем локальный music.json");
      const response = await fetch('music.json');
      libr = await response.json();
    }
    
    // 3. Загрузка текстов с твоего репозитория
    try {
      const githubLyricsUrl = 'https://raw.githubusercontent.com/haskindevadmin-ai/other/main/lyrics.json';
      const lyrResponse = await fetch(githubLyricsUrl);
      if (lyrResponse.ok) {
        allLyrics = await lyrResponse.json();
        console.log("✅ Тексты песен синхронизированы с GitHub");
      }
    } catch (lyrErr) {
      console.error("❌ Не удалось загрузить текста с GitHub:", lyrErr);
      allLyrics = {}; // Чтобы код не падал при поиске текста
    }
    
    // 4. Отрисовка интерфейса (твой оригинальный метод)
    const main = document.getElementById('main');
    const template = document.getElementById('track-temp');
    
    if (!main || !template) {
        console.error("❌ Элементы main или template не найдены");
        return;
    }
    
    main.innerHTML = ''; // Очистка перед отрисовкой

// Внутри loadMusic, перед libr.forEach
const user = auth.currentUser;
let userLikes = [];
if (user) {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (userSnap.exists()) userLikes = userSnap.data().likedTraks || [];
}
    
   libr.forEach((track, index) => {
      const clone = template.content.cloneNode(true);
      
      const titleEl = clone.querySelector('.trackname');
      const artistEl = clone.querySelector('.trackartist');
      const coverEl = clone.querySelector('.cover');
      const likeBtn = clone.querySelector('.like-btn'); // Находим кнопку лайка
      const icon = clone.querySelector('.like-icon');   // Находим иконку внутри клона

      if (titleEl) titleEl.innerText = track.title;
      if (artistEl) artistEl.innerText = track.artist;
      if (coverEl) coverEl.src = track.coverSrc;
      
      // Теперь icon определена, и проверка сработает
      if (userLikes.includes(String(track.id)) && icon) {
          icon.src = "imgs/heart-filled.png";
      }

      if (likeBtn) {
        likeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleLike(track.id, likeBtn); // Передаем кнопку в функцию
        });
      }

      const playerBtn = clone.querySelector('.player');
      if (playerBtn) {
        playerBtn.addEventListener('click', () => {
          currentTrackIndex = index;
          playTrack(track); 
          const fullPlayer = document.getElementById("FullPlayer");
          if (fullPlayer) {
              fullPlayer.classList.add('open');
              setTimeout(moveTabBg, 150); 
          }
        });
      }

      main.appendChild(clone);
    });

    console.log("✅ Все треки отрисованы успешно");
    if (typeof updateMainHighlights === 'function') updateMainHighlights(); 
    
  } catch (err) {
    console.error("❌ Критическая ошибка в loadMusic:", err);
  }
}

function playTrack(track) {
  if (!track || currentTrackIndex === -1) return;

  // 1. Показываем маленький плеер (выезд снизу)
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


  // Подсветка активного трека
  updateMainHighlights(); 
  if (typeof updateQueue === "function") updateQueue();

  // --- ЗАПУСК АУДИО (ИСПРАВЛЕНО) ---
  // В Firebase у нас поле .src, а в стоке было .audioSrc
  const audioFile = track.src || track.audioSrc; 
  if (audioFile) {
      audio.src = audioFile;
      audio.load(); // Подгружаем файл
      audio.play().catch(e => console.error("Ошибка воспроизведения:", e));
  }

  // Обновляем инфу в маленьком плеере
  const hCover = document.getElementById("hiddencover");
  const hTrack = document.getElementById("hiddentrackname");
  const hArtist = document.getElementById("hiddenartist");
  
  if (hCover) hCover.src = track.coverSrc || "covers/plcover.jpg";
  if (hTrack) hTrack.innerText = track.title;
  if (hArtist) hArtist.innerText = track.artist;

  // Обновляем инфу в большом плеере
  const fCover = document.getElementById("full-cover");
  const fTrack = document.getElementById("full-trackname");
  const fArtist = document.getElementById("full-artist");

  if (fCover) fCover.src = track.coverSrc || "covers/plcover.jpg";
  if (fTrack) fTrack.innerText = track.title;
  if (fArtist) fArtist.innerText = track.artist;

  // Иконки паузы
  const pBtn = document.getElementById("pausebtn");
  const fpBtn = document.getElementById("full-pausebtn");
  if (pBtn) pBtn.src = "imgs/pause.png";
  if (fpBtn) fpBtn.src = "imgs/pause.png";

  // --- ТЕКСТА (ИСПРАВЛЕНО) ---
  const lyricsContainer = document.getElementById("lyrics-container"); // Проверь этот ID в HTML
  if (lyricsContainer) {
      // Ищем текст в allLyrics по твоему ID (1-9)
      const currentLyrics = allLyrics[track.id];
      if (currentLyrics) {
          lyricsContainer.innerText = currentLyrics;
      } else {
          lyricsContainer.innerText = "Текст для этого трека еще не добавлен.";
          console.warn("Текст не найден для ID:", track.id);
      }
  }

  // Если у тебя есть отдельная функция рендера — вызываем, 
  // но база текста теперь обновлена выше
  if (typeof renderLyrics === "function") renderLyrics();
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

  const activeItem = queueList.querySelector('.active');
  if (activeItem) {
    activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
//Вот тут логика плей пауз
// 1. Универсальная функция паузы/плея
function togglePlay() {
  const fullPauseBtn = document.getElementById('full-pausebtn'); 
  
  if (audio.paused) {
    audio.play();
    pausebtn.src = "imgs/pause.png";
    if (fullPauseBtn) fullPauseBtn.src = "imgs/pause.png";
  } else {
    audio.pause();
    pausebtn.src = "imgs/play.png";
    if (fullPauseBtn) fullPauseBtn.src = "imgs/play.png";
  }
}

// 2. Функция переключения треков (Next/Back)
function changeTrack(direction) {
    // Сбрасываем индекс текста
    lastActiveIndex = -1;

    currentTrackIndex += direction;
    
    if (currentTrackIndex >= libr.length) currentTrackIndex = 0;
    if (currentTrackIndex < 0) currentTrackIndex = libr.length - 1;
    
    console.log("Переключаю на трек №", currentTrackIndex); // Чекни это в консоли!

    playTrack(libr[currentTrackIndex]);
    
    // Убираем отсюда лишние вызовы, если они есть в playTrack
    const fullPauseBtn = document.getElementById('full-pausebtn');
    pausebtn.src = "imgs/pause.png";
    if (fullPauseBtn) fullPauseBtn.src = "imgs/pause.png";
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
}

// Кнопки вперед/назад
const nextBtn = document.getElementById('nextbtn');
const backBtn = document.getElementById('backbtn');

if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeTrack(1);
    });
}

if (backBtn) {
    backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        changeTrack(-1);
    });
}

// 4. Управление пробелом
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
    if (!audio.duration) return;
    const progressPercent = (audio.currentTime / audio.duration) * 100;
  
    const miniBar = document.getElementById('progress-bar');
    if (miniBar) miniBar.style.width = progressPercent + "%";
    if (fullBar && fullDot) {
        fullBar.style.width = progressPercent + "%";
        fullDot.style.left = progressPercent + "%";
    }

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
});

const progressContainer = document.getElementById('progress-container');
progressContainer.addEventListener('click', (e) => {
  const width = progressContainer.clientWidth;
  audio.currentTime = (e.offsetX / width) * audio.duration;
});

const fullProgressContainer = document.getElementById('full-progress-container');
if (fullProgressContainer) {
  fullProgressContainer.addEventListener('click', (e) => {
    const width = fullProgressContainer.clientWidth;
    audio.currentTime = (e.offsetX / width) * audio.duration;
  });
}

audio.addEventListener('ended', () => {
  currentTrackIndex = (currentTrackIndex + 1) % libr.length;
  playTrack(libr[currentTrackIndex]);
});

document.getElementById('hiddencover').addEventListener('click', () => {
  document.getElementById('FullPlayer').classList.add('open');
});

document.getElementById('close-full').addEventListener('click', () => {
  document.getElementById('FullPlayer').classList.remove('open');
});

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

document.getElementById('tab-lyrics').onclick = () => {
  document.getElementById('queue-list').style.display = 'none';
  document.getElementById('lyrics-container').style.display = 'block';
  document.getElementById('tab-lyrics').classList.add('active');
  document.getElementById('tab-queue').classList.remove('active');
  renderLyrics();
};

document.getElementById('tab-queue').onclick = () => {
  document.getElementById('queue-list').style.display = 'block';
  document.getElementById('lyrics-container').style.display = 'none';
  document.getElementById('tab-queue').classList.add('active');
  document.getElementById('tab-lyrics').classList.remove('active');
};

loadMusic();

function updateMainHighlights() {
    const mainTracks = document.querySelectorAll('#main .player');
    mainTracks.forEach((trackElement, index) => {
        // Если индекс совпадает и он не равен -1
        if (currentTrackIndex !== -1 && index === currentTrackIndex) {
            trackElement.classList.add('active-main-track');
        } else {
            trackElement.classList.remove('active-main-track');
        }
    });
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

// Обработчики кликов (обнови свои)
document.getElementById('tab-lyrics').onclick = () => {
    document.getElementById('queue-list').style.display = 'none';
    document.getElementById('lyrics-container').style.display = 'block';
    
    document.getElementById('tab-lyrics').classList.add('active');
    document.getElementById('tab-queue').classList.remove('active');
    
    moveTabBg(); 
    renderLyrics();
};

document.getElementById('tab-queue').onclick = () => {
    document.getElementById('queue-list').style.display = 'block';
    document.getElementById('lyrics-container').style.display = 'none';
    
    document.getElementById('tab-queue').classList.add('active');
    document.getElementById('tab-lyrics').classList.remove('active');
    
    moveTabBg();
};

// Чтобы при первом открытии плеера бегунок сразу встал куда надо
document.getElementById('hiddencover').addEventListener('click', () => {
    document.getElementById('FullPlayer').classList.add('open');
    // Небольшая задержка, чтобы анимация открытия плеера не мешала расчетам
    setTimeout(moveTabBg, 150); 
});

// Находим кнопки по ID
const btnNext = document.getElementById('nextbtn');
const btnBack = document.getElementById('backbtn');

if (btnNext) {
    // Удаляем старые обработчики (если они были) и ставим один чистый
    btnNext.replaceWith(btnNext.cloneNode(true)); 
    document.getElementById('nextbtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Запрещаем клику идти дальше
        changeTrack(1);
    });
}

if (btnBack) {
    btnBack.replaceWith(btnBack.cloneNode(true));
    document.getElementById('backbtn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        changeTrack(-1);
    });
};

// Кнопка назад
document.getElementById('back-to-main').onclick = () => {
    document.getElementById('main').style.display = 'grid';
    document.getElementById('artist-page').style.display = 'none';
};

