const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static('public'));

const MSG_FILE = path.join(__dirname, 'messages.json');
let roomMessages = {
    'Kerala Chat Room': [],
    'LoFi Room': [],
    'Game Room': [],
    'Staff Room': []
};

// പഴയ മെസ്സേജുകൾ ഫയലിൽ നിന്നെടുക്കുന്നു
if (fs.existsSync(MSG_FILE)) {
    try {
        roomMessages = JSON.parse(fs.readFileSync(MSG_FILE, 'utf8'));
    } catch (e) {
        console.log('Error reading messages file');
    }
}

function saveMessagesToFile() {
    try {
        fs.writeFileSync(MSG_FILE, JSON.stringify(roomMessages, null, 2));
    } catch (e) {
        console.log('Error saving messages');
    }
}

const registeredUsers = {
    'ameen': 'kl133250',
    'owner': 'kl133250'
};

const activeSessions = {};
const users = {};
const dynamicAdmins = new Set();
let staffRoomPassword = "staff123";

io.on('connection', (socket) => {
    socket.emit('staff password updated', staffRoomPassword);

    socket.on('register user', (data) => {
        const u = (data.username || '').toLowerCase().trim();
        const p = data.password || '';

        if (!u || !p) {
            return socket.emit('auth response', { success: false, msg: 'Username, Password നൽകണം!' });
        }
        if (registeredUsers[u]) {
            return socket.emit('auth response', { success: false, msg: 'ഈ പേര് നിലവിൽ മറ്റൊരാൾ രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്!' });
        }

        registeredUsers[u] = p;
        socket.emit('auth response', { success: true, msg: 'രജിസ്ട്രേഷൻ വിജയകരം! ഇനി ലോഗിൻ ചെയ്യുക.' });
    });

    socket.on('authenticate user', (data) => {
        const u = (data.username || '').toLowerCase().trim();
        const p = data.password || '';

        if (!registeredUsers[u]) {
            return socket.emit('auth response', { success: false, msg: 'അക്കൗണ്ട് നിലവിലില്ല! Register now വഴി അക്കൗണ്ട് ഉണ്ടാക്കുക.' });
        }

        if (registeredUsers[u] !== p) {
            return socket.emit('auth response', { success: false, msg: '❌ തെറ്റായ പാസ്‌വേർഡ്!' });
        }

        if (activeSessions[u] && activeSessions[u] !== socket.id) {
            io.to(activeSessions[u]).emit('force disconnect', 'മറ്റൊരു ഡിവൈസിൽ ഈ അക്കൗണ്ട് ലോഗിൻ ചെയ്യപ്പെട്ടു!');
        }
        activeSessions[u] = socket.id;

        const role = (u === 'ameen' || u === 'owner') ? 'Owner' : (dynamicAdmins.has(u) ? 'Admin' : 'Member');
        socket.emit('auth response', { success: true, username: u, role: role });
    });

    socket.on('join', (data) => {
        socket.currentRoom = data.room || 'Kerala Chat Room';
        socket.join(socket.currentRoom);
        
        let role = data.clientRole || 'Member';
        const lower = (data.name || '').toLowerCase().trim();

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
        
        // നിലവിലെ റൂമിലെ പഴയ മെസ്സേജുകൾ അയച്ചുകൊടുക്കുന്നു
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
        
        // റൂം മാറുമ്പോൾ ആ റൂമിലെ മുൻപത്തെ മെസ്സേജുകൾ അയച്ചുകൊടുക്കുന്നു
        socket.emit('load room messages', roomMessages[newRoom]);
    });

    socket.on('chat message', (msgText) => {
        const user = users[socket.id] || { name: 'Anonymous', avatar: '', isVip: false, role: 'Member' };
        const text = typeof msgText === 'object' ? msgText.text : msgText;
        const room = socket.currentRoom || 'Kerala Chat Room';

        const messageData = {
            id: 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            user: user.name,
            text: text,
            avatar: user.avatar,
            role: user.role,
            isVip: user.isVip,
            room: room
        };

        if (!roomMessages[room]) roomMessages[room] = [];
        roomMessages[room].push(messageData);

        // പരമാവധി 200 മെസ്സേജുകൾ വരെ സൂക്ഷിക്കുന്നു
        if (roomMessages[room].length > 200) roomMessages[room].shift();
        saveMessagesToFile();

        io.to(room).emit('chat message', messageData);
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

    socket.on('toggle moderator', (targetSocketId) => {
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
            if (activeSessions[uName] === socket.id) {
                delete activeSessions[uName];
            }
            delete users[socket.id];
            io.to(r).emit('update users', Object.values(users).filter(u => u.room === r));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
