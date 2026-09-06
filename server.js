const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

app.use(express.static('public'));

const users = {};
const stories = [];
const dynamicAdmins = new Set(); // Owner ആഡ് ചെയ്യുന്ന മോഡറേറ്റർമാർ

const roomCurrentTrack = {
    'LoFi Room': 'jfKfPfyJRdk'
};

const roomMessages = {
    'Normal Room': [],
    'LoFi Room': [],
    'Game Room': [],
    'Staff Room': []
};

const OWNERS = ['ameen', 'owner'];
const DEFAULT_ADMINS = ['admin', 'mod'];

function getRole(name) {
    const lower = (name || '').toLowerCase().trim();
    if (OWNERS.some(o => lower.includes(o))) return 'Owner';
    if (dynamicAdmins.has(lower) || DEFAULT_ADMINS.some(a => lower.includes(a))) return 'Admin';
    return 'Member';
}

io.on('connection', (socket) => {
    socket.emit('load stories', stories);

    socket.on('join', (data) => {
        socket.currentRoom = data.room || 'Normal Room';
        socket.join(socket.currentRoom);
        
        const role = getRole(data.name);
        const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

        users[socket.id] = { 
            id: socket.id,
            name: data.name, 
            avatar: data.avatar, 
            room: socket.currentRoom,
            role: role,
            isVip: isOwnerOrAdmin ? true : (data.isVip || false)
        };

        io.emit('update users all', Object.values(users));
        io.to(socket.currentRoom).emit('update users', Object.values(users).filter(u => u.room === socket.currentRoom));
        socket.emit('load room messages', roomMessages[socket.currentRoom] || []);

        if (socket.currentRoom === 'LoFi Room' && roomCurrentTrack['LoFi Room']) {
            socket.emit('play yt track', { videoId: roomCurrentTrack['LoFi Room'], sharedBy: 'LoFi Auto DJ' });
        }
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

        if (newRoom === 'LoFi Room' && roomCurrentTrack['LoFi Room']) {
            socket.emit('play yt track', { videoId: roomCurrentTrack['LoFi Room'], sharedBy: 'Current DJ' });
        }
    });

    socket.on('chat message', (msgText) => {
        const user = users[socket.id] || { name: 'Anonymous', avatar: '', isVip: false, role: 'Member' };
        const text = typeof msgText === 'object' ? msgText.text : msgText;
        const room = socket.currentRoom;

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

        io.to(room).emit('chat message', messageData);
    });

    socket.on('game broadcast', (msg) => {
        const user = users[socket.id] || { name: 'Player' };
        const room = socket.currentRoom;
        const botMsg = {
            id: 'bot_' + Date.now(),
            user: '🎲 Game Bot',
            text: `<strong>${user.name}</strong> ${msg}`,
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=gamebot',
            role: 'Bot',
            isVip: false,
            room: room
        };
        if (!roomMessages[room]) roomMessages[room] = [];
        roomMessages[room].push(botMsg);
        io.to(room).emit('chat message', botMsg);
    });

    // ഓണർക്ക് ആരെയും Moderator/Admin ആക്കാനും മാറ്റാനുമുള്ള ഫംഗ്ഷൻ
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
                
                const alertMsg = {
                    id: 'mod_' + Date.now(),
                    user: '👑 System Alert',
                    text: `📢 <strong>${target.name}</strong> has been made <strong>${target.role === 'Admin' ? 'MODERATOR 🛡️' : 'MEMBER'}</strong> by Owner!`,
                    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ownerbot',
                    role: 'Bot',
                    room: target.room
                };
                io.to(target.room).emit('chat message', alertMsg);
            }
        }
    });

    socket.on('delete message', (msgId) => {
        const user = users[socket.id];
        if (user && (user.role === 'Owner' || user.role === 'Admin')) {
            const room = socket.currentRoom;
            if (roomMessages[room]) {
                roomMessages[room] = roomMessages[room].filter(m => m.id !== msgId);
                io.to(room).emit('message deleted', msgId);
            }
        }
    });

    socket.on('share yt track', (videoId) => {
        const user = users[socket.id] || { name: 'Someone' };
        roomCurrentTrack[socket.currentRoom] = videoId;
        io.to(socket.currentRoom).emit('play yt track', { videoId: videoId, sharedBy: user.name });
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const r = users[socket.id].room;
            delete users[socket.id];
            io.to(r).emit('update users', Object.values(users).filter(u => u.room === r));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
