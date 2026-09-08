const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e7
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Persistent History Storage
const HISTORY_FILE = path.join(__dirname, 'chat_history.json');
let roomMessages = { "Kerala Chat Room": [], "hanu ameen secret room 💗": [] };

try {
  if (fs.existsSync(HISTORY_FILE)) {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    roomMessages = Object.assign(roomMessages, data);
  }
} catch (e) {
  console.log("History file read error, using fallback memory");
}

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(roomMessages), 'utf8');
  } catch (e) {}
}

let staffRoomPassword = "staff123";
const users = {};

io.on('connection', (socket) => {
  socket.emit('staff password updated', staffRoomPassword);

  socket.on('authenticate user', ({ username, password }) => {
    let role = 'Member';
    if (username.toLowerCase() === 'ameen') role = 'Owner';
    else if (username.toLowerCase() === 'admin') role = 'Admin';
    socket.emit('auth response', { success: true, username, role });
  });

  socket.on('join', ({ name, avatar, room, isVip, clientRole }) => {
    const targetRoom = room || 'Kerala Chat Room';
    socket.currentRoom = targetRoom;
    socket.join(targetRoom);

    let role = clientRole || 'Member';
    if (name && name.toLowerCase() === 'ameen') role = 'Owner';

    users[socket.id] = { name, avatar, role, isVip, room: targetRoom };

    // സെൻഡ് റൂം ഹിസ്റ്ററി
    if (!roomMessages[targetRoom]) roomMessages[targetRoom] = [];
    socket.emit('load room messages', roomMessages[targetRoom]);

    broadcastUsers(targetRoom);
  });

  socket.on('switch room', (newRoom) => {
    if (socket.currentRoom) socket.leave(socket.currentRoom);
    socket.currentRoom = newRoom;
    socket.join(newRoom);

    if (users[socket.id]) users[socket.id].room = newRoom;

    if (!roomMessages[newRoom]) roomMessages[newRoom] = [];
    socket.emit('load room messages', roomMessages[newRoom]);

    broadcastUsers(newRoom);
  });

  
  socket.on('typing', (data) => {
    const room = socket.currentRoom || 'Kerala Chat Room';
    // secret room-ൽ ടൈപ്പ് ചെയ്യുമ്പോൾ മാത്രം മറ്റുള്ളവർക്ക് അയക്കുന്നു
    if (room === 'hanu ameen secret room 💗') {
      socket.to(room).emit('user typing', { user: data.user, isTyping: data.isTyping });
    }
  });

  socket.on('chat message', (data) => {
    const u = users[socket.id] || { name: 'User', avatar: '', role: 'Member', isVip: false };
    const room = socket.currentRoom || 'Kerala Chat Room';
    if (!roomMessages[room]) roomMessages[room] = [];

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgObj = {
      id: data.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      user: u.name,
      avatar: u.avatar || data.avatar,
      role: u.role,
      isVip: u.isVip,
      type: data.type || 'text',
      content: data.content,
      replyTo: data.replyTo || null,
      time: timeStr
    };

    roomMessages[room].push(msgObj);
    if (roomMessages[room].length > 150) roomMessages[room].shift();
    saveHistory();

    io.to(room).emit('chat message', msgObj);
  });

  socket.on('delete chat message', (msgId) => {
    const u = users[socket.id];
    const isOwnerOrVip = u && (u.role === 'Owner' || u.isVip);
    if (!isOwnerOrVip) {
      return socket.emit('mute warning', '⛔ മെസ്സേജ് ഡിലീറ്റ് ചെയ്യാൻ VIP അല്ലെങ്കിൽ Owner ആവണം!');
    }
    const room = socket.currentRoom || 'Kerala Chat Room';
    if (roomMessages[room]) {
      roomMessages[room] = roomMessages[room].filter(m => m.id !== msgId);
      saveHistory();
    }
    io.to(room).emit('message deleted', msgId);
  });

  socket.on('change staff password', (newPass) => {
    const u = users[socket.id];
    if (u && u.role === 'Owner') {
      staffRoomPassword = newPass;
      io.emit('staff password updated', staffRoomPassword);
    }
  });

  socket.on('disconnect', () => {
    const r = socket.currentRoom;
    delete users[socket.id];
    if (r) broadcastUsers(r);
  });

  function broadcastUsers(room) {
    const roomUsers = Object.values(users).filter(u => u.room === room);
    io.to(room).emit('update users', roomUsers);
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
