/**
 * BREATHING APP — Main Application Logic
 * Telegram Mini App для дыхательных практик
 */

// ============================================
// CONFIGURATION & STATE
// ============================================

let techniquesData = null;
let currentMode = null;
let currentTechnique = null;
let selectedDuration = 60; // секунды

// Practice state
let practiceState = {
    isRunning: false,
    isPaused: false,
    isPreparing: false,
    isFinishing: false,
    totalTime: 0,
    remainingTime: 0,
    prepTime: 0,
    currentPhaseIndex: 0,
    phaseTimeRemaining: 0,
    intervalId: null,
    animationId: null
};

let wakeLock = null;

// ============================================
// TELEGRAM WEBAPP API
// ============================================

const tg = window.Telegram?.WebApp;

function initTelegram() {
    if (tg) {
        // Расширяем на весь экран
        tg.expand();

        // Устанавливаем тему
        applyTheme(tg.colorScheme);

        // Слушаем изменение темы
        tg.onEvent('themeChanged', () => {
            applyTheme(tg.colorScheme);
        });

        // Готово к отображению
        tg.ready();

        console.log('Telegram WebApp initialized');
    } else {
        // Fallback для браузера — определяем тему системы
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');

        // Слушаем изменения системной темы
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            applyTheme(e.matches ? 'dark' : 'light');
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function hapticFeedback(type = 'light') {
    if (tg?.HapticFeedback) {
        switch (type) {
            case 'light':
                tg.HapticFeedback.impactOccurred('light');
                break;
            case 'medium':
                tg.HapticFeedback.impactOccurred('medium');
                break;
            case 'heavy':
                tg.HapticFeedback.impactOccurred('heavy');
                break;
            case 'success':
                tg.HapticFeedback.notificationOccurred('success');
                break;
            case 'warning':
                tg.HapticFeedback.notificationOccurred('warning');
                break;
            case 'error':
                tg.HapticFeedback.notificationOccurred('error');
                break;
        }
    }
}

// ============================================
// WAKE LOCK API
// ============================================

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock is active');

            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
            });
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

async function releaseWakeLock() {
    if (wakeLock !== null) {
        try {
            await wakeLock.release();
            wakeLock = null;
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
}


// ============================================
// DATA LOADING
// ============================================

async function loadTechniques() {
    try {
        const response = await fetch('techniques.json');
        techniquesData = await response.json();
        console.log('Techniques loaded:', techniquesData);
    } catch (error) {
        console.error('Error loading techniques:', error);
        // Fallback данные если JSON не загрузился
        techniquesData = getFallbackData();
    }
}

function getFallbackData() {
    return {
        techniques: [
            {
                id: "box",
                name: "Квадратное дыхание",
                description: "4-4-4-4 — баланс и спокойствие",
                phases: [
                    { name: "Вдох", duration: 4, type: "inhale" },
                    { name: "Задержка", duration: 4, type: "hold" },
                    { name: "Выдох", duration: 4, type: "exhale" },
                    { name: "Задержка", duration: 4, type: "hold" }
                ],
                effects: ["stress", "focus"],
                totalCycle: 16
            },
            {
                id: "478",
                name: "Техника 4-7-8",
                description: "Глубокое расслабление для сна",
                phases: [
                    { name: "Вдох", duration: 4, type: "inhale" },
                    { name: "Задержка", duration: 7, type: "hold" },
                    { name: "Выдох", duration: 8, type: "exhale" }
                ],
                effects: ["sleep"],
                totalCycle: 19
            },
            {
                id: "physiological",
                name: "Физиологический вздох",
                description: "Двойной вдох + длинный выдох",
                phases: [
                    { name: "Вдох", duration: 2, type: "inhale" },
                    { name: "Довдох", duration: 1, type: "inhale" },
                    { name: "Выдох", duration: 6, type: "exhale" }
                ],
                effects: ["stress", "quick"],
                totalCycle: 9
            },
            {
                id: "coherent",
                name: "Когерентное 5/5",
                description: "Равномерное дыхание для баланса",
                phases: [
                    { name: "Вдох", duration: 5, type: "inhale" },
                    { name: "Выдох", duration: 5, type: "exhale" }
                ],
                effects: ["energy", "focus"],
                totalCycle: 10
            },
            {
                id: "relax48",
                name: "Вдох 4 → Выдох 8",
                description: "Удлинённый выдох для расслабления",
                phases: [
                    { name: "Вдох", duration: 4, type: "inhale" },
                    { name: "Выдох", duration: 8, type: "exhale" }
                ],
                effects: ["sleep", "stress"],
                totalCycle: 12
            },
            {
                id: "wave",
                name: "Волновое дыхание",
                description: "Плавное нарастание и спад",
                phases: [
                    { name: "Вдох", duration: 6, type: "inhale" },
                    { name: "Пауза", duration: 2, type: "hold" },
                    { name: "Выдох", duration: 6, type: "exhale" },
                    { name: "Пауза", duration: 2, type: "hold" }
                ],
                effects: ["focus", "energy"],
                totalCycle: 16
            }
        ],
        modes: {
            sleep: { name: "Сон", icon: "🌙", techniques: ["478", "relax48"] },
            stress: { name: "Стресс", icon: "🧘", techniques: ["box", "physiological", "relax48"] },
            focus: { name: "Фокус", icon: "🎯", techniques: ["box", "coherent", "wave"] },
            energy: { name: "Энергия", icon: "⚡", techniques: ["coherent", "wave"] },
            quick: { name: "Быстро", icon: "⏱️", techniques: ["physiological"] }
        },
        durations: [60, 180, 300, 600]
    };
}

// ============================================
// NAVIGATION
// ============================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    hapticFeedback('light');
}

function showHomeScreen() {
    resetPractice();
    showScreen('screen-home');
}

function showTechniquesScreen(mode) {
    currentMode = mode;
    const modeData = techniquesData.modes[mode];

    // Обновляем заголовок
    document.getElementById('mode-title').textContent = modeData.name;

    // Получаем техники для этого режима
    const techniques = modeData.techniques
        .map(id => techniquesData.techniques.find(t => t.id === id))
        .filter(Boolean);

    // Рендерим карточки техник
    const container = document.getElementById('techniques-list');
    container.innerHTML = techniques.map(technique => `
        <div class="technique-card" data-technique-id="${technique.id}">
            <div class="technique-name">${technique.name}</div>
            <div class="technique-description">${technique.description}</div>
            <div class="technique-phases">
                ${technique.phases.map(p => `
                    <span class="phase-badge">${p.name} ${p.duration}с</span>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Добавляем обработчики
    container.querySelectorAll('.technique-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.techniqueId;
            selectTechnique(id);
        });
    });

    showScreen('screen-techniques');
}

function showPracticeScreen(technique) {
    currentTechnique = technique;

    // Обновляем заголовок
    document.getElementById('technique-title').textContent = technique.name;

    // Если режим "Быстро" — автоматически устанавливаем 1 минуту
    if (currentMode === 'quick') {
        selectedDuration = 60;
    }

    // Обновляем активную кнопку длительности
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.duration) === selectedDuration);
    });

    // Показываем селектор длительности
    document.getElementById('duration-selector').style.display = 'flex';
    document.getElementById('practice-area').classList.remove('active');
    document.getElementById('completion-screen').classList.add('hidden');

    showScreen('screen-practice');
}

function selectTechnique(techniqueId) {
    const technique = techniquesData.techniques.find(t => t.id === techniqueId);
    if (technique) {
        showPracticeScreen(technique);
    }
}

// ============================================
// PRACTICE LOGIC
// ============================================

function startPractice() {
    if (!currentTechnique) return;

    hapticFeedback('medium');

    // Скрываем селектор, показываем область практики
    document.getElementById('duration-selector').style.display = 'none';
    document.getElementById('practice-area').classList.add('active');

    // Инициализируем состояние подготовки
    practiceState.isRunning = true;
    practiceState.isPaused = false;
    practiceState.isPreparing = true;
    practiceState.isFinishing = false;
    practiceState.prepTime = 3;

    // Инициализируем таймеры для самой практики (они начнутся после подготовки)
    practiceState.totalTime = selectedDuration;
    practiceState.remainingTime = selectedDuration;
    practiceState.currentPhaseIndex = 0;
    practiceState.phaseTimeRemaining = currentTechnique.phases[0].duration;

    // Обновляем UI для подготовки
    updatePracticeUI();
    updateBreathCircle();

    // Запускаем таймер
    practiceState.intervalId = setInterval(tick, 1000);

    // Звук старта (легкий)
    SoundManager.init();
    hapticFeedback('light');

    // Блокировка экрана
    requestWakeLock();
}

function tick() {
    if (practiceState.isPaused) return;

    // === ФАЗА ПОДГОТОВКИ ===
    if (practiceState.isPreparing) {
        practiceState.prepTime--;

        if (practiceState.prepTime <= 0) {
            // Завершаем подготовку, начинаем практику
            practiceState.isPreparing = false;

            // Звук/Вибрация начала
            hapticFeedback('medium');
            SoundManager.playPhase(currentTechnique.phases[0].type);
        }

        updatePracticeUI();
        updateBreathCircle();
        return;
    }

    // === ОСНОВНАЯ ПРАКТИКА ===

    // Уменьшаем время фазы
    practiceState.phaseTimeRemaining--;
    practiceState.remainingTime--;

    // Если время вышло, помечаем флагом, но не останавливаем
    if (practiceState.remainingTime <= 0) {
        practiceState.isFinishing = true;
    }

    // Проверяем конец фазы
    if (practiceState.phaseTimeRemaining <= 0) {
        // Проверяем конец практики (если время вышло И закончилась последняя фаза цикла)
        const isLastPhase = practiceState.currentPhaseIndex === currentTechnique.phases.length - 1;

        if (practiceState.isFinishing && isLastPhase) {
            completePractice();
            return;
        }

        // Переходим к следующей фазе
        practiceState.currentPhaseIndex =
            (practiceState.currentPhaseIndex + 1) % currentTechnique.phases.length;

        const newPhase = currentTechnique.phases[practiceState.currentPhaseIndex];
        practiceState.phaseTimeRemaining = newPhase.duration;

        // Вибрация при смене фазы
        hapticFeedback('light');
        SoundManager.playPhase(newPhase.type);
    }

    updatePracticeUI();
    updateBreathCircle();
}

function updatePracticeUI() {
    // Если подготовка
    if (practiceState.isPreparing) {
        document.getElementById('phase-text').textContent = "Приготовьтесь";
        document.getElementById('phase-timer').textContent = practiceState.prepTime;
        document.getElementById('total-timer').textContent = "0:00";
        return;
    }

    const phase = currentTechnique.phases[practiceState.currentPhaseIndex];

    // Обновляем текст фазы и таймер
    document.getElementById('phase-text').textContent = phase.name;
    document.getElementById('phase-timer').textContent = practiceState.phaseTimeRemaining;

    // Обновляем общий таймер
    // Показываем 0:00, если ушли в "дополнительное время" (graceful finish)
    const displayTime = Math.max(0, practiceState.remainingTime);
    const minutes = Math.floor(displayTime / 60);
    const seconds = displayTime % 60;
    document.getElementById('total-timer').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Обновляем иконки паузы/плей
    const pauseIcon = document.querySelector('.icon-pause');
    const playIcon = document.querySelector('.icon-play');
    pauseIcon.classList.toggle('hidden', practiceState.isPaused);
    playIcon.classList.toggle('hidden', !practiceState.isPaused);
}

function updateBreathCircle() {
    const circle = document.getElementById('breath-circle');

    // Сброс классов
    circle.classList.remove('inhale', 'hold', 'exhale', 'prepare');

    if (practiceState.isPreparing) {
        // Особый стиль для подготовки, если нужно. Или просто нейтральный.
        // Можно добавить пульсацию
        circle.style.transform = `scale(1)`;
        return;
    }

    const phase = currentTechnique.phases[practiceState.currentPhaseIndex];

    // Добавляем класс текущей фазы
    circle.classList.add(phase.type);

    // Анимация размера
    const phaseDuration = phase.duration;
    // Корректируем прогресс, чтобы он был плавным (phaseTimeRemaining меняется дискретно)
    // Для большей плавности можно добавить CSS transition на transform, что уже есть (0.1s linear)
    const progress = 1 - (practiceState.phaseTimeRemaining / phaseDuration);

    let scale = 1;
    if (phase.type === 'inhale') {
        scale = 0.8 + (0.4 * progress); // 0.8 → 1.2
    } else if (phase.type === 'exhale') {
        scale = 1.2 - (0.4 * progress); // 1.2 → 0.8
    } else {
        // hold — сохраняем предыдущий размер
        const prevPhase = currentTechnique.phases[
            (practiceState.currentPhaseIndex - 1 + currentTechnique.phases.length)
            % currentTechnique.phases.length
        ];
        scale = prevPhase.type === 'inhale' ? 1.2 : 0.8;
    }

    circle.style.transform = `scale(${scale})`;
}

function togglePause() {
    practiceState.isPaused = !practiceState.isPaused;
    hapticFeedback('light');
    updatePracticeUI();
}

function stopPractice() {
    hapticFeedback('warning');
    resetPractice();
    showHomeScreen();
}

function resetPractice() {
    if (practiceState.intervalId) {
        clearInterval(practiceState.intervalId);
    }

    practiceState = {
        isRunning: false,
        isPaused: false,
        isPreparing: false,
        isFinishing: false,
        totalTime: 0,
        remainingTime: 0,
        prepTime: 0,
        currentPhaseIndex: 0,
        phaseTimeRemaining: 0,
        intervalId: null,
        animationId: null
    };

    // Освобождаем блокировку экрана
    releaseWakeLock();
}

function completePractice() {
    hapticFeedback('success');
    SoundManager.playComplete();
    resetPractice();

    // Показываем экран завершения
    document.getElementById('practice-area').classList.remove('active');
    document.getElementById('completion-screen').classList.remove('hidden');
}

function finishAndGoHome() {
    hapticFeedback('light');
    showHomeScreen();
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            showTechniquesScreen(mode);
        });
    });

    // Back buttons
    document.getElementById('back-to-home').addEventListener('click', showHomeScreen);
    document.getElementById('back-to-techniques').addEventListener('click', () => {
        resetPractice();
        showTechniquesScreen(currentMode);
    });

    // Duration buttons
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedDuration = parseInt(btn.dataset.duration);
            document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            hapticFeedback('light');
        });
    });

    // Start practice
    document.getElementById('start-practice').addEventListener('click', startPractice);

    // Practice controls
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('stop-btn').addEventListener('click', stopPractice);

    // Done button
    document.getElementById('done-btn').addEventListener('click', finishAndGoHome);

    // Sound Toggle
    document.getElementById('sound-toggle').addEventListener('click', () => {
        const isMuted = SoundManager.toggleSound();
        const iconInfo = document.querySelector('#sound-toggle .sound-icon');
        iconInfo.textContent = isMuted ? '🔇' : '🔊';

        const btn = document.getElementById('sound-toggle');
        btn.classList.toggle('active', !isMuted);

        if (!isMuted) {
            SoundManager.playPhase('inhale'); // Preview
        }
        hapticFeedback('selection');
    });

    // Re-acquire wake lock on visibility change
    document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
            await requestWakeLock();
        }
    });
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
    console.log('Initializing Breathing App...');

    initTelegram();
    await loadTechniques();
    initEventListeners();

    // Check initial mute state for UI
    const iconInfo = document.querySelector('#sound-toggle .sound-icon');
    if (iconInfo) {
        iconInfo.textContent = SoundManager.isMuted ? '🔇' : '🔊';
    }

    console.log('App ready!');
}

// Start app
document.addEventListener('DOMContentLoaded', init);
