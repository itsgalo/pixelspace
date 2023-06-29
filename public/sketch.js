let socket;
let closeButton, screenButton, colorButton, linkButton;
let canvasIMG, updatedCanvas;

let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;
let DIM = Math.min(WIDTH, HEIGHT);
let M = DIM / 1000;

let cursors = [];
let players = [];
let r = rand(155);
let g = rand(20);
let b = rand(155);
let bgr = 105; //200 + rand(50);
let bgg = 179; //170;
let bgb = 231; //rand(250);
let xoff = 0.0;
let alph = 1;
let friendIsDrawing = false;
let isDrawing = false;
let thisPlayer;
let mx, my;

function setup() {
  pixelDensity(1);

  canvasIMG = createCanvas(window.windowWidth, window.windowHeight);
  background(bgr, bgg, bgb);

  socket = io.connect();
  socket.on('heartbeat', players => checkPlayers(players));
  socket.on('disconnect', playerID => removePlayer(playerID));
  socket.on('mouse', newDrawing);
  socket.on('cursor', cursorPos);

  closeButton = createButton('×');
  closeButton.position(20, 20);
  closeButton.mousePressed(resetCanvas);

  screenButton = createButton('↓');
  screenButton.position(20, windowHeight - 100);
  screenButton.mousePressed(screenShot);

  colorButton = createButton('#');
  colorButton.position(windowWidth - 90, 20);
  colorButton.mousePressed(changeColor);

  linkButton = createButton('?');
  linkButton.position(windowWidth - 90, windowHeight - 100);
  linkButton.mousePressed(goTo);
}
function goTo() {
  window.open('http://officeca.com');
}
function resetCanvas() {
  //socket.emit('removeLines', lines);
  background(bgr, bgg, bgb);
}

function screenShot() {
  saveCanvas('OurPaperSpace', 'png');
}

function newDrawing(data) {
  //draw what someone else is drawing
  drawSplat(data);
  //console.log(data.id + ' is drawing');
}

function draw() {
  mx = map(mouseX, 0, width, 0, 1);
  my = map(mouseY, 0, height, 0, 1);

  for(var i = 0; i < players.length; i++){
    fill(255);
    ellipse(players[i].x * width, players[i].y * height, 50 * M);
  }
}

function checkPlayers(serverPlayers) {
  //clears array to update players
  players = [];
  updatePlayers(serverPlayers);
  if(serverPlayers.length > 1) {
    roomEmpty = false;
  }
}

function updatePlayers(serverPlayers) {
  for (let i = 0; i < serverPlayers.length; i++) {
    let playerFromServer = serverPlayers[i];
      //if (!playerExists(playerFromServer)) {
        players.push(new Player(playerFromServer));
      //}
  }
}

function removePlayer(playerID) {
  players = players.filter(player => player.id !== playerID);
}

function cursorPos(data) {
    let cursorID = players.find(player => player.id == data.id);
    cursorID.x = data.coords.x;
    cursorID.y = data.coords.y;

    thisPlayer = players.find(player => player.id == data.id);

    if (data.coords.isDrawing == true) {
      friendIsDrawing = true;
    } else if(data.coords.isDrawing == false) {
      friendIsDrawing = false;
    }
}

function rand(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function mouseMoved() {

  let cursorProps = {
    x: mx,
    y: my,
    isDrawing: isDrawing
  }
  socket.emit('cursor', cursorProps);

}

function touchMoved(e) {
  isDrawing = true;
  let cursorProps = {
    x: mx,
    y: my,
    isDrawing: isDrawing
  }
  socket.emit('cursor', cursorProps);
  e.preventDefault();

  let data = {
    x: mx,
    y: my,
    id: socket.id,
    r: r,
    g: g,
    b: b
  }
  socket.emit('mouse', data);
  drawSplat(data);
  //send lines to server
  socket.emit('oldLines', data);
  return false;
}
function touchEnded(e) {
  isDrawing = false;
}
function mouseReleased(e) {
  isDrawing = false;
}
function mouseDragged(e) {
  isDrawing = true;

  let cursorProps = {
    x: mx,
    y: my,
    isDrawing: isDrawing
  }
  socket.emit('cursor', cursorProps);
  e.preventDefault();

  let data = {
    x: mx,
    y: my,
    id: socket.id,
    r: r,
    g: g,
    b: b
  }
  socket.emit('mouse', data);
  drawSplat(data);

  //send lines to server
  socket.emit('oldLines', data);
  return false;
}

function changeColor() {
  if (thisPlayer != undefined) {
    thisPlayer.rgb.r = Math.floor(random(0, 100));
    thisPlayer.rgb.g = Math.floor(random(0, 255));
    thisPlayer.rgb.b = Math.floor(random(0, 255));

    r = thisPlayer.rgb.r;
    g = thisPlayer.rgb.g;
    b = thisPlayer.rgb.b;
  }
}

function drawSplat(d){
  //draw splat from this user
  fill(d.r, d.g, d.b);
  ellipse(d.x * width, d.y * height, 100 * M);
}

function windowResized() {
  resizeCanvas(window.windowWidth, window.windowHeight);
  resetCanvas();
  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;
  DIM = Math.min(WIDTH, HEIGHT);
  M = DIM / 1000;
  closeButton.position(20, 20);
  screenButton.position(20, windowHeight - 100);
  colorButton.position(windowWidth - 90, 20);
  linkButton.position(windowWidth - 90, windowHeight - 100);
}
