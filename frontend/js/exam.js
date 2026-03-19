class ExamManager {
    constructor(user) {
        this.user = user;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.violations = 0;
        this.maxViolations = 3;
        this.timeRemaining = 3600; // 1 hour total
        this.timerInterval = null;
        this.editor = null;
        
        // JEE Exam State
        this.questionStates = []; // 'unvisited', 'answered', 'skipped'
        this.selectedOptions = {}; // { questionIndex: optionIndex }
        this.codeAnswers = {}; // { questionIndex: codeString }
        this.waitInterval = null;
        this.eventInfo = null;
    }

    async start() {
        try {
            document.documentElement.requestFullscreen();
        } catch(e) { console.log('Fullscreen failed', e) }
        
        try {
            this.eventInfo = await ApiService.getEventInfo();
            this.questions = await ApiService.getQuestions();
            if (this.questions.length === 0) {
                alert("No questions found for this event.");
                return;
            }
            
            this.questionStates = new Array(this.questions.length).fill('unvisited');
            this.setupAntiCheat();
            this.startTimer();
            
            this.renderExamLayout();
            this.renderCurrentQuestion();
        } catch (error) {
            alert('Failed to load exam: ' + error.message);
        }
    }

    setupAntiCheat() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.handleViolation();
        });

        document.getElementById('btn-acknowledge-warning').addEventListener('click', () => {
            document.getElementById('warning-modal').classList.add('hidden');
        });

        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('copy', e => e.preventDefault());
        document.addEventListener('paste', e => e.preventDefault());
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && this.timeRemaining > 0 && document.getElementById('exam-main-area')) {
                alert("Exiting fullscreen is a violation!");
                this.handleViolation();
            }
        });
    }

    handleViolation() {
        this.violations++;
        const modal = document.getElementById('warning-modal');
        const warningText = document.getElementById('violation-count');
        
        warningText.textContent = `Violations: ${this.violations}/${this.maxViolations}`;
        modal.classList.remove('hidden');

        if (this.violations >= this.maxViolations) {
            alert('Maximum violations reached. Auto-submitting exam.');
            this.finishExam();
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (this.timeRemaining <= 0) {
                clearInterval(this.timerInterval);
                alert('Time is up! Auto-submitting exam.');
                this.finishExam();
                return;
            }
            
            this.timeRemaining--;
            const mins = Math.floor(this.timeRemaining / 60).toString().padStart(2, '0');
            const secs = (this.timeRemaining % 60).toString().padStart(2, '0');
            
            const timerEl = document.getElementById('timer-display');
            if (timerEl) timerEl.textContent = `${mins}:${secs}`;

        }, 1000);
    }

    renderExamLayout() {
        const appEl = document.getElementById('app');
        appEl.innerHTML = `
            <div class="exam-header glass-panel" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h2>${this.eventInfo.name || 'Exam'}</h2>
                    <span style="color: var(--text-secondary)">Candidate: ${this.user.username}</span>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <div class="timer" id="timer-display">
                        ${Math.floor(this.timeRemaining / 60).toString().padStart(2, '0')}:${(this.timeRemaining % 60).toString().padStart(2, '0')}
                    </div>
                    <button class="btn" style="background: rgba(255,0,60,0.2); color: var(--danger); border: 1px solid var(--danger);" onclick="examManager.finishExam()">Submit Exam</button>
                </div>
            </div>
            <div class="exam-split-layout">
                <div class="exam-left-pane glass-panel" id="exam-main-area" style="position: relative;">
                    <!-- Question Content Injected Here -->
                </div>
                <div class="exam-right-pane glass-panel">
                    <h3 style="margin-bottom: 1rem; font-size: 1.1rem; text-align: center;">Question Palette</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; font-size: 0.8rem; justify-content: center;">
                        <span style="display:flex; align-items:center; gap:0.25rem;"><div style="width:12px; height:12px; background:rgba(13,240,67,0.2); border:1px solid var(--success)"></div> Answered</span>
                        <span style="display:flex; align-items:center; gap:0.25rem;"><div style="width:12px; height:12px; background:rgba(255,0,60,0.2); border:1px solid var(--danger)"></div> Skipped</span>
                        <span style="display:flex; align-items:center; gap:0.25rem;"><div style="width:12px; height:12px; background:rgba(255,255,255,0.1);"></div> Unvisited</span>
                    </div>
                    <div class="question-grid" id="question-grid">
                        <!-- Grid items go here -->
                    </div>
                </div>
            </div>
        `;
    }

    renderQuestionGrid() {
        const grid = document.getElementById('question-grid');
        if (!grid) return;
        
        let html = '';
        this.questions.forEach((q, idx) => {
            const state = this.questionStates[idx];
            let statusClass = 'status-unvisited';
            if (state === 'answered') statusClass = 'status-answered';
            if (state === 'skipped') statusClass = 'status-skipped';
            if (idx === this.currentQuestionIndex) statusClass += ' status-current';
            
            html += `<div class="grid-item ${statusClass}" onclick="examManager.jumpToQuestion(${idx})">${idx + 1}</div>`;
        });
        grid.innerHTML = html;
    }

    renderWaitScreen(targetDate, roundName) {
        const mainArea = document.getElementById('exam-main-area');
        mainArea.innerHTML = `
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%;">
                <h2>Waiting for ${roundName}...</h2>
                <p>Scheduled Start: ${targetDate.toLocaleString()}</p>
                <h3 id="round-countdown" style="margin: 2rem 0; font-size: 3rem; color: var(--accent);">--:--</h3>
                <p style="color: var(--text-secondary);">The section will unlock automatically.</p>
            </div>
        `;
        
        if (this.waitInterval) clearInterval(this.waitInterval);
        this.waitInterval = setInterval(() => {
            const timeLeft = Math.floor((targetDate - new Date()) / 1000);
            if (timeLeft <= 0) {
                clearInterval(this.waitInterval);
                this.renderCurrentQuestion();
            } else {
                const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                const s = (timeLeft % 60).toString().padStart(2, '0');
                const cdEl = document.getElementById('round-countdown');
                if (cdEl) cdEl.textContent = `${m}:${s}`;
            }
        }, 1000);
    }

    renderCurrentQuestion() {
        if (this.waitInterval) clearInterval(this.waitInterval);
        if (this.editor) { 
            this.editor.dispose(); 
            this.editor = null; 
        }

        const q = this.questions[this.currentQuestionIndex];
        const mainArea = document.getElementById('exam-main-area');

        // Update state to skipped if unvisited
        if (this.questionStates[this.currentQuestionIndex] === 'unvisited') {
            this.questionStates[this.currentQuestionIndex] = 'skipped';
        }
        this.renderQuestionGrid();

        // Time Locks
        if (q.type === 'mcq' && this.eventInfo.startTime) {
            const r1Start = new Date(this.eventInfo.startTime);
            if (new Date() < r1Start) return this.renderWaitScreen(r1Start, 'Round 1');
        }
        if (q.type === 'coding' && this.eventInfo.round2StartTime) {
            const r2Start = new Date(this.eventInfo.round2StartTime);
            if (new Date() < r2Start) return this.renderWaitScreen(r2Start, 'Round 2');
        }

        let contentHtml = `
            <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: var(--accent); margin: 0;">Question ${this.currentQuestionIndex + 1}</h3>
                <span class="badge" style="background: rgba(255,255,255,0.1); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${q.type.toUpperCase()}</span>
            </div>
            <div style="font-size: 1.1rem; margin-bottom: 2rem; line-height: 1.6;">${q.text}</div>
        `;

        // Render input bounds based on type
        contentHtml += `<div style="flex: 1; display: flex; flex-direction: column; overflow-y: auto;">`;
        if (q.type === 'mcq') {
            let optionsHtml = '';
            q.options.forEach((opt, idx) => {
                const isSelected = this.selectedOptions[this.currentQuestionIndex] === idx;
                optionsHtml += `<div class="mcq-option ${isSelected ? 'selected' : ''}" onclick="examManager.selectOptionLocally(${idx})">${opt.text}</div>`;
            });
            contentHtml += `<div id="options-container">${optionsHtml}</div>`;
        } else if (q.type === 'coding') {
            contentHtml += `
                <div id="editor-container" style="min-height: 350px; margin-bottom: 1rem;"></div>
                <div class="console-output hidden" id="console"></div>
                <div><button class="btn" style="background: rgba(255,255,255,0.8); color: #000;" onclick="examManager.runCode()">Run Code Templates</button></div>
            `;
        }
        contentHtml += `</div>`;

        // Navigation Footer
        contentHtml += `
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <button class="btn" onclick="examManager.navigate(-1)" ${this.currentQuestionIndex === 0 ? 'disabled' : ''}>Previous</button>
                    <button class="btn" onclick="examManager.clearResponse()" style="margin-left: 0.5rem; border-color: var(--text-secondary); color: var(--text-secondary);">Clear</button>
                </div>
                <button class="btn primary" onclick="examManager.saveAndNext()">${this.currentQuestionIndex === this.questions.length - 1 ? 'Save Details' : 'Save & Next'}</button>
            </div>
        `;

        mainArea.innerHTML = contentHtml;

        if (q.type === 'coding') {
            const savedCode = this.codeAnswers[this.currentQuestionIndex] || q.initialCode || '// Write your code here';
            this.setupMonaco(savedCode);
        }
    }

    selectOptionLocally(optIdx) {
        this.selectedOptions[this.currentQuestionIndex] = optIdx;
        const opts = document.querySelectorAll('.mcq-option');
        opts.forEach((o, i) => {
            if (i === optIdx) o.classList.add('selected');
            else o.classList.remove('selected');
        });
    }

    clearResponse() {
        if (this.questions[this.currentQuestionIndex].type === 'mcq') {
            delete this.selectedOptions[this.currentQuestionIndex];
        } else if (this.editor) {
            this.editor.setValue(this.questions[this.currentQuestionIndex].initialCode || '');
            delete this.codeAnswers[this.currentQuestionIndex];
        }
        this.questionStates[this.currentQuestionIndex] = 'skipped';
        this.renderCurrentQuestion();
    }

    async saveAndNext() {
        const q = this.questions[this.currentQuestionIndex];
        
        try {
            if (q.type === 'mcq') {
                const optIdx = this.selectedOptions[this.currentQuestionIndex];
                if (optIdx !== undefined) {
                    await ApiService.submitMcq({ questionId: q._id, selectedOptionIndex: optIdx, timeTaken: 1 });
                    this.questionStates[this.currentQuestionIndex] = 'answered';
                }
            } else if (q.type === 'coding') {
                if (this.editor) {
                    const code = this.editor.getValue();
                    this.codeAnswers[this.currentQuestionIndex] = code;
                    await ApiService.submitCode({ code, questionId: q._id, timeTaken: 1 });
                    this.questionStates[this.currentQuestionIndex] = 'answered';
                }
            }
        } catch(e) { console.error('Save error', e); }

        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.navigate(1);
        } else {
            this.renderQuestionGrid();
            alert('Response saved! You can submit the exam from the top right when ready.');
        }
    }

    navigate(direction) {
        this._saveLocalCodeState();
        let newIdx = this.currentQuestionIndex + direction;
        if (newIdx >= 0 && newIdx < this.questions.length) {
            this.currentQuestionIndex = newIdx;
            this.renderCurrentQuestion();
        }
    }

    jumpToQuestion(index) {
        if (index === this.currentQuestionIndex) return;
        this._saveLocalCodeState();
        this.currentQuestionIndex = index;
        this.renderCurrentQuestion();
    }

    _saveLocalCodeState() {
        if (this.questions[this.currentQuestionIndex] && this.questions[this.currentQuestionIndex].type === 'coding' && this.editor) {
            this.codeAnswers[this.currentQuestionIndex] = this.editor.getValue();
        }
    }

    setupMonaco(initialCode) {
        if (!window.require) { console.error('Monaco loader not attached'); return; }
        
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs' }});
        require(['vs/editor/editor.main'], () => {
            const container = document.getElementById('editor-container');
            if(container) {
                this.editor = monaco.editor.create(container, {
                    value: initialCode,
                    language: 'javascript',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono'
                });
            }
        });
    }

    async runCode() {
        if(!this.editor) return;
        const code = this.editor.getValue();
        const q = this.questions[this.currentQuestionIndex];
        const consoleEl = document.getElementById('console');
        
        consoleEl.classList.remove('hidden');
        consoleEl.textContent = 'Running...';

        try {
             const res = await ApiService.runCode({ code, questionId: q._id });
             let outputHtml = '';
             res.results.forEach((tc, idx) => {
                 outputHtml += `Test Case ${idx + 1}: ${tc.passed ? '✅ Passed' : '❌ Failed'}\n`;
                 if (!tc.passed) {
                     outputHtml += `  Input: ${tc.input}\n  Expected: ${tc.expectedOutput}\n  Actual: ${tc.actualOutput}\n\n`;
                 }
             });
             consoleEl.textContent = outputHtml || "No test cases configured.";
        } catch (e) {
             consoleEl.textContent = `Error: ${e.message}`;
        }
    }

    async finishExam() {
        if (!confirm('Are you sure you want to completely submit your exam?')) return;
        
        clearInterval(this.timerInterval);
        if (this.waitInterval) clearInterval(this.waitInterval);
        
        try {
             await ApiService.request('/leaderboard/calculate', {
                 method: 'POST',
                 body: {
                     violationCount: this.violations,
                     totalTime: 3600 - this.timeRemaining
                 }
             });

             if (window.confetti) {
                 confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
             }

             document.getElementById('app').innerHTML = `
                 <div class="glass-panel" style="text-align: center; max-width: 600px; margin: 10vh auto;">
                     <h2>🎉 Exam Completed!</h2>
                     <p>Your answers have been securely recorded.</p>
                     <p>Time Taken: ${3600 - this.timeRemaining} seconds</p>
                     <p>Violations: ${this.violations}</p>
                     <button class="btn primary" onclick="app.init()" style="margin-top: 1rem;">Go to Dashboard</button>
                 </div>
             `;
        } catch(e) { alert('Error finalizing exam: ' + e.message); }
    }
}

window.ExamManager = ExamManager;
