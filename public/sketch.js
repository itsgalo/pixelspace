let socket;
let closeButton, screenButton, colorPicker, linkButton;
let can, updatedCanvas, bufferA, bufferB, bufferC, bufferD;

let W = window.innerWidth;
let H = window.innerHeight;
let DIM = Math.min(W, H);
let M = DIM / 1000;

let cursors = [];
let players = [];
let r = rand(255);
let g = rand(255);
let b = rand(255);
let bgr = 105; //200 + rand(50);
let bgg = 179; //170;
let bgb = 231; //rand(250);
let xoff = 0.0;
let alph = 1;
let friendIsDrawing = false;
let isDrawing = false;
let isErasing = false;
let thisPlayer;
let mx, my;
let shA, shB;


const vs = `
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}`

const fs = `
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D tex0;
uniform sampler2D tex1; // color palette
uniform vec2 u_resolution;
varying vec2 vTexCoord;

// "steps" of R, G and B. Must be integer && equal or greater than 2
float rcount = 4.0;
float gcount = 4.0;
float bcount = 4.0;
float acount = 1.0;

float bayer[16];

const float bayerSize = 4.0;
float bayerDivider = bayerSize * bayerSize;

//takes input color from matrix index
vec4 nearestColor(vec4 incolor) {
    vec4 rgbaCounts = vec4(rcount, gcount, bcount, acount);

    vec4 color = incolor;
    //lightness calculation
    color.r = (floor((rgbaCounts.r - 1.0) * color.r + 0.2) / (rgbaCounts.r - 1.0));
    color.g = (floor((rgbaCounts.g - 1.0) * color.g + 0.2) / (rgbaCounts.g - 1.0));
    color.b = (floor((rgbaCounts.b - 1.0) * color.b + 0.2) / (rgbaCounts.b - 1.0));
    color.a = 1.0;
    //float newcolor = length(color.rgb * vec3(0.2126,0.7152,0.0722));
    float newcolor = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    //0.2126,0.7152,0.0722
    vec4 grey = vec4(newcolor, newcolor, newcolor, 1.0);

    return color;
}
//see algorithm https://medium.com/the-bkpt/dithered-shading-tutorial-29f57d06ac39
float indexValue(int idx) {
    int x = int(mod(gl_FragCoord.x, bayerSize));
    int y = int(mod(gl_FragCoord.y, bayerSize));

    if(x < 8){
      if (idx == 0) return bayer[0] / 16.0;
      if (idx == 1) return bayer[1] / 16.0;
      if (idx == 2) return bayer[2] / 16.0;
      if (idx == 3) return bayer[3] / 16.0;
      if (idx == 4) return bayer[4] / 16.0;
      if (idx == 5) return bayer[5] / 16.0;
      if (idx == 6) return bayer[6] / 16.0;
      if (idx == 7) return bayer[7] / 16.0;
      if (idx == 8) return bayer[8] / 16.0;
      if (idx == 9) return bayer[9] / 16.0;
      if (idx == 10) return bayer[10] / 16.0;
      if (idx == 11) return bayer[11] / 16.0;
      if (idx == 12) return bayer[12] / 16.0;
      if (idx == 13) return bayer[13] / 16.0;
      if (idx == 14) return bayer[14] / 16.0;
      if (idx == 15) return bayer[15] / 16.0;
    }
}

vec4 posterize(in vec4 inputColor){
  float gamma = 2.2;
  float numColors = 255.0;

  vec3 c = inputColor.rgb;
  c = pow(c, vec3(gamma, gamma, gamma));
  c = c * numColors;
  c = floor(c);
  c = c / numColors;
  c = pow(c, vec3(1.0/gamma));
  
  return vec4(c, inputColor.a);
}

void main(void) {
  bayer[0] = 0.0;
  bayer[1] = 8.0;
  bayer[2] = 2.0;
  bayer[3] = 10.0;
  bayer[4] = 12.0;
  bayer[5] = 4.0;
  bayer[6] = 14.0;
  bayer[7] = 6.0;
  bayer[8] = 3.0;
  bayer[9] = 11.0;
  bayer[10] = 1.0;
  bayer[11] = 9.0;
  bayer[12] = 15.0;
  bayer[13] = 7.0;
  bayer[14] = 13.0;
  bayer[15] = 5.0;
  
  vec2 pixelBin = gl_FragCoord.xy / floor(1.);
  vec2 tiles = u_resolution.xy / floor(1.);
  vec2 uvBin = floor(pixelBin) / tiles;
  
  vec4 color = posterize(texture2D(tex0, uvBin));

  vec2 xyPos = floor(mod(pixelBin.xy, bayerSize));
  int idx = int(xyPos.x) + int(xyPos.y) * int(bayerSize);

  vec4 dither = nearestColor(color + 5.0 * (indexValue(idx) / bayerDivider)); //bayerDivider normalizes the color range

  gl_FragColor = vec4(dither.rgb, 1.0);
}`

const fsb = `
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D tex0; //src
uniform sampler2D tex1; //feedback
uniform float time;
uniform vec2 u_resolution;
uniform float pixRes;
varying vec2 vTexCoord;

//4d simplex noise
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0; }

float mod289(float x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0; }

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+10.0)*x);
}

float permute(float x) {
     return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float taylorInvSqrt(float r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec4 grad4(float j, vec4 ip)
  {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;

  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;

  return p;
  }

#define F4 0.309016994374947451

float snoise(vec4 v)
  {
  const vec4  C = vec4( 0.138196601125011,  // (5 - sqrt(5))/20  G4
                        0.276393202250021,  // 2 * G4
                        0.414589803375032,  // 3 * G4
                       -0.447213595499958); // -1 + 4 * G4

  vec4 i  = floor(v + dot(v, vec4(F4)) );
  vec4 x0 = v -   i + dot(i, C.xxxx);

  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;

  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;

  i = mod289(i);
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));

  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));

  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;

}

const int octaves = 8;

float fbm(vec2 vuv) {
  float amplitude = 0.5;
  float freq = 2.0;
	float value = 0.0;
  vec2 shift = vec2(10.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));

  for(int i = 0; i < octaves; i++) {
      value += amplitude * snoise(vec4(freq*vuv.x*1.+555., freq*vuv.y*1.+565., 0.01*time, 0.01*time));
      vuv = rot * vuv * 2.0 + shift;
      amplitude *= 0.6;
      freq *= 1.0;//2
  }
  return value;
}

const float PI = 3.141592653;
const float AngleDelta = PI / 180.0;

vec2 clampAngle(vec2 coord){
    float angle = AngleDelta;
    float inangle = atan(coord.y, coord.x);
    float newangle = floor((inangle/angle)+0.5)*angle;
    float l = length(coord);
    vec2 t = vec2(cos(newangle), sin(newangle)) * l;
    return t;
}

void main(void) {
  float gamma = 2.2;

  vec2 uv = vTexCoord;
  // the texture is loaded upside down and backwards by default so lets flip it
  //uv.y = 1.0 - uv.y;

  // float tiles = 20.0;
  // vec2 vuv = uv * tiles;
  // vuv = floor(uv);
  // vuv = uv / tiles;
  
  vec3 src = texture2D(tex0, uv).rgb;
  vec3 rgb = texture2D(tex1, uv).rgb;
  // float x = snoise(vec4(uv.x*6.0, uv.y*6.0, 0.4 * (time), 0.2 * (time)));
  // float y = snoise(vec4(uv.x*6.0+999.0, uv.y*6.0, 0.3 * (time), 0.2 * (time)));
  float x = fbm(uv);
  float y = fbm(uv+vec2(5.0, 1.0));
  vec2 offset = vec2(x*0.005, y*0.005);
  rgb = texture2D(tex0, uv + clampAngle(offset)).rgb;
  src = mix(rgb.rgb, src.rgb, 0.8);
     
  //gl_FragColor = vec4(clamp(sat(src.rgb, 1.001), 0.0, 1.0), 1.0);

  gl_FragColor = vec4(src, 1.0);
}`

function setup() {
  window.innerHeight <= window.innerWidth ? (W = max(window.innerHeight, 1) * 1.0, H = max(window.innerHeight, 1)) : (W = max(window.innerWidth, 1), H = max(window.innerWidth, 1) / 1.0);

  can = createCanvas(W, H, WEBGL);
  pixelDensity(1);
  shaderA = createShader(vs, fs);
  shaderB = createShader(vs, fsb);
  
  bufferA = createFramebuffer({ format: FLOAT, textureFiltering: NEAREST });
  bufferB = createFramebuffer({ format: FLOAT, textureFiltering: NEAREST });
  bufferC = createFramebuffer({ format: FLOAT, textureFiltering: NEAREST });
  bufferD = createFramebuffer({ format: FLOAT, textureFiltering: NEAREST });

  bufferC.begin();
  background(255, 255, 255);
  bufferC.end();
  //bufferA.colorMode(HSB);

  socket = io.connect();
  socket.on('heartbeat', players => checkPlayers(players));
  socket.on('disconnect', playerID => removePlayer(playerID));
  socket.on('mouse', newDrawing);
  socket.on('cursor', cursorPos);

  closeButton = createButton('×');
  closeButton.position(20, 20);
  closeButton.mousePressed(toggleErase);

  screenButton = createButton('↓');
  screenButton.position(20, windowHeight - 100);
  screenButton.mousePressed(screenShot);

  colorPicker = createColorPicker('#0000ff');
  colorPicker.position(windowWidth - 90, 20);

  linkButton = createButton('//');
  linkButton.position(windowWidth - 90, windowHeight - 100);
  //linkButton.mousePressed(toggleErase);
}
function toggleErase() {
  isErasing = !isErasing;
}
function resetCanvas() {
  bufferC.background(255, 255, 255);
  bufferA.clear();
}

function screenShot() {
  saveCanvas('OurPixelSpace', 'png');
}

function newDrawing(data) {
  //draw what someone else is drawing
  drawBrush(data);
  //console.log(data.id + ' is drawing');
}

function draw() {
  //normalize mouse coords
  mx = map(mouseX - width/2, 0, width, 0, 1);
  my = map(mouseY - height/2, 0, height, 0, 1);
  updateColor();

  // Draw to the framebuffer
  bufferB.begin();
  shader(shaderB);
  shaderB.setUniform("u_resolution", [W, H]);
  shaderB.setUniform("tex0", bufferC);
  shaderB.setUniform("tex1", bufferA);
  shaderB.setUniform("seed", 0.0);
  shaderB.setUniform("time", frameCount * 0.1);
  rect(-width/2, -height/2, width, height);
  bufferB.end();

  bufferC.begin();
  image(bufferB, -width/2, -height/2, width, height);
  image(bufferA, -width/2, -height/2, width, height);
  bufferC.end();
  
  bufferD.begin();
  shader(shaderA);
  shaderA.setUniform("u_resolution", [W, H]);
  shaderA.setUniform("tex0", bufferC);
  shaderA.setUniform("pixRes", 256.0);
  shaderA.setUniform("time", frameCount * 0.001);
  rect(-width/2, -height/2, width, height);
  bufferD.end();
  
  image(bufferD, -width/2, -height/2, width, height);
  
  bufferA.begin();
  clear();
  bufferA.end();

  // for(var i = 0; i < players.length; i++){
  //   //bufferA.fill(255);
  //   bufferA.noStroke();
  //   //bufferA.ellipse(players[i].x * width, players[i].y * height, 50 * M);
  // }
  // if (keyIsPressed) {
  //   isErasing = true;
  // } else {
  //   isErasing = false;
  //   changeColor();
  // }
  //fadeGraphics(bufferA, 1);
}

function fadeGraphics(pg, fadeAmount) {
  pg.loadPixels();
  // iterate over pixels
  for (let i = 0; i < 4 * pg.width * pg.height; i += 4) {
    if (pg.pixels[i+3] > 0) {
      // get alpha value
      let alpha = pg.pixels[i+3];
      // reduce alpha value
      alpha = max(0, alpha-fadeAmount);
      // assign color with new alpha-value
      pg.pixels[i+3] = alpha;
    }
  }
  pg.updatePixels();
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
    b: b,
    e: isErasing
  }
  socket.emit('mouse', data);
  drawBrush(data);
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
    b: b,
    e: isErasing
  }
  socket.emit('mouse', data);
  drawBrush(data);

  //send lines to server
  socket.emit('oldLines', data);
  return false;
}

function updateColor() {
  if (thisPlayer != undefined) {
    thisPlayer.rgb.r = red(colorPicker.color());
    thisPlayer.rgb.g = green(colorPicker.color());
    thisPlayer.rgb.b = blue(colorPicker.color());

    r = thisPlayer.rgb.r;
    g = thisPlayer.rgb.g;
    b = thisPlayer.rgb.b;
  }
}

function drawBrush(d){
  //draw brush from this user
  if (d.e) {
    bufferA.begin();
    rectMode(CENTER);
    erase();
    rect(d.x * W, d.y * H, 20 * M);
    noErase();
    bufferA.end();
  } else {
    bufferA.begin();
    rectMode(CENTER);
    noStroke();
    fill(d.r, d.g, d.b);
    rect(d.x * W, d.y * H, 20 * M);
    bufferA.end();
  }
}

function windowResized() {
  closeButton.position(20, 20);
  screenButton.position(20, windowHeight - 100);
  colorPicker.position(windowWidth - 90, 20);
  linkButton.position(windowWidth - 90, windowHeight - 100);
}