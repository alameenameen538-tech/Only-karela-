const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

app.use(express.static('public'));

const MSG_FILE = path.join(__dirname, 'messages.json');
let roomMessages = {
    'Kerala Chat Room': [],
    'LoFi Room': [],
    'Game Room': [],
    'hanu ameen secret room 💗': []
};

if (fs.existsSync(MSG_FILE)) {
    try {
        roomMessages = JSON.parse(fs.readFileSync(MSG_FILE, 'utf8'));
    } catch (e) {}
}

function saveMessagesToFile() {
    try {
        fs.writeFileSync(MSG_FILE, JSON.stringify(roomMessages, null, 2));
    } catch (e) {}
}

const registeredUsers = {
    'ameen': 'kl133250',
    'owner': 'kl133250'
};

const activeSessions = {};
const users = {};
const dynamicAdmins = new Set();
const mutedUsers = {};
const kickedUsers = new Set();
const stories = [
    { id: 'st_1', name: 'Picasso', dp: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
    { id: 'st_2', name: 'Shan', dp: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=100' }
];

let staffRoomPassword = "a26h31";

function getModData() {
    const mutedList = [];
    const now = Date.now();
    for (const [u, exp] of Object.entries(mutedUsers)) {
        if (exp > now) {
            mutedList.push({ username: u, timeLeft: Math.ceil((exp - now) / 1000) });
        }
    }
    return {
        muted: mutedList,
        kicked: Array.from(kickedUsers)
    };
}

io.on('connection', (socket) => {
    socket.emit('staff password updated', staffRoomPassword);
    socket.emit('load stories', stories);

    socket.on('register user', (data) => {
        const u = (data.username || '').toLowerCase().trim();
        const p = data.password || '';

        if (!u || !p) return socket.emit('auth response', { success: false, msg: 'Username, Password നൽകണം!' });
        if (registeredUsers[u]) return socket.emit('auth response', { success: false, msg: 'ഈ പേര് നിലവിൽ രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്!' });

        registeredUsers[u] = p;
        socket.emit('auth response', { success: true, msg: 'രജിസ്ട്രേഷൻ വിജയകരം! ഇനി ലോഗിൻ ചെയ്യുക.' });
    });

    socket.on('authenticate user', (data) => {
        const u = (data.username || '').toLowerCase().trim();
        const p = data.password || '';

        if (kickedUsers.has(u)) {
            return socket.emit('auth response', { success: false, msg: '⛔ നിങ്ങളെ ഓണർ കിക്ക്/ബാൻ ചെയ്തിരിക്കുന്നു!' });
        }

        if (!registeredUsers[u]) return socket.emit('auth response', { success: false, msg: 'അക്കൗണ്ട് നിലവിലില്ല! Register ചെയ്യുക.' });
        if (registeredUsers[u] !== p) return socket.emit('auth response', { success: false, msg: '❌ തെറ്റായ പാസ്‌വേർഡ്!' });

        if (activeSessions[u] && activeSessions[u] !== socket.id) {
            io.to(activeSessions[u]).emit('force disconnect', 'മറ്റൊരു ഡിവൈസിൽ ഈ അക്കൗണ്ട് ലോഗിൻ ചെയ്യപ്പെട്ടു!');
        }
        activeSessions[u] = socket.id;

        const role = (u === 'ameen' || u === 'owner') ? 'Owner' : (dynamicAdmins.has(u) ? 'Admin' : 'Member');
        socket.emit('auth response', { success: true, username: u, role: role });
    });

    socket.on('join', (data) => {
        const lower = (data.name || '').toLowerCase().trim();
        if (kickedUsers.has(lower)) {
            return socket.emit('force disconnect', '⛔ നിങ്ങളെ ഓണർ ചാറ്റിൽ നിന്നും പുറത്താക്കിയിരിക്കുകയാണ്.');
        }

        socket.currentRoom = data.room || 'Kerala Chat Room';
        socket.join(socket.currentRoom);
        
        let role = data.clientRole || 'Member';
        if (lower === 'ameen' || lower === 'owner') role = 'Owner';
        else if (dynamicAdmins.has(lower)) role = 'Admin';

        const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

        users[socket.id] = { 
            id: socket.id,
            name: data.name, 
            avatar: data.avatar, 
            room: socket.currentRoom,
            role: role,
            isVip: isOwnerOrAdmin ? true : (data.isVip || false)
        };

        io.to(socket.currentRoom).emit('update users', Object.values(users).filter(u => u.room === socket.currentRoom));
        socket.emit('load room messages', roomMessages[socket.currentRoom] || []);
    });

    socket.on('switch room', (newRoom) => {
        if (!users[socket.id]) return;
        const prevRoom = socket.currentRoom;
        socket.leave(prevRoom);
        socket.join(newRoom);
        socket.currentRoom = newRoom;
        users[socket.id].room = newRoom;

        if (!roomMessages[newRoom]) roomMessages[newRoom] = [];

        io.to(prevRoom).emit('update users', Object.values(users).filter(u => u.room === prevRoom));
        io.to(newRoom).emit('update users', Object.values(users).filter(u => u.room === newRoom));
        socket.emit('load room messages', roomMessages[newRoom]);
    });

    
    socket.on("delete chat message", (msgId) => {
      const u = users[socket.id];
      const isOwnerOrVip = u && (u.role === "Owner" || u.isVip);
      if (!isOwnerOrVip) {
        return socket.emit("mute warning", "⛔ മെസ്സേജ് ഡിലീറ്റ് ചെയ്യാൻ VIP അല്ലെങ്കിൽ Owner ആവണം!");
      }
      if (socket.currentRoom && roomMessages[socket.currentRoom]) {
        roomMessages[socket.currentRoom] = roomMessages[socket.currentRoom].filter(m => m.id !== msgId);
      }
      io.to(socket.currentRoom || "Kerala Chat Room").emit("message deleted", msgId);
    });

    socket.on('chat message', (msgData) => {
        const user = users[socket.id] || { name: 'Anonymous', avatar: '', isVip: false, role: 'Member' };
        const uLower = user.name.toLowerCase().trim();

        if (mutedUsers[uLower] && Date.now() < mutedUsers[uLower]) {
            const timeLeftSec = Math.ceil((mutedUsers[uLower] - Date.now()) / 1000);
            return socket.emit('mute warning', `നിങ്ങളെ മ്യൂട്ട് ചെയ്തിരിക്കുന്നു! ബാക്കി സമയം: ${timeLeftSec} സെക്കൻഡ്.`);
        }

        const room = socket.currentRoom || 'Kerala Chat Room';
        let type = 'text';
        let content = '';
        let replyTo = null;

        if (typeof msgData === 'object') {
            type = msgData.type || 'text';
            content = msgData.content || msgData.text || '';
            replyTo = msgData.replyTo || null;
        } else {
            content = msgData;
        }

        const now = new Date();
        const timeFormatted = `${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        const messageData = {
            id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            user: user.name,
            type: type,
            content: content,
            text: content,
            replyTo: replyTo,
            time: timeFormatted,
            avatar: user.avatar,
            role: user.role,
            isVip: user.isVip,
            room: room
        };

        if (!roomMessages[room]) roomMessages[room] = [];
        roomMessages[room].push(messageData);

        if (roomMessages[room].length > 200) roomMessages[room].shift();
        saveMessagesToFile();

        io.to(room).emit('chat message', messageData);
    });

    socket.on('add story', (storyObj) => {
        stories.unshift(storyObj);
        if (stories.length > 15) stories.pop();
        io.emit('load stories', stories);
    });

    socket.on('toggle admin role', (targetSocketId) => {
        const currentUser = users[socket.id];
        if (currentUser && currentUser.role === 'Owner') {
            const target = users[targetSocketId];
            if (target && target.role !== 'Owner') {
                const targetLower = target.name.toLowerCase().trim();
                if (dynamicAdmins.has(targetLower)) {
                    dynamicAdmins.delete(targetLower);
                    target.role = 'Member';
                } else {
                    dynamicAdmins.add(targetLower);
                    target.role = 'Admin';
                    target.isVip = true;
                }
                io.to(targetSocketId).emit('role updated', { role: target.role, isVip: target.isVip });
                io.to(target.room).emit('update users', Object.values(users).filter(u => u.room === target.room));
            }
        }
    });

    socket.on('kick user', (targetSocketId) => {
        const currentUser = users[socket.id];
        if (currentUser && currentUser.role === 'Owner') {
            const target = users[targetSocketId];
            if (target && target.role !== 'Owner') {
                const lower = target.name.toLowerCase().trim();
                kickedUsers.add(lower);
                io.to(targetSocketId).emit('force disconnect', '⛔ നിങ്ങളെ ഓണർ റൂമിൽ നിന്ന് Kick / Ban ചെയ്തിരിക്കുന്നു!');
            }
        }
    });

    socket.on('mute user', ({ targetSocketId, durationMinutes }) => {
        const currentUser = users[socket.id];
        if (currentUser && currentUser.role === 'Owner') {
            const target = users[targetSocketId];
            if (target && target.role !== 'Owner') {
                const targetLower = target.name.toLowerCase().trim();
                const unmuteAt = Date.now() + (durationMinutes * 60 * 1000);
                mutedUsers[targetLower] = unmuteAt;
                io.to(targetSocketId).emit('mute warning', `നിങ്ങളെ ${durationMinutes} മിനിറ്റിലേക്ക് ഓണർ Mute ചെയ്തിരിക്കുന്നു.`);
            }
        }
    });

    socket.on('unmute user', (username) => {
        const currentUser = users[socket.id];
        if (currentUser && currentUser.role === 'Owner') {
            const u = (username || '').toLowerCase().trim();
            delete mutedUsers[u];
            socket.emit('mod data update', getModData());
        }
    });

    socket.on('unkick user', (username) => {
        const currentUser = users[socket.id];
        if (currentUser && currentUser.role === 'Owner') {
            const u = (username || '').toLowerCase().trim();
            kickedUsers.delete(u);
            socket.emit('mod data update', getModData());
        }
    });

    socket.on('get mod data', () => {
        const currentUser = users[socket.id];
        if (currentUser && currentUser.role === 'Owner') {
            socket.emit('mod data update', getModData());
        }
    });

    socket.on('change staff password', (newPass) => {
        const user = users[socket.id];
        if (user && user.role === 'Owner') {
            if (newPass && newPass.trim().length >= 3) {
                staffRoomPassword = newPass.trim();
                io.emit('staff password updated', staffRoomPassword);
            }
        }
    });

    socket.on('delete message', (msgId) => {
        const user = users[socket.id];
        if (user && (user.role === 'Owner' || user.role === 'Admin')) {
            const room = socket.currentRoom;
            if (roomMessages[room]) {
                roomMessages[room] = roomMessages[room].filter(m => m.id !== msgId);
                saveMessagesToFile();
                io.to(room).emit('message deleted', msgId);
            }
        }
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const r = users[socket.id].room;
            const uName = (users[socket.id].name || '').toLowerCase().trim();
            if (activeSessions[uName] === socket.id) delete activeSessions[uName];
            delete users[socket.id];
            io.to(r).emit('update users', Object.values(users).filter(u => u.room === r));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
