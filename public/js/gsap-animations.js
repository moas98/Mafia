/**
 * GSAP animation layer for Mafia game – best use of GSAP for drama and clarity
 * https://gsap.com/ – timelines, staggers, and eases tailored to the game
 */
(function (global) {
    'use strict';

    const gsap = global.gsap;

    /** Toast fallback when GSAP not loaded */
    function showToastFallback(message, type) {
        type = type || 'info';
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
    }

    if (!gsap) {
        console.warn('GSAP not loaded – animations disabled');
        global.showToast = showToastFallback;
        return;
    }

    const DURATION = { instant: 0.12, fast: 0.22, normal: 0.4, slow: 0.55, dramatic: 0.7 };
    const EASE = 'power2.out';
    const EASE_BACK = 'back.out(1.15)';

    // --- Screen transitions with timeline + content stagger ---

    /**
     * Choreographed screen change: fade out → switch → fade in → stagger main content
     */
    function screenTransition(outScreen, inScreenId) {
        const inScreen = document.getElementById(inScreenId);
        if (!inScreen) return;

        function switchAndReveal() {
            document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
            inScreen.classList.add('active');
            gsap.set(inScreen, { opacity: 0 });

            const tl = gsap.timeline();
            tl.to(inScreen, { opacity: 1, duration: DURATION.normal, ease: EASE });

            const card = inScreen.querySelector('.card');
            const gameHeader = inScreen.querySelector('.game-header');
            const gameMain = inScreen.querySelector('.game-main');
            if (card) {
                gsap.set(card, { opacity: 0, y: 10 });
                tl.to(card, { opacity: 1, y: 0, duration: DURATION.normal, ease: EASE }, '-=0.2');
            }
            if (gameHeader && gameMain) {
                gsap.set([gameHeader, gameMain], { opacity: 0, y: 8 });
                tl.to([gameHeader, gameMain], { opacity: 1, y: 0, duration: DURATION.fast, stagger: 0.08, ease: EASE }, '-=0.15');
            }
        }

        if (outScreen && outScreen !== inScreen) {
            gsap.to(outScreen, {
                opacity: 0,
                duration: DURATION.normal,
                ease: EASE,
                onComplete: switchAndReveal
            });
        } else {
            switchAndReveal();
        }
    }

    /**
     * Landing title subtle entrance – run once when landing is shown
     */
    function landingTitleReveal() {
        const title = document.querySelector('#landing-screen .title');
        const subtitle = document.querySelector('#landing-screen .subtitle');
        if (!title) return;
        gsap.fromTo(title, { opacity: 0, scale: 0.96, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: DURATION.slow, ease: EASE_BACK });
        if (subtitle) {
            gsap.fromTo(subtitle, { opacity: 0, y: 6 }, { opacity: 0.9, y: 0, duration: DURATION.normal, delay: 0.15, ease: EASE });
        }
    }

    // --- Player cards ---

    /**
     * One-time calm entrance for player cards (subtle fade + slight slide, no bounce)
     */
    function animatePlayerCards(cards) {
        if (!cards || !cards.length) return;
        gsap.fromTo(cards,
            { opacity: 0, y: 8 },
            { opacity: 1, y: 0, duration: 0.32, stagger: 0.04, ease: EASE, overwrite: true }
        );
    }

    /**
     * When a player is eliminated – shake then settle (call when you know the card just died)
     */
    function animateCardDeath(cardEl) {
        if (!cardEl) return;
        const tl = gsap.timeline();
        tl.to(cardEl, { x: 4, duration: 0.04, ease: 'power2.inOut' })
            .to(cardEl, { x: -4, duration: 0.04, ease: 'power2.inOut' })
            .to(cardEl, { x: 2, duration: 0.03, ease: 'power2.inOut' })
            .to(cardEl, { x: 0, duration: 0.05, ease: EASE })
            .to(cardEl, { opacity: 0.4, scale: 0.98, duration: DURATION.normal, ease: EASE }, '-=0.03');
    }

    /**
     * Lobby player list stagger
     */
    function animatePlayerListItems(items) {
        if (!items || !items.length) return;
        gsap.fromTo(items,
            { opacity: 0, x: -20 },
            { opacity: 1, x: 0, duration: DURATION.fast, stagger: 0.04, ease: EASE_BACK, overwrite: true }
        );
    }

    // --- Modals ---

    /**
     * Role card: backdrop → card scale/rotate → content (dramatic reveal)
     */
    function showModal(modal, content) {
        if (!modal) return;
        const target = content || modal.querySelector('.modal-content');
        if (!target) return;
        modal.classList.remove('hidden');
        gsap.set(modal, { opacity: 0 });
        gsap.set(target, { scale: 0.88, opacity: 0 });

        const tl = gsap.timeline();
        tl.to(modal, { opacity: 1, duration: DURATION.fast, ease: EASE })
            .to(target, { scale: 1, opacity: 1, duration: DURATION.slow, ease: EASE_BACK }, '-=0.15');
        const img = target.querySelector('.role-card-image');
        const heading = target.querySelector('.role-card-title, h2');
        if (img) tl.fromTo(img, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: DURATION.normal, ease: EASE }, '-=0.35');
        if (heading) tl.fromTo(heading, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: DURATION.fast, ease: EASE }, '-=0.2');
    }

    /**
     * Hide modal with scale down + fade
     */
    function hideModal(modal, onComplete) {
        if (!modal) {
            if (onComplete) onComplete();
            return;
        }
        const target = modal.querySelector('.modal-content');
        gsap.to(target || modal, {
            scale: 0.95,
            opacity: 0,
            duration: DURATION.fast,
            ease: EASE,
            onComplete: () => {
                modal.classList.add('hidden');
                gsap.set(target || modal, { scale: 1, opacity: 1 });
                if (onComplete) onComplete();
            }
        });
    }

    // --- Phase & timer ---

    /**
     * Phase change: pulse indicator then optional timer emphasis; night/day get a quick flash
     */
    function phasePulse(element, phase) {
        if (!element) return;
        const tl = gsap.timeline();
        tl.fromTo(element, { scale: 1 }, { scale: 1.2, duration: 0.12, ease: 'power2.out' })
            .to(element, { scale: 1, duration: 0.2, ease: EASE_BACK });
    }

    /** Timer urgency: gentle repeating pulse when time is low (e.g. ≤10s) */
    let timerUrgencyTween = null;
    function timerUrgency(timeRemaining, timerEl) {
        if (timerUrgencyTween) {
            timerUrgencyTween.kill();
            timerUrgencyTween = null;
        }
        if (!timerEl || timeRemaining > 10) return;
        timerUrgencyTween = gsap.to(timerEl, {
            scale: 1.08,
            duration: 0.5,
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut'
        });
    }

    /** Stop timer urgency (call when phase changes or time > 10) */
    function timerUrgencyStop(timerEl) {
        if (timerUrgencyTween) {
            timerUrgencyTween.kill();
            timerUrgencyTween = null;
        }
        if (timerEl) gsap.set(timerEl, { scale: 1 });
    }

    // --- Moderator message ---

    /**
     * Stronger moderator message: scale + slide in, hold, then fade out
     */
    function moderatorMessageInOut(messageEl, holdMs) {
        if (!messageEl) return;
        const hold = (holdMs != null ? holdMs : 5000) / 1000;
        gsap.fromTo(messageEl, { opacity: 0, scale: 0.92, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: DURATION.normal, ease: EASE_BACK });
        gsap.to(messageEl, {
            opacity: 0,
            scale: 0.98,
            duration: 0.5,
            delay: hold,
            ease: EASE,
            onComplete: () => {
                if (messageEl.parentNode) messageEl.remove();
            }
        });
    }

    // --- Counts & buttons ---

    function countReactive(element) {
        if (!element) return;
        gsap.fromTo(element, { scale: 1.25 }, { scale: 1, duration: DURATION.fast, ease: EASE_BACK });
    }

    function buttonTap(btn) {
        if (!btn) return;
        gsap.to(btn, { scale: 0.96, duration: 0.06, ease: 'power2.out', yoyo: true, repeat: 1 });
    }

    // --- Chat & lists ---

    function chatMessageIn(messageEl) {
        if (!messageEl) return;
        gsap.fromTo(messageEl, { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: DURATION.fast, ease: EASE });
    }

    function animateRoomListItems(items) {
        if (!items || !items.length) return;
        gsap.fromTo(items,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: DURATION.fast, stagger: 0.045, ease: EASE, overwrite: true }
        );
    }

    /**
     * Vote breakdown: stagger each line for reveal effect
     */
    function animateVoteBreakdownLines(container) {
        if (!container) return;
        const lines = container.querySelectorAll('.vote-breakdown-line');
        if (!lines.length) return;
        gsap.fromTo(lines,
            { opacity: 0, x: -10 },
            { opacity: 1, x: 0, duration: DURATION.fast, stagger: 0.05, ease: EASE, overwrite: true }
        );
    }

    function timerTick(element) {
        if (!element) return;
        gsap.fromTo(element, { scale: 1 }, { scale: 1.06, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' });
    }

    // --- Toast notifications (replaces alert) ---

    const TOAST_DURATION = 4;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };

    function showToast(message, type) {
        type = type || 'info';
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.textContent = icons[type] || icons.info;
        toast.appendChild(icon);
        const text = document.createElement('span');
        text.className = 'toast-text';
        text.textContent = message;
        toast.appendChild(text);
        container.appendChild(toast);

        gsap.fromTo(toast, { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: DURATION.normal, ease: EASE_BACK });
        gsap.to(toast, {
            x: 40,
            opacity: 0,
            duration: 0.35,
            delay: TOAST_DURATION,
            ease: EASE,
            onComplete: () => {
                if (toast.parentNode) toast.remove();
            }
        });
    }

    // Export
    global.GSAPAnimations = {
        screenTransition,
        landingTitleReveal,
        animatePlayerCards,
        animateCardDeath,
        animatePlayerListItems,
        showModal,
        hideModal,
        phasePulse,
        timerUrgency,
        timerUrgencyStop,
        moderatorMessageInOut,
        countReactive,
        buttonTap,
        chatMessageIn,
        animateRoomListItems,
        animateVoteBreakdownLines,
        timerTick,
        showToast,
        DURATION,
        EASE,
        EASE_BACK
    };

    global.showToast = showToast;
})(typeof window !== 'undefined' ? window : this);
