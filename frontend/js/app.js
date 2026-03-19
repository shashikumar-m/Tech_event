class App {
    constructor() {
        this.appElement = document.getElementById('app');
        this.user = JSON.parse(localStorage.getItem('user'));
        this.theme = localStorage.getItem('theme') || 'dark';
        if (this.theme === 'light') document.body.classList.add('light-mode');
        this.init();
    }

    toggleTheme() {
        if (this.theme === 'dark') {
            this.theme = 'light';
            document.body.classList.add('light-mode');
        } else {
            this.theme = 'dark';
            document.body.classList.remove('light-mode');
        }
        localStorage.setItem('theme', this.theme);
        const icon = document.getElementById('theme-toggle');
        if (icon) icon.textContent = this.theme === 'light' ? '☀️' : '🌙';
    }

    init() {
        if (!this.user) {
            this.renderLogin();
        } else if (this.user.role === 'admin') {
            this.renderAdminDashboard();
        } else {
            if (window.socket) window.socket.emit('student_login');
            this.renderStudentDashboard();
        }
    }

    logout() {
        if (this.user && this.user.role === 'student' && window.socket) {
            window.socket.emit('student_logout');
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.user = null;
        this.renderLogin();
    }

    renderNavbar(title) {
        return `
            <nav class="navbar glass-panel">
                <div class="nav-brand">${title}</div>
                <div style="display:flex; gap:1rem; align-items:center;">
                    <button class="btn" id="theme-toggle" onclick="app.toggleTheme()" style="padding: 0.25rem 0.5rem; font-size: 1.25rem;">${this.theme === 'light' ? '☀️' : '🌙'}</button>
                    <button class="btn primary" onclick="app.logout()" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Logout</button>
                </div>
            </nav>
        `;
    }

    renderLogin() {
        this.appElement.innerHTML = `
            <div class="auth-container glass-panel">
                <h2>Welcome Back</h2>
                <p>Login to access the platform</p>
                <form id="login-form">
                    <div class="form-group">
                        <label>Role</label>
                        <select id="role" class="form-control" onchange="app.toggleEventIdField()">
                            <option value="student">Student</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div class="form-group" id="eventIdGroup">
                        <label>Event ID</label>
                        <input type="text" id="eventId" class="form-control" placeholder="E.g., EVT-2026">
                    </div>
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="username" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="password" class="form-control" required>
                    </div>
                    <button type="submit" class="btn primary" style="width: 100%">Login</button>
                    <p id="login-error" style="color: var(--danger); margin-top: 1rem; display: none;"></p>
                </form>
            </div>
        `;

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const role = document.getElementById('role').value;
            const eventId = document.getElementById('eventId').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const data = await ApiService.login({ username, password, eventId });
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                this.user = data.user;
                this.init();
            } catch (error) {
                const errEl = document.getElementById('login-error');
                errEl.textContent = error.message;
                errEl.style.display = 'block';
            }
        });
    }

    toggleEventIdField() {
        const role = document.getElementById('role').value;
        const eventIdGroup = document.getElementById('eventIdGroup');
        eventIdGroup.style.display = role === 'admin' ? 'none' : 'block';
    }

    renderAdminDashboard() {
        this.appElement.innerHTML = `
            ${this.renderNavbar('Admin Dashboard')}
            <div class="glass-panel" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div id="live-stats" style="color: var(--success); font-weight: bold; display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width:10px; height:10px; background:var(--success); border-radius:50%; box-shadow: 0 0 10px var(--success);"></div>
                    Active Students: <span id="active-student-count">0</span>
                </div>
                <div style="display:flex; gap:1rem; align-items:center; flex: 0.8;">
                    <input type="text" id="broadcastMsg" class="form-control" placeholder="Broadcast message to all active students...">
                    <button class="btn primary" onclick="app.broadcast()">Send Broadcast</button>
                </div>
            </div>
            <div class="glass-panel" style="margin-bottom: 1rem;">
                <div class="tabs-nav">
                    <button class="tab-btn active" onclick="app.switchAdminTab('events')">Events</button>
                    <button class="tab-btn" onclick="app.switchAdminTab('students')">Students</button>
                    <button class="tab-btn" onclick="app.switchAdminTab('questions')">Questions</button>
                    <button class="tab-btn" onclick="app.switchAdminTab('settings')">Settings</button>
                    <button class="tab-btn" onclick="app.switchAdminTab('results')">Results</button>
                </div>
                <div id="admin-tab-content">
                    <!-- Tab content injected here -->
                </div>
            </div>
        `;
        this.switchAdminTab('events');
    }

    broadcast() {
        const msg = document.getElementById('broadcastMsg').value;
        if(msg && window.socket) {
            window.socket.emit('admin_broadcast', msg);
            document.getElementById('broadcastMsg').value = '';
            alert('Broadcast sent!');
        }
    }

    async switchAdminTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.textContent.toLowerCase().includes(tabName)) btn.classList.add('active');
        });
        
        const contentArea = document.getElementById('admin-tab-content');
        contentArea.innerHTML = '<p>Loading...</p>';
        
        try {
            if (tabName === 'events') await this.renderEventsTab(contentArea);
            else if (tabName === 'students') await this.renderStudentsTab(contentArea);
            else if (tabName === 'questions') await this.renderQuestionsTab(contentArea);
            else if (tabName === 'settings') await this.renderSettingsTab(contentArea);
            else if (tabName === 'results') {
                contentArea.innerHTML = `
                    <h3>View Results</h3>
                    <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                        <input type="text" id="viewEventId" class="form-control" placeholder="Enter Event ID to view results" style="flex: 1;">
                        <button class="btn primary" onclick="app.fetchLeaderboard()">Fetch Results</button>
                    </div>
                    <div id="leaderboard-results" style="background: rgba(0,0,0,0.4); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--glass-border); min-height: 200px;">
                        <p style="color: var(--text-secondary); text-align: center;">Results will appear here...</p>
                    </div>
                `;
            }
        } catch(e) { contentArea.innerHTML = `<p style="color:var(--danger)">Error: ${e.message}</p>`; }
    }

    async renderEventsTab(container) {
        const events = await ApiService.request('/admin/events');
        
        let html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <h3>Create Event</h3>
                    <form id="create-event-form" onsubmit="app.handleCreateEvent(event)">
                        <div class="form-group"><label>Event Name</label><input type="text" id="eventName" class="form-control" required></div>
                        <div class="form-group"><label>Event ID (Code)</label><input type="text" id="newEventId" class="form-control" required></div>
                        <div class="form-group"><label>Round 1 Start Time</label><input type="datetime-local" id="startTime" class="form-control" required></div>
                        <div class="form-group"><label>Total Duration (Minutes)</label><input type="number" id="duration" class="form-control" required></div>
                        <button type="submit" class="btn primary">Create Event</button>
                    </form>
                </div>
                <div>
                    <h3>Active Events</h3>
                    <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; max-height: 400px; overflow-y: auto;">
        `;
        
        if (events.length === 0) html += `<p>No events found.</p>`;
        else {
            events.forEach(e => {
                html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid var(--glass-border);">
                        <div><strong>${e.name}</strong> (${e.eventId})</div>
                        <button class="btn" style="color: var(--danger); border: 1px solid var(--danger); padding: 0.25rem 0.5rem;" onclick="app.deleteEvent('${e.eventId}')">Delete</button>
                    </div>
                `;
            });
        }
        
        html += `</div></div></div>`;
        container.innerHTML = html;
    }

    async handleCreateEvent(e) {
        e.preventDefault();
        try {
            await ApiService.request('/admin/events', {
                method: 'POST',
                body: {
                    name: document.getElementById('eventName').value,
                    eventId: document.getElementById('newEventId').value,
                    startTime: document.getElementById('startTime').value,
                    duration: document.getElementById('duration').value
                }
            });
            alert('Event Created!');
            this.switchAdminTab('events');
        } catch(err) { alert(err.message); }
    }

    async deleteEvent(eventId) {
        if (!confirm('Are you sure you want to delete this event and all associated data?')) return;
        try {
            await ApiService.request(`/admin/events/${eventId}`, { method: 'DELETE' });
            alert('Event deleted');
            this.switchAdminTab('events');
        } catch(e) { alert(e.message); }
    }

    async renderStudentsTab(container) {
        const events = await ApiService.request('/admin/events');
        let options = events.map(e => `<option value="${e.eventId}">${e.name} (${e.eventId})</option>`).join('');
        
        container.innerHTML = `
            <div style="max-width: 600px;">
                <h3>Bulk Add Students</h3>
                <form id="add-student-form" onsubmit="app.handleAddStudent(event)">
                    <div class="form-group">
                        <label>Select Event</label>
                        <select id="targetEventId" class="form-control" required>
                            <option value="">-- Choose Event --</option>
                            ${options}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Students Data (1 per line format: <code>username,password,email@domain.com</code>)</label>
                        <textarea id="bulkStudentsData" class="form-control" rows="6" placeholder="john_doe, secret123, john@gmail.com\njane_doe, pass456, jane@gmail.com" required></textarea>
                    </div>
                    <button type="submit" class="btn primary">Add Students</button>
                </form>
            </div>
        `;
    }

    async handleAddStudent(e) {
        e.preventDefault();
        try {
            const rawData = document.getElementById('bulkStudentsData').value;
            const lines = rawData.split('\\n').map(l => l.trim()).filter(l => l !== '');
            const users = lines.map(line => {
                const parts = line.split(',').map(p => p.trim());
                if(parts.length < 2) throw new Error("Invalid format on line: " + line);
                return {
                    username: parts[0],
                    password: parts[1],
                    email: parts[2] || ''
                };
            });

            await ApiService.request('/admin/users', {
                method: 'POST',
                body: {
                    eventId: document.getElementById('targetEventId').value,
                    users: users
                }
            });
            alert(`${users.length} Student(s) Added Successfully! Emails will be sent if configured.`);
            document.getElementById('bulkStudentsData').value = '';
        } catch(err) { alert(err.message); }
    }

    async renderQuestionsTab(container) {
        const events = await ApiService.request('/admin/events');
        let options = events.map(e => `<option value="${e.eventId}">${e.name} (${e.eventId})</option>`).join('');

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <h3>Add Question</h3>
                    <form id="add-question-form" onsubmit="app.handleAddQuestion(event)">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>Target Event</label>
                                <select id="qEventId" class="form-control" required onchange="app.loadQuestionsList()"><option value="">-- Select Event --</option>${options}</select>
                            </div>
                            <div class="form-group">
                                <label>Round / Type</label>
                                <select id="qType" class="form-control" onchange="app.toggleQuestionFields()">
                                    <option value="mcq">Round 1 (MCQ)</option>
                                    <option value="coding">Round 2 (Coding)</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group"><label>Question Text</label><textarea id="qText" class="form-control" rows="3" required></textarea></div>
                        <div id="mcq-fields">
                            <div class="form-group"><label>Option 1</label><input type="text" class="form-control q-opt"></div>
                            <div class="form-group"><label>Option 2</label><input type="text" class="form-control q-opt"></div>
                            <div class="form-group"><label>Option 3</label><input type="text" class="form-control q-opt"></div>
                            <div class="form-group"><label>Option 4</label><input type="text" class="form-control q-opt"></div>
                            <div class="form-group"><label>Correct Option Index (0-3)</label><input type="number" id="qCorrectIdx" min="0" max="3" class="form-control"></div>
                        </div>
                        <div id="coding-fields" style="display: none;">
                            <div class="form-group"><label>Initial Code Template</label><textarea id="qInitialCode" class="form-control" rows="4"></textarea></div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group"><label>Test Input</label><input type="text" id="qInput" class="form-control"></div>
                                <div class="form-group"><label>Expected Output</label><input type="text" id="qOutput" class="form-control"></div>
                            </div>
                        </div>
                        <button type="submit" class="btn primary">Add Question</button>
                    </form>
                </div>
                <div>
                    <h3>Questions for Selected Event</h3>
                    <div id="q-list-container" style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; min-height: 200px;">
                        <p style="color:var(--text-secondary)">Please select an event to view questions.</p>
                    </div>
                </div>
            </div>
        `;
    }

    toggleQuestionFields() {
        const type = document.getElementById('qType').value;
        if(document.getElementById('mcq-fields')) document.getElementById('mcq-fields').style.display = type === 'mcq' ? 'block' : 'none';
        if(document.getElementById('coding-fields')) document.getElementById('coding-fields').style.display = type === 'coding' ? 'block' : 'none';
    }

    async handleAddQuestion(e) {
        e.preventDefault();
        try {
            const type = document.getElementById('qType').value;
            const payload = { eventId: document.getElementById('qEventId').value, type, text: document.getElementById('qText').value };
            if (type === 'mcq') {
                const opts = document.querySelectorAll('.q-opt');
                payload.options = Array.from(opts).map((opt, i) => ({ text: opt.value, isCorrect: i == document.getElementById('qCorrectIdx').value }));
            } else {
                payload.initialCode = document.getElementById('qInitialCode').value;
                payload.testCases = [{ input: document.getElementById('qInput').value, expectedOutput: document.getElementById('qOutput').value, isHidden: false }];
            }
            await ApiService.request('/admin/questions', { method: 'POST', body: payload });
            alert('Question Added!');
            this.loadQuestionsList();
        } catch(err) { alert(err.message); }
    }

    async loadQuestionsList() {
        const eventId = document.getElementById('qEventId').value;
        const cont = document.getElementById('q-list-container');
        if (!eventId) { cont.innerHTML = '<p>Select an event.</p>'; return; }
        
        try {
            const questions = await ApiService.request(`/admin/questions/${eventId}`);
            if (questions.length === 0) { cont.innerHTML = '<p>No questions yet.</p>'; return; }
            let html = '';
            questions.forEach((q, i) => {
                html += `<div style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);"><strong>${i+1}. [${q.type}]</strong> ${q.text.substring(0,40)}...</div>`;
            });
            cont.innerHTML = html;
        } catch(e) { cont.innerHTML = `<p>Error loading questions</p>`; }
    }

    async renderSettingsTab(container) {
        const events = await ApiService.request('/admin/events');
        let options = events.map(e => `<option value="${e.eventId}">${e.name} (${e.eventId})</option>`).join('');

        container.innerHTML = `
            <div style="max-width: 600px;">
                <h3>Timing & Settings</h3>
                <div class="form-group">
                    <label>Select Event</label>
                    <select id="settingEventId" class="form-control" onchange="app.loadEventSettings()"><option value="">-- Choose Event --</option>${options}</select>
                </div>
                <div id="settings-area" style="display:none; margin-top: 1rem;">
                    <div class="form-group">
                        <label>Round 1 (MCQ) Start Time</label>
                        <input type="datetime-local" id="manageRound1Time" class="form-control" disabled title="Set at creation. Re-create event to change.">
                    </div>
                    <div class="form-group">
                        <label>Round 2 (Coding) Start Time</label>
                        <input type="datetime-local" id="manageRound2Time" class="form-control">
                    </div>
                    <button class="btn primary" onclick="app.saveEventTiming()">Update Timing</button>
                    
                    <div style="margin-top: 2rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
                        <h4>Arrange Questions</h4>
                        <div id="questions-container" style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; max-height: 300px; overflow-y: auto;"></div>
                        <button class="btn primary" onclick="app.saveQuestionOrder()">Save Question Order</button>
                    </div>
                </div>
            </div>
        `;
    }

    async loadEventSettings() {
        const eventId = document.getElementById('settingEventId').value;
        if (!eventId) { document.getElementById('settings-area').style.display = 'none'; return; }
        
        try {
            const events = await ApiService.request('/admin/events');
            this.currentManagedEvent = events.find(e => e.eventId === eventId);
            document.getElementById('settings-area').style.display = 'block';
            
            if (this.currentManagedEvent.startTime) {
                const d = new Date(this.currentManagedEvent.startTime);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                document.getElementById('manageRound1Time').value = d.toISOString().slice(0, 16);
            }
            if (this.currentManagedEvent.round2StartTime) {
                const d = new Date(this.currentManagedEvent.round2StartTime);
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                document.getElementById('manageRound2Time').value = d.toISOString().slice(0, 16);
            } else {
                document.getElementById('manageRound2Time').value = '';
            }

            this.managedQuestions = await ApiService.request(`/admin/questions/${eventId}`);
            this.renderQuestionsOrderList();
        } catch(e) { alert(e.message); }
    }

    renderQuestionsOrderList() {
        const container = document.getElementById('questions-container');
        container.innerHTML = '';
        this.managedQuestions.forEach((q, index) => {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); border-radius: 4px;';
            div.innerHTML = `
                <div><strong>${index + 1}. [${q.type}]</strong> ${q.text.substring(0, 30)}...</div>
                <div style="display: flex; gap: 0.25rem;">
                    <button class="btn" onclick="app.moveQuestion(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="padding: 0.2rem 0.4rem;">↑</button>
                    <button class="btn" onclick="app.moveQuestion(${index}, 1)" ${index === this.managedQuestions.length - 1 ? 'disabled' : ''} style="padding: 0.2rem 0.4rem;">↓</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    moveQuestion(index, direction) {
        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < this.managedQuestions.length) {
            const temp = this.managedQuestions[index];
            this.managedQuestions[index] = this.managedQuestions[newIndex];
            this.managedQuestions[newIndex] = temp;
            this.renderQuestionsOrderList();
        }
    }

    async saveEventTiming() {
        const timeVal = document.getElementById('manageRound2Time').value;
        try {
            await ApiService.request(`/admin/events/${this.currentManagedEvent.eventId}`, {
                method: 'PUT',
                body: { round2StartTime: timeVal ? new Date(timeVal).toISOString() : null }
            });
            alert('Timing saved!');
        } catch (e) { alert(e.message); }
    }

    async saveQuestionOrder() {
        const orderedQuestions = this.managedQuestions.map((q, idx) => ({ _id: q._id, order: idx }));
        try {
            await ApiService.request('/admin/questions/order', {
                method: 'PUT',
                body: { orderedQuestions }
            });
            alert('Question order saved!');
        } catch (e) { alert(e.message); }
    }

    async fetchLeaderboard() {
        const eventId = document.getElementById('viewEventId').value;
        if (!eventId) return alert('Please enter an Event ID');

        try {
            const events = await ApiService.request('/admin/events');
            const targetEvent = events.find(e => e.eventId === eventId);
            
            if (!targetEvent) return alert('Event not found');

            const leaderboard = await ApiService.request(`/leaderboard/${targetEvent._id}`);
            
            const resultsDiv = document.getElementById('leaderboard-results');
            
            if (leaderboard.length === 0) {
                 resultsDiv.innerHTML = '<p style="text-align: center;">No attempts recorded yet.</p>';
                 return;
            }

            let html = `
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--glass-border);">
                            <th style="padding: 1rem 0.5rem; color: var(--accent);">Rank</th>
                            <th style="padding: 1rem 0.5rem; color: var(--accent);">Student</th>
                            <th style="padding: 1rem 0.5rem; color: var(--accent);">Score</th>
                            <th style="padding: 1rem 0.5rem; color: var(--accent);">Time Taken</th>
                            <th style="padding: 1rem 0.5rem; color: var(--accent);">Violations</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            leaderboard.forEach((res, idx) => {
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
                        <td style="padding: 1rem 0.5rem">#${idx + 1}</td>
                        <td style="padding: 1rem 0.5rem; font-family: 'JetBrains Mono', monospace;">${res.userId.username}</td>
                        <td style="padding: 1rem 0.5rem; color: var(--success); font-weight: bold;">${res.score}</td>
                        <td style="padding: 1rem 0.5rem">${res.totalTime}s</td>
                        <td style="padding: 1rem 0.5rem; color: ${res.violationCount > 0 ? 'var(--danger)' : 'inherit'}">${res.violationCount}</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            resultsDiv.innerHTML = html;

        } catch (err) {
            alert(err.message);
        }
    }

    renderStudentDashboard() {
        this.appElement.innerHTML = `
            ${this.renderNavbar('Student Dashboard')}
            <div class="glass-panel" style="max-width: 600px; margin: 0 auto; text-align: center;">
                <h2>Ready for the Exam?</h2>
                <p>You are registered for Event: <strong>${this.user.eventId}</strong></p>
                <div style="text-align: left; margin: 2rem 0; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                    <h3>📖 Rules</h3>
                    <ul style="margin-left: 1.5rem; margin-top: 0.5rem; color: var(--text-secondary);">
                        <li>You have limited time to complete both rounds.</li>
                        <li>Round 1: Multiple Choice Questions.</li>
                        <li>Round 2: Coding Snippets.</li>
                        <li><strong style="color: var(--warning)">Do not switch tabs.</strong> More than 3 violations will auto-submit your exam.</li>
                    </ul>
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display:flex; align-items:center; justify-content:center; gap:0.5rem; cursor:pointer;">
                        <input type="checkbox" id="agree-rules" onchange="document.getElementById('start-btn').disabled = !this.checked;">
                        <span>I understand the rules and agree to not cheat.</span>
                    </label>
                </div>
                <button id="start-btn" class="btn primary" onclick="startExamFlow()" style="font-size: 1.25rem; padding: 1rem 2rem;" disabled>Start Exam</button>
            </div>
        `;
    }
}

// Initialize App
let app;
const socket = (typeof io !== 'undefined') ? io('https://tech-event-uvmv.onrender.com') : null;
window.socket = socket;

if (socket) {
    socket.on('server_message', (msg) => {
        alert("📢 Admin Broadcast: " + msg);
    });
    
    socket.on('stats_update', (data) => {
        const countEl = document.getElementById('active-student-count');
        if (countEl) countEl.textContent = data.activeStudents;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});

// For Exam Logic Integration
function startExamFlow() {
    if (window.ExamManager) {
        window.examManager = new ExamManager(app.user);
        window.examManager.start();
    } else {
        console.error("Exam logic script not loaded yet");
    }
}
