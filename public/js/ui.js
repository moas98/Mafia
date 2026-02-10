/**
 * UI management and DOM updates
 */
class UIManager {
    constructor() {
        this.currentScreen = 'landing';
    }

    /**
     * Show a specific screen
     */
    showScreen(screenName) {
        console.log('🖥️ Switching to screen:', screenName);
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenName;
            console.log('✅ Screen switched to:', screenName);
        } else {
            console.error('❌ Screen not found:', `${screenName}-screen`);
        }
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
            players.forEach((player, index) => {
                const li = document.createElement('li');
                li.textContent = player.name || `Player ${index + 1}`;
                if (player.isAlive === false) {
                    li.style.opacity = '0.5';
                    li.textContent += ' (Dead)';
                }
                list.appendChild(li);
            });
        }

        if (count) {
            const oldCount = count.textContent;
            count.textContent = players.length;
            console.log(`✅ Player count updated: ${oldCount} → ${players.length}`);
            
            // Force a re-render check
            if (count.textContent !== String(players.length)) {
                console.error('❌ Player count element not updating!');
                count.textContent = players.length;
            }
        } else {
            console.error('❌ Player count element not found!');
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
        
        players.forEach(player => {
            const card = document.createElement('div');
            card.className = `player-card ${!player.isAlive ? 'dead' : ''}`;
            card.dataset.playerId = player.id;

            const name = document.createElement('div');
            name.className = 'player-name';
            name.textContent = player.name;

            const status = document.createElement('div');
            status.className = 'player-status';
            status.textContent = player.isAlive ? 'Alive' : 'Dead';

            card.appendChild(name);
            card.appendChild(status);

            // Show vote count during day phase
            if (player.votes > 0) {
                const voteCount = document.createElement('div');
                voteCount.className = 'vote-count';
                voteCount.textContent = player.votes;
                card.appendChild(voteCount);
            }

            // Show role icon if it's the current player
            if (player.id === currentPlayerId && gameState.roleImage) {
                const icon = document.createElement('img');
                icon.className = 'role-icon';
                icon.src = gameState.roleImage;
                icon.alt = gameState.role;
                card.appendChild(icon);
            }

            grid.appendChild(card);
        });
    }

    /**
     * Update phase indicator
     */
    updatePhaseIndicator(phase, timeRemaining) {
        const phaseText = document.getElementById('phase-text');
        const timer = document.getElementById('timer');
        const indicator = document.getElementById('phase-indicator');

        if (phaseText) {
            phaseText.textContent = phase.toUpperCase();
        }

        if (indicator) {
            indicator.className = `phase-indicator ${phase}`;
        }

        if (timer) {
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }

    /**
     * Show role card modal
     */
    showRoleCard(role, roleImage) {
        const modal = document.getElementById('role-modal');
        const content = document.getElementById('role-card-content');
        
        if (!modal || !content) return;

        content.innerHTML = `
            <img src="${roleImage}" alt="${role}" class="role-card-image">
            <h2 class="role-card-title">${role.toUpperCase()}</h2>
        `;

        modal.classList.remove('hidden');
    }

    /**
     * Hide role card modal
     */
    hideRoleCard() {
        const modal = document.getElementById('role-modal');
        if (modal) {
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
            
            if (gameState.role === 'detective' && detectiveAction) {
                detectiveAction.classList.remove('hidden');
                this.renderTargetList('detective-targets', gameState.getTargetablePlayers());
            } else if (gameState.role === 'doctor' && doctorAction) {
                doctorAction.classList.remove('hidden');
                this.renderTargetList('doctor-targets', gameState.getTargetablePlayers());
            } else if (gameState.role === 'mafia' && mafiaAction) {
                mafiaAction.classList.remove('hidden');
                this.renderTargetList('mafia-targets', gameState.getTargetablePlayers());
            }
        } else if (gameState.phase === 'day') {
            if (dayActions) dayActions.classList.remove('hidden');
            this.renderTargetList('vote-targets', gameState.getTargetablePlayers());
        }
    }

    /**
     * Render target list for actions
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
     * Select a target
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

        // Submit action based on context
        if (gameState.phase === 'night' && gameState.canPerformAction()) {
            const action = gameState.role;
            socketClient.sendNightAction(gameState.roomCode, action, targetId);
            gameState.markActionSubmitted();
            this.updateActionPanel();
        } else if (gameState.phase === 'day' && gameState.canPerformAction()) {
            socketClient.sendVote(gameState.roomCode, targetId);
            gameState.markActionSubmitted();
            this.updateActionPanel();
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
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    /**
     * Show moderator message
     */
    showModeratorMessage(message) {
        const container = document.getElementById('moderator-messages');
        if (!container) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'moderator-message';
        messageDiv.textContent = message;
        
        container.innerHTML = '';
        container.appendChild(messageDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.opacity = '0';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 500);
            }
        }, 5000);
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
            const isWinner = (winner === 'citizens' && (playerRole === 'citizen' || playerRole === 'detective' || playerRole === 'doctor')) ||
                           (winner === 'mafia' && playerRole === 'mafia');
            endTitle.textContent = isWinner ? 'Victory!' : 'Defeat!';
            endTitle.style.color = isWinner ? '#D32F2F' : '#FFFFFF';
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
}

// Export singleton instance
const uiManager = new UIManager();
