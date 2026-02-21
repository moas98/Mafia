/**
 * UI management and DOM updates
 */
class UIManager {
    constructor() {
        this.currentScreen = 'landing';
        this._playerCardsAnimatedOnce = false; // only animate cards when first showing grid
    }

    /**
     * Show a specific screen (with GSAP transition when available)
     */
    showScreen(screenName) {
        console.log('🖥️ Switching to screen:', screenName);
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (!targetScreen) {
            console.error('❌ Screen not found:', `${screenName}-screen`);
            return;
        }
        if (this.currentScreen === 'game' && screenName !== 'game') {
            this._playerCardsAnimatedOnce = false;
        }
        const outScreen = document.querySelector('.screen.active');
        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.screenTransition && outScreen !== targetScreen) {
            GSAPAnimations.screenTransition(outScreen, `${screenName}-screen`, screenName);
        } else {
            document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
            targetScreen.classList.add('active');
        }
        this.currentScreen = screenName;
        console.log('✅ Screen switched to:', screenName);
    }

    /**
     * Update room code display
     */
    updateRoomCode(roomCode) {
        const displays = document.querySelectorAll('#room-code-display, #room-code-header');
        displays.forEach(el => {
            if (el) el.textContent = roomCode;
        });
    }

    /**
     * Update players list in lobby
     */
    updatePlayersList(players, isCreator = false) {
        console.log('🔄 updatePlayersList called with:', {
            playersCount: players?.length,
            players: players,
            isCreator: isCreator
        });
        
        const list = document.getElementById('players-list');
        const count = document.getElementById('player-count');
        const startSection = document.getElementById('start-game-section');
        
        if (!list) {
            console.error('❌ Players list element (#players-list) not found in DOM!');
            console.error('❌ Current screen:', this.currentScreen);
            return;
        }

        if (!players || !Array.isArray(players)) {
            console.error('❌ Invalid players data:', players);
            console.error('❌ Type:', typeof players);
            return;
        }

        console.log('🔄 Updating players list with', players.length, 'players');
        
        list.innerHTML = '';
        
        if (players.length === 0) {
            const emptyMsg = document.createElement('li');
            emptyMsg.textContent = 'No players yet...';
            emptyMsg.style.color = 'rgba(255, 255, 255, 0.5)';
            emptyMsg.style.fontStyle = 'italic';
            list.appendChild(emptyMsg);
        } else {
            const currentPlayerId = gameState.playerId;
            players.forEach((player, index) => {
                const li = document.createElement('li');
                li.className = 'player-list-item';
                li.style.display = 'flex';
                li.style.alignItems = 'center';
                li.style.justifyContent = 'space-between';
                li.style.gap = '10px';
                li.style.marginBottom = '6px';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = player.name || `Player ${index + 1}`;
                if (player.isAlive === false) {
                    nameSpan.style.opacity = '0.5';
                    nameSpan.textContent += ' (Dead)';
                } else if (player.disconnected) {
                    nameSpan.style.opacity = '0.7';
                    nameSpan.textContent += ' (Disconnected)';
                }
                li.appendChild(nameSpan);
                if (isCreator && player.id !== currentPlayerId) {
                    const kickBtn = document.createElement('button');
                    kickBtn.type = 'button';
                    kickBtn.className = 'btn-kick';
                    kickBtn.title = 'Kick player';
                    kickBtn.textContent = 'Kick';
                    kickBtn.dataset.playerId = player.id || '';
                    kickBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const pid = kickBtn.dataset.playerId;
                        if (!pid) return;
                        if (this._kickConfirmId === pid) {
                            this._kickConfirmId = null;
                            if (typeof showToast === 'function') showToast(`${player.name} kicked from room`, 'info');
                            socketClient.kickPlayer(gameState.roomCode, pid);
                        } else {
                            this._kickConfirmId = pid;
                            if (typeof showToast === 'function') showToast(`Kick ${player.name}? Click Kick again to confirm`, 'info');
                            clearTimeout(this._kickConfirmTimeout);
                            this._kickConfirmTimeout = setTimeout(() => { this._kickConfirmId = null; }, 3000);
                        }
                    });
                    li.appendChild(kickBtn);
                }
                list.appendChild(li);
            });
        }

        if (count) {
            const oldCount = count.textContent;
            count.textContent = players.length;
            if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.countReactive) {
                GSAPAnimations.countReactive(count);
            }
            console.log(`✅ Player count updated: ${oldCount} → ${players.length}`);
            if (count.textContent !== String(players.length)) {
                console.error('❌ Player count element not updating!');
                count.textContent = players.length;
            }
        } else {
            console.error('❌ Player count element not found!');
        }
        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.animatePlayerListItems) {
            const items = list.querySelectorAll('.player-list-item');
            if (items.length) GSAPAnimations.animatePlayerListItems(items);
        }

        if (startSection) {
            if (isCreator && players.length >= 3) {
                startSection.classList.remove('hidden');
                console.log('✅ Start game button shown');
            } else {
                startSection.classList.add('hidden');
            }
        }
    }

    /**
     * Render player cards in game
     */
    renderPlayerCards(players, currentPlayerId) {
        const grid = document.getElementById('players-grid');
        if (!grid) return;

        grid.innerHTML = '';
        
        const isNight = gameState.phase === 'night';
        const isDay = gameState.phase === 'day';
        const canAct = gameState.canPerformAction();
        const isCurrentPlayer = (playerId) => playerId === currentPlayerId;
        
        players.forEach(player => {
            const isOfficer = gameState.role === 'detective';
            const hasBeenInvestigated = isOfficer && gameState.investigationResults && player.id in gameState.investigationResults;
            const invClass = !hasBeenInvestigated ? '' : (gameState.investigationResults[player.id] === true ? 'investigated-mafia' : 'investigated-clean');
            const card = document.createElement('div');
            card.className = `player-card ${!player.isAlive ? 'dead' : ''} ${player.disconnected ? 'disconnected' : ''} ${invClass}`.trim();
            card.dataset.playerId = player.id || '';

            const name = document.createElement('div');
            name.className = 'player-name';
            name.textContent = player.name;

            const status = document.createElement('div');
            status.className = 'player-status';
            status.textContent = player.disconnected ? 'Disconnected' : (player.isAlive ? 'Alive' : 'Dead');

            card.appendChild(name);
            card.appendChild(status);

            // Show vote count during day phase (show number for every player)
            if (isDay) {
                const voteCount = document.createElement('div');
                voteCount.className = 'vote-count';
                const v = player.votes || 0;
                voteCount.textContent = v;
                voteCount.title = v === 1 ? '1 vote' : `${v} votes`;
                card.appendChild(voteCount);
            }

            // Avatar: role icon for current player, anonymous SVG for others
            if (player.id === currentPlayerId && gameState.roleImage) {
                const icon = document.createElement('img');
                icon.className = 'role-icon';
                icon.src = gameState.roleImage;
                icon.alt = gameState.role;
                card.appendChild(icon);
            } else {
                const anonymous = document.createElement('span');
                anonymous.className = 'player-card-avatar';
                anonymous.setAttribute('aria-hidden', 'true');
                anonymous.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80" width="60" height="60" fill="none"><use href="#anonymous-avatar"/></svg>';
                card.appendChild(anonymous);
            }

            // Add action buttons during night phase (mafia: no Kill button on teammates)
            const isMafiaTeammate = gameState.role === 'mafia' && gameState.mafiaTeammateIds && gameState.mafiaTeammateIds.includes(player.id);
            if (isNight && canAct && player.isAlive && !isCurrentPlayer(player.id) && !isMafiaTeammate) {
                const actionBtn = this.createActionButton(player.id, gameState.role);
                if (actionBtn) {
                    card.appendChild(actionBtn);
                }
            } else if (isNight && canAct && gameState.role === 'doctor' && isCurrentPlayer(player.id)) {
                // Doctor can protect themselves
                const actionBtn = this.createActionButton(player.id, 'doctor');
                if (actionBtn) {
                    card.appendChild(actionBtn);
                }
            }

            // Add vote button during day phase
            if (isDay && canAct && player.isAlive && !isCurrentPlayer(player.id)) {
                const voteBtn = this.createVoteButton(player.id);
                card.appendChild(voteBtn);
            }

            grid.appendChild(card);
        });
        // Only run entrance animation when first showing the grid (not on every phase/vote update)
        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.animatePlayerCards && !this._playerCardsAnimatedOnce && players.length > 0) {
            this._playerCardsAnimatedOnce = true;
            const cards = grid.querySelectorAll('.player-card');
            GSAPAnimations.animatePlayerCards(cards);
        }
    }

    /**
     * Create action button for night phase
     */
    createActionButton(targetId, role) {
        if (!role || role === 'citizen') return null;

        const btn = document.createElement('button');
        btn.className = 'player-action-btn';
        btn.dataset.targetId = targetId;
        
        let btnText = '';
        let btnClass = '';
        
        switch (role) {
            case 'mafia':
                btnText = 'Kill';
                btnClass = 'action-kill';
                break;
            case 'doctor':
                btnText = 'Protect';
                btnClass = 'action-protect';
                break;
            case 'detective':
                btnText = 'Investigate';
                btnClass = 'action-investigate';
                break;
            default:
                return null;
        }
        
        btn.textContent = btnText;
        btn.classList.add(btnClass);
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleNightAction(targetId, role);
        });
        
        return btn;
    }

    /**
     * Create vote button for day phase — selects this player; user must click Submit Vote to confirm
     */
    createVoteButton(targetId) {
        const btn = document.createElement('button');
        btn.className = 'player-action-btn action-vote';
        btn.textContent = 'Vote';
        btn.dataset.targetId = targetId;
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (gameState.phase !== 'day' || !gameState.canPerformAction()) return;
            gameState.selectedTarget = targetId;
            document.querySelectorAll('#vote-targets .target-btn').forEach(b => {
                b.classList.toggle('selected', (b.dataset.targetId || '') === targetId);
            });
            const submitBtn = document.getElementById('submit-vote-btn');
            if (submitBtn) submitBtn.focus();
        });
        
        return btn;
    }

    /**
     * Check if night action target is already investigated or protected; show toast and return true if should block
     */
    checkAlreadyInvestigatedOrProtected(targetId, role) {
        const targetPlayer = gameState.players.find(p => p.id === targetId);
        const name = targetPlayer ? targetPlayer.name : 'This player';
        if (role === 'detective' && gameState.investigationResults && targetId in gameState.investigationResults) {
            const isMafia = gameState.investigationResults[targetId];
            const result = isMafia ? 'is Mafia' : 'is not Mafia';
            if (typeof showToast === 'function') showToast(`Already investigated. ${name} ${result}`, 'info');
            return true;
        }
        if (role === 'doctor' && gameState.doctorProtectedTargetId === targetId) {
            if (typeof showToast === 'function') showToast(`Already protected. ${name} is protected`, 'info');
            return true;
        }
        return false;
    }

    /**
     * Handle night action
     */
    handleNightAction(targetId, role) {
        if (!gameState.canPerformAction() || gameState.phase !== 'night') return;
        if (this.checkAlreadyInvestigatedOrProtected(targetId, role)) return;

        socketClient.sendNightAction(gameState.roomCode, role, targetId);
        if (role === 'doctor') gameState.doctorProtectedTargetId = targetId;
        if (role !== 'mafia') gameState.markActionSubmitted();

        this.updateActionPanel();
        this.renderPlayerCards(gameState.players, gameState.playerId);

        const targetPlayer = gameState.players.find(p => p.id === targetId);
        if (targetPlayer) {
            const actionNames = { 'mafia': 'eliminate', 'doctor': 'protect', 'detective': 'investigate' };
            console.log(`✅ Action submitted: ${actionNames[role]} ${targetPlayer.name}`);
        }
    }

    /**
     * Handle vote
     */
    handleVote(targetId) {
        if (gameState.phase !== 'day') return;
        if (!gameState.canPerformAction()) return;
        const id = targetId !== undefined && targetId !== null ? targetId : null;
        if (!gameState.roomCode) return;
        socketClient.sendVote(gameState.roomCode, id);
        gameState.markActionSubmitted();
        
        // Update UI
        this.updateActionPanel();
        this.renderPlayerCards(gameState.players, gameState.playerId);
        
        if (id === null) {
            console.log(`✅ Vote skipped`);
        } else {
            const targetPlayer = gameState.players.find(p => p.id === id);
            if (targetPlayer) {
                console.log(`✅ Vote submitted for: ${targetPlayer.name}`);
            }
        }
    }

    /**
     * Update phase indicator
     * @param {number} [nightNumber] - Current night number (1, 2, 3...)
     */
    updatePhaseIndicator(phase, timeRemaining, nightNumber) {
        const phaseText = document.getElementById('phase-text');
        const timer = document.getElementById('timer');
        const indicator = document.getElementById('phase-indicator');

        if (phaseText) {
            if (phase === 'night' && nightNumber) {
                phaseText.textContent = `NIGHT ${nightNumber}`;
            } else {
                phaseText.textContent = phase.toUpperCase();
            }
        }

        if (indicator) {
            indicator.className = `phase-indicator ${phase}`;
            if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.phasePulse) {
                GSAPAnimations.phasePulse(indicator, phase);
            }
        }

        if (timer) {
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            if (typeof GSAPAnimations !== 'undefined') {
                if (timeRemaining <= 10 && timeRemaining > 0 && GSAPAnimations.timerUrgency) {
                    GSAPAnimations.timerUrgency(timeRemaining, timer);
                } else if (GSAPAnimations.timerUrgencyStop) {
                    GSAPAnimations.timerUrgencyStop(timer);
                }
            }
        }
    }

    /**
     * Show role card modal (with GSAP animation when available)
     */
    showRoleCard(role, roleImage) {
        const modal = document.getElementById('role-modal');
        const content = document.getElementById('role-card-content');
        
        if (!modal || !content) return;

        content.innerHTML = `
            <img src="${roleImage}" alt="${role}" class="role-card-image">
            <h2 class="role-card-title">${role.toUpperCase()}</h2>
        `;

        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.showModal) {
            GSAPAnimations.showModal(modal, modal.querySelector('.modal-content'));
        } else {
            modal.classList.remove('hidden');
        }
    }

    /**
     * Hide role card modal (with GSAP animation when available)
     */
    hideRoleCard() {
        const modal = document.getElementById('role-modal');
        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.hideModal) {
            GSAPAnimations.hideModal(modal);
        } else if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Update action panel based on phase and role
     */
    updateActionPanel() {
        const nightActions = document.getElementById('night-actions');
        const dayActions = document.getElementById('day-actions');
        const detectiveAction = document.getElementById('detective-action');
        const doctorAction = document.getElementById('doctor-action');
        const mafiaAction = document.getElementById('mafia-action');

        // Hide all actions
        if (nightActions) nightActions.classList.add('hidden');
        if (dayActions) dayActions.classList.add('hidden');
        if (detectiveAction) detectiveAction.classList.add('hidden');
        if (doctorAction) doctorAction.classList.add('hidden');
        if (mafiaAction) mafiaAction.classList.add('hidden');

        if (!gameState.isAlive()) return;

        if (gameState.phase === 'night') {
            if (nightActions) nightActions.classList.remove('hidden');
            const nightMsg = document.getElementById('night-no-actions-msg');
            if (nightMsg) nightMsg.classList.add('hidden');
            const nightActionUsedMsg = document.getElementById('night-action-used-msg');
            if (gameState.role === 'detective' && detectiveAction) {
                detectiveAction.classList.remove('hidden');
                if (gameState.canPerformAction()) {
                    if (nightActionUsedMsg) nightActionUsedMsg.classList.add('hidden');
                    this.renderTargetList('detective-targets', gameState.getTargetablePlayers());
                } else {
                    if (nightActionUsedMsg) nightActionUsedMsg.classList.remove('hidden');
                    detectiveAction.querySelector('.target-list') && (detectiveAction.querySelector('.target-list').innerHTML = '');
                }
            } else if (gameState.role === 'doctor' && doctorAction) {
                doctorAction.classList.remove('hidden');
                if (gameState.canPerformAction()) {
                    if (nightActionUsedMsg) nightActionUsedMsg.classList.add('hidden');
                    this.renderTargetList('doctor-targets', gameState.getTargetablePlayers());
                } else {
                    if (nightActionUsedMsg) nightActionUsedMsg.classList.remove('hidden');
                    doctorAction.querySelector('.target-list') && (doctorAction.querySelector('.target-list').innerHTML = '');
                }
            } else if (gameState.role === 'mafia' && mafiaAction) {
                mafiaAction.classList.remove('hidden');
                this.renderMafiaKillVotes(gameState.mafiaKillVotes || []);
                if (gameState.canPerformAction()) {
                    if (nightActionUsedMsg) nightActionUsedMsg.classList.add('hidden');
                    this.renderTargetList('mafia-targets', gameState.getTargetablePlayers());
                } else {
                    if (nightActionUsedMsg) nightActionUsedMsg.classList.remove('hidden');
                    mafiaAction.querySelector('.target-list') && (mafiaAction.querySelector('.target-list').innerHTML = '');
                }
            }
            const finishNightBtn = document.getElementById('finish-night-btn');
            if (finishNightBtn) {
                if (gameState.nightCanFinish) {
                    finishNightBtn.classList.remove('hidden');
                    finishNightBtn.disabled = false;
                } else {
                    finishNightBtn.classList.add('hidden');
                    finishNightBtn.disabled = true;
                }
            }
        } else if (gameState.phase === 'day') {
            if (dayActions) dayActions.classList.remove('hidden');
            const finishNightBtn = document.getElementById('finish-night-btn');
            if (finishNightBtn) {
                finishNightBtn.classList.add('hidden');
                finishNightBtn.disabled = true;
            }
            this.renderVoteBreakdown(gameState.voteBreakdown || []);
            this.renderVoteList('vote-targets', gameState.getTargetablePlayers());
            const submitVoteBtn = document.getElementById('submit-vote-btn');
            if (submitVoteBtn) {
                if (gameState.canPerformAction()) {
                    submitVoteBtn.classList.remove('hidden');
                    submitVoteBtn.disabled = false;
                } else {
                    submitVoteBtn.classList.add('hidden');
                    submitVoteBtn.disabled = true;
                }
            }
        } else {
            const finishNightBtn = document.getElementById('finish-night-btn');
            if (finishNightBtn) {
                finishNightBtn.classList.add('hidden');
                finishNightBtn.disabled = true;
            }
        }
    }

    /**
     * Render mafia kill votes (mafia only — who voted to kill whom this night)
     */
    renderMafiaKillVotes(votes) {
        const container = document.getElementById('mafia-kill-votes');
        if (!container) return;
        if (!votes || votes.length === 0) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        container.classList.remove('hidden');
        container.innerHTML = '<p class="mafia-votes-title">Kill votes this night:</p>';
        votes.forEach(v => {
            const line = document.createElement('div');
            line.className = 'mafia-vote-line';
            line.textContent = `${v.voterName} → ${v.targetName}`;
            container.appendChild(line);
        });
    }

    /**
     * Render day vote breakdown (who voted for whom — visible to all players)
     */
    renderVoteBreakdown(breakdown) {
        const container = document.getElementById('vote-breakdown');
        if (!container) return;
        if (!breakdown || breakdown.length === 0) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }
        container.classList.remove('hidden');
        container.innerHTML = '<p class="vote-breakdown-title">Who voted for whom:</p>';
        breakdown.forEach(v => {
            const line = document.createElement('div');
            line.className = 'vote-breakdown-line';
            line.textContent = `${v.voterName} → ${v.targetName}`;
            container.appendChild(line);
        });
        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.animateVoteBreakdownLines) {
            GSAPAnimations.animateVoteBreakdownLines(container);
        }
    }

    /**
     * Render target list for actions (legacy - for separate action panel)
     */
    renderTargetList(containerId, players) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        players.forEach(player => {
            const btn = document.createElement('button');
            btn.className = 'target-btn';
            btn.textContent = player.name;
            btn.dataset.targetId = player.id;
            btn.addEventListener('click', () => {
                this.selectTarget(containerId, player.id);
            });
            container.appendChild(btn);
        });
    }

    /**
     * Render vote list with skip option — select target first, then user clicks Submit Vote
     */
    renderVoteList(containerId, players) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        const selectVoteTarget = (targetId) => {
            gameState.selectedTarget = targetId === 'null' || targetId === '' ? null : targetId;
            document.querySelectorAll('#vote-targets .target-btn').forEach(btn => {
                btn.classList.toggle('selected', (btn.dataset.targetId || '') === (targetId || ''));
            });
        };

        // Add skip button
        const skipBtn = document.createElement('button');
        skipBtn.className = 'target-btn skip-btn';
        skipBtn.textContent = 'Skip Vote';
        skipBtn.dataset.targetId = '';
        skipBtn.addEventListener('click', () => selectVoteTarget(null));
        container.appendChild(skipBtn);

        // Add player buttons
        players.forEach(player => {
            const btn = document.createElement('button');
            btn.className = 'target-btn';
            btn.textContent = player.name;
            btn.dataset.targetId = player.id;
            btn.addEventListener('click', () => selectVoteTarget(player.id));
            container.appendChild(btn);
        });
    }

    /**
     * Select a target (legacy method for separate action panel)
     */
    selectTarget(containerId, targetId) {
        // Remove previous selection
        document.querySelectorAll('.target-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Mark selected
        const btn = document.querySelector(`[data-target-id="${targetId}"]`);
        if (btn) {
            btn.classList.add('selected');
            gameState.selectedTarget = targetId;
        }

        // Submit action based on context (night: send immediately; day: use Submit Vote button instead)
        if (gameState.phase === 'night' && gameState.canPerformAction()) {
            const action = gameState.role;
            if (this.checkAlreadyInvestigatedOrProtected(targetId, action)) return;
            socketClient.sendNightAction(gameState.roomCode, action, targetId);
            if (action === 'doctor') gameState.doctorProtectedTargetId = targetId;
            gameState.markActionSubmitted();
            this.updateActionPanel();
            this.renderPlayerCards(gameState.players, gameState.playerId);
        }
    }

    /**
     * Add chat message
     */
    addChatMessage(playerId, playerName, message, chatType) {
        const messagesContainer = chatType === 'mafia'
            ? document.getElementById('mafia-messages')
            : document.getElementById('public-messages');
        
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${chatType === 'mafia' ? 'mafia' : ''}`;
        
        const author = document.createElement('span');
        author.className = 'message-author';
        author.textContent = playerName + ':';
        
        const text = document.createElement('span');
        text.className = 'message-text';
        text.textContent = message;

        messageDiv.appendChild(author);
        messageDiv.appendChild(text);
        messagesContainer.appendChild(messageDiv);
        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.chatMessageIn) {
            GSAPAnimations.chatMessageIn(messageDiv);
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Show moderator message (with GSAP animate in/out when available)
     */
    showModeratorMessage(message) {
        const container = document.getElementById('moderator-messages');
        if (!container) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'moderator-message';
        messageDiv.textContent = message;
        
        container.innerHTML = '';
        container.appendChild(messageDiv);

        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.moderatorMessageInOut) {
            GSAPAnimations.moderatorMessageInOut(messageDiv, 5000);
        } else {
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.style.opacity = '0';
                    setTimeout(() => {
                        if (messageDiv.parentNode) messageDiv.remove();
                    }, 500);
                }
            }, 5000);
        }
    }

    /**
     * Update vote counts
     */
    updateVotes(votes) {
        votes.forEach(voteData => {
            const player = gameState.players.find(p => p.id === voteData.id);
            if (player) {
                player.votes = voteData.votes || 0;
            }
        });
        this.renderPlayerCards(gameState.players, gameState.playerId);
    }

    /**
     * Show game end screen
     */
    showGameEnd(winner, reason, playerRole) {
        const endTitle = document.getElementById('end-title');
        const endMessage = document.getElementById('end-message');
        const endRoleDisplay = document.getElementById('end-role-display');

        if (endTitle) {
            if (winner === 'draw') {
                endTitle.textContent = 'Draw!';
                endTitle.style.color = '#FFA500';
            } else {
                const isWinner = (winner === 'citizens' && (playerRole === 'citizen' || playerRole === 'detective' || playerRole === 'doctor')) ||
                    (winner === 'mafia' && playerRole === 'mafia');
                endTitle.textContent = isWinner ? 'Victory!' : 'Defeat!';
                endTitle.style.color = isWinner ? '#D32F2F' : '#FFFFFF';
            }
        }

        if (endMessage) {
            endMessage.textContent = reason;
        }

        if (endRoleDisplay && gameState.roleImage) {
            endRoleDisplay.innerHTML = `
                <p>Your role was:</p>
                <img src="${gameState.roleImage}" alt="${gameState.role}" class="role-card-image">
                <h3 class="role-card-title">${gameState.role.toUpperCase()}</h3>
            `;
        }

        this.showScreen('end');
    }

    /**
     * Show/hide Mafia chat tab
     */
    toggleMafiaChat(show) {
        const mafiaTab = document.getElementById('mafia-chat-tab');
        const mafiaChat = document.getElementById('mafia-chat');
        
        if (mafiaTab) {
            if (show) {
                mafiaTab.classList.remove('hidden');
            } else {
                mafiaTab.classList.add('hidden');
            }
        }

        if (mafiaChat && !show) {
            mafiaChat.classList.remove('active');
            document.getElementById('public-chat').classList.add('active');
        }
    }

    /**
     * Update round number
     */
    updateRound(round) {
        const roundEl = document.getElementById('round-number');
        if (roundEl) {
            roundEl.textContent = `Round ${round}`;
        }
    }

    /**
     * Display available rooms list
     */
    displayRoomsList(rooms) {
        const listContainer = document.getElementById('rooms-list');
        if (!listContainer) return;

        if (rooms.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">No available rooms. Create one to get started!</p>';
            return;
        }

        listContainer.innerHTML = '';

        rooms.forEach(room => {
            const roomItem = document.createElement('div');
            roomItem.className = `room-item ${!room.canJoin ? 'disabled' : ''}`;
            
            const info = document.createElement('div');
            info.className = 'room-item-info';
            
            const code = document.createElement('div');
            code.className = 'room-item-code';
            code.textContent = room.roomCode;
            
            const details = document.createElement('div');
            details.className = 'room-item-details';
            details.innerHTML = `
                <span>👥 ${room.playerCount}/${room.maxPlayers}</span>
                <span class="room-item-status ${room.phase}">${room.phase === 'lobby' ? 'Lobby' : 'Playing'}</span>
            `;
            
            info.appendChild(code);
            info.appendChild(details);
            
            const action = document.createElement('div');
            action.className = 'room-item-action';
            if (room.canJoin) {
                const joinBtn = document.createElement('button');
                joinBtn.className = 'btn btn-primary';
                joinBtn.textContent = 'Join';
                joinBtn.style.padding = '6px 12px';
                joinBtn.style.fontSize = '12px';
                joinBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.joinRoomFromList(room.roomCode);
                });
                action.appendChild(joinBtn);
            } else {
                action.innerHTML = '<span style="color: rgba(255,255,255,0.5); font-size: 12px;">In Game</span>';
            }
            
            roomItem.appendChild(info);
            roomItem.appendChild(action);
            
            if (room.canJoin) {
                roomItem.addEventListener('click', () => {
                    this.joinRoomFromList(room.roomCode);
                });
            }
            
            listContainer.appendChild(roomItem);
        });
        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.animateRoomListItems) {
            const items = listContainer.querySelectorAll('.room-item');
            if (items.length) GSAPAnimations.animateRoomListItems(items);
        }
    }

    /**
     * Join room from rooms list
     */
    joinRoomFromList(roomCode) {
        // Switch to join tab
        const joinTab = document.getElementById('join-tab');
        if (joinTab) {
            joinTab.click();
        }

        // Fill in room code
        const roomCodeInput = document.getElementById('room-code-input');
        if (roomCodeInput) {
            roomCodeInput.value = roomCode;
        }

        // Check room status
        socketClient.checkRoom(roomCode);
    }

    /**
     * Show voting dialog when day phase starts
     */
    showVotingDialog(players) {
        const modal = document.getElementById('vote-dialog-modal');
        const playersContainer = document.getElementById('vote-dialog-players');
        const confirmBtn = document.getElementById('vote-dialog-confirm-btn');
        const skipBtn = document.getElementById('vote-dialog-skip-btn');
        const status = document.getElementById('vote-dialog-status');
        const dayActions = document.getElementById('day-actions');

        if (!modal || !playersContainer) return;

        // Clear previous selection
        gameState.selectedVoteTarget = null;
        confirmBtn.disabled = true;

        // Clear and render players
        playersContainer.innerHTML = '';
        const aliveEnemies = players.filter(p => p.isAlive && p.id !== gameState.playerId);
        
        if (aliveEnemies.length === 0) {
            // No other alive players to vote for
            playersContainer.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5);">No other players to vote for</p>';
            confirmBtn.disabled = true;
            skipBtn.disabled = false;
        } else {
            aliveEnemies.forEach(player => {
                const btn = document.createElement('button');
                btn.className = 'vote-dialog-player';
                btn.dataset.playerId = player.id;
                btn.innerHTML = `
                    <span>${player.name}</span>
                    <span class="vote-dialog-player-check" style="display: none;">✓</span>
                `;
                btn.addEventListener('click', () => {
                    // Unselect previous
                    playersContainer.querySelectorAll('.vote-dialog-player').forEach(b => {
                        b.classList.remove('selected');
                        b.querySelector('.vote-dialog-player-check').style.display = 'none';
                    });
                    // Select this one
                    btn.classList.add('selected');
                    btn.querySelector('.vote-dialog-player-check').style.display = 'inline';
                    gameState.selectedVoteTarget = player.id;
                    confirmBtn.disabled = false;
                });
                playersContainer.appendChild(btn);
            });
        }

        // Hide status initially
        if (status) {
            status.classList.add('hidden');
            status.textContent = '';
        }

        // Enable skip button always
        skipBtn.disabled = false;

        // Hide old day-actions UI (legacy voting interface)
        if (dayActions) {
            dayActions.classList.add('hidden');
        }

        if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.showModal) {
            GSAPAnimations.showModal(modal, modal.querySelector('.modal-content'));
        } else {
            modal.classList.remove('hidden');
        }
    }

    /**
     * Hide voting dialog
     */
    hideVotingDialog() {
        const modal = document.getElementById('vote-dialog-modal');
        const dayActions = document.getElementById('day-actions');
        
        if (modal) {
            if (typeof GSAPAnimations !== 'undefined' && GSAPAnimations.hideModal) {
                GSAPAnimations.hideModal(modal);
            } else {
                modal.classList.add('hidden');
            }
        }
        
        // Restore day-actions if needed (in case voting continues or UI needs it)
        if (dayActions && gameState.phase === 'day') {
            dayActions.classList.remove('hidden');
        }
    }

    /**
     * Show vote submitted status
     */
    showVoteSubmittedStatus(playersRemaining) {
        const status = document.getElementById('vote-dialog-status');
        if (!status) return;
        
        status.classList.remove('hidden');
        status.classList.add('success');
        status.classList.remove('waiting');
        status.textContent = playersRemaining > 0
            ? `✓ Vote submitted! Waiting for ${playersRemaining} more (vote or skip)...`
            : `✓ All players voted or skipped! Phase ending...`;
    }

    /**
     * Show players waiting message
     */
    showVotingWaitingStatus(playersRemaining) {
        const status = document.getElementById('vote-dialog-status');
        if (!status) return;
        
        status.classList.remove('hidden');
        status.classList.remove('success');
        status.classList.add('waiting');
        status.textContent = `⏳ Waiting for ${playersRemaining} more player(s) to vote or skip...`;
    }
}

// Export singleton instance
const uiManager = new UIManager();

