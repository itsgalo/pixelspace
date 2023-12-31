const http = require('http');
const app = require('./app');
let Player = require('./Player');
let myPort = process.env.PORT || 3000;

app.set('port', myPort);

const server = http.createServer(app);
server.on('listening', ()=> {
  console.log('listening on port 3000');
});

server.listen(myPort, "0.0.0.0");

//web sockets
const socket = require('socket.io');
const io = socket(server);
let players = [];
//let lineBuffer = [];

//setInterval(updateGame, 1600);

io.sockets.on('connection', newConnection);

function newConnection(socket) {
  //console.log('new connection! ' + socket.id);
  //create new user
  players.push(new Player(socket.id));
  io.emit('heartbeat', players);
  //io.emit('oldLines', lineBuffer);
  //if(players.length > 1) {
    //io.emit('newCanvas', canvasBuffer);
  //}
  //io.sockets.emit('connected', {connections: totalUsers});
  //socket.broadcast.emit('new user', {user: thisID, users:totalUsers});
  socket.on('disconnect', () => {
    //console.log('lost player');
    io.sockets.emit('disconnect', socket.id);
    players = players.filter(player => player.id !== socket.id);
    //lineBuffer = lineBuffer.filter(line => line.id !== socket.id);
    //console.log(lineBuffer.length);
  });
  //this listens for mouse function in sketch.js
  socket.on('mouse', mouseMessage);

  function mouseMessage(data) {
    socket.broadcast.emit('mouse', data);
  }

  socket.on('cursor', cursorMessage);
  
  function cursorMessage(cursorProps) {
    io.emit('cursor', {
      id: socket.id,
      coords: cursorProps
    });
  }
}

//io.sockets.on('disconnect', socket => {
  //console.log('lost another');
  //io.sockets.emit('disconnect', socket.id);

  //players = players.filter(player.id !== socket.id);
//});

//function updateGame() {
  //io.sockets.emit('heartbeat', players);
//}
