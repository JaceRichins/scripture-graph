/** Original, offline landscape illustrations. Composed for a portrait reading surface. */
const palettes: Record<string, [string, string, string, string]> = {
  sunrise: ['#171e35','#795369','#e7b17c','#171e2c'],
  waters: ['#132833','#3c6873','#acc6bd','#0d252b'],
  mount: ['#151e34','#616d89','#c5c5c8','#172131'],
  garden: ['#102529','#4c6350','#c2bc88','#10291e'],
  fields: ['#292936','#867155','#e4c58b','#373728'],
  storm: ['#151f2d','#485869','#9fabb5','#14222e'],
  temple: ['#242636','#81716d','#e3c9a0','#302b29'],
  city: ['#21273a','#796674','#d1a987','#242335'],
  warcamp: ['#232337','#705653','#c5a17a','#22202a'],
  prison: ['#111b26','#394954','#a7b7b7','#17232b'],
  desert: ['#29263c','#976d70','#ebc39c','#4a3540'],
  starlight: ['#080f24','#253254','#8799bb','#101a30'],
  candle: ['#191b26','#624738','#e4b674','#28201e'],
  grove: ['#14222b','#415748','#b0b78e','#10221d'],
  riverbank: ['#172734','#55777a','#bed0bf','#172e2c'],
  shore: ['#192b3a','#577c8c','#c6d0c5','#1a333d'],
  olive: ['#242c37','#727863','#d8c699','#27362b'],
  study: ['#19232d','#5c5b51','#d1bd92','#252b2a'],
};

function random(seed: number) { let n = seed; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); }
const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;

export function sceneArtwork(id: string): string {
  const p = palettes[id];
  if (!p) throw new Error(`Missing scene artwork: ${id}`);
  const [sky, horizon, light, dark] = p;
  const rnd = random([...id].reduce((a, c) => a + c.charCodeAt(0), 17));
  const night = id === 'starlight';
  let art = `<defs>
    <linearGradient id="sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset=".68" stop-color="${horizon}"/><stop offset="1" stop-color="${light}"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="${light}" stop-opacity=".55"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
    <linearGradient id="land" x2="0" y2="1"><stop stop-color="${horizon}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="water" x2="0" y2="1"><stop stop-color="${horizon}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="stone" x2="1" y2=".8"><stop stop-color="${light}"/><stop offset="1" stop-color="${horizon}"/></linearGradient>
    <linearGradient id="shade" x2="0" y2="1"><stop stop-color="#07111e" stop-opacity=".45"/><stop offset=".5" stop-color="#07111e" stop-opacity=".22"/><stop offset="1" stop-color="#07111e" stop-opacity=".12"/></linearGradient>
    <filter id="grain"><feTurbulence baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".055"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
  </defs><rect width="900" height="1400" fill="url(#sky)"/>
  <ellipse cx="700" cy="825" rx="580" ry="510" fill="url(#glow)"/>`;
  // Fine cloud strata, not discs or a flat striped gradient.
  if (!['prison','candle','study'].includes(id)) {
    for (let i=0;i<14;i++) {
      const y=150+rnd()*660, x=rnd()*700-160, width=180+rnd()*460;
      art += path(`M${x} ${y}q${width*.3} -28 ${width*.6} -7t${width*.4} 9q-${width*.5} 24 -${width} 0`, light, `opacity="${.015+rnd()*.045}"`);
    }
  }
  if (night || id === 'grove' || id === 'desert') for(let i=0;i<(night?210:35);i++) {
    art += `<circle cx="${rnd()*900}" cy="${rnd()*820}" r="${.4+rnd()*1.3}" fill="#e9e5dd" opacity="${.15+rnd()*.6}"/>`;
  }
  if (['sunrise','desert','fields','shore','olive'].includes(id)) art += `<circle cx="715" cy="815" r="34" fill="${light}" opacity=".7"/>`;
  if (night) art += `<circle cx="730" cy="330" r="23" fill="#c5cfd7"/><circle cx="739" cy="323" r="23" fill="${sky}"/>`;

  function terrain(base: number, amplitude: number, color: string, opacity=1) {
    let d=`M-40 ${base}`, previous=base;
    for(let x=0;x<=1000;x+=80) { const y=base+(rnd()-.5)*amplitude; d+=` Q${x-40} ${previous-15} ${x} ${y}`; previous=y; }
    return path(d+' L1000 1400 L-40 1400Z', color, `opacity="${opacity}"`);
  }
  function tree(x:number,y:number,size:number,olive=false) {
    let s=path(`M${x-8*size} ${y}q${14*size} -${80*size} ${3*size} -${170*size}l${12*size} -${2*size}q-${4*size} ${100*size} ${9*size} ${172*size}Z`,dark);
    for(let i=0;i<32;i++) {
      const px=x+(rnd()-.5)*170*size, py=y-170*size+(rnd()-.5)*90*size;
      s+=`<ellipse cx="${px}" cy="${py}" rx="${(10+rnd()*22)*size}" ry="${(olive?8:13)*size}" fill="${i%4===0?horizon:dark}" opacity=".85"/>`;
    }
    s+=path(`M${x+3*size} ${y-60*size}l-${45*size} -${85*size}m${45*size} ${65*size}l${47*size} -${75*size}`, 'none', `stroke="${dark}" stroke-width="${7*size}"`);
    return s;
  }
  function ripples(top:number, count=65) {
    let s=''; for(let i=0;i<count;i++) {const y=top+rnd()*(1400-top),x=rnd()*900,w=8+rnd()*((y-top)*.4+15); s+=path(`M${x} ${y}q${w*.5} -2 ${w} 0`,'none',`stroke="${light}" stroke-width="${.5+rnd()*1.3}" opacity="${.05+rnd()*.16}"`);} return s;
  }
  const interior = ['prison','candle','study'].includes(id);
  if(!interior) {
    art+=terrain(860,90,horizon,.6)+terrain(930,120,dark,.32)+terrain(1050,100,dark,.6);
  }
  if(['waters','shore','riverbank','storm'].includes(id)) {
    art+=path('M0 1025Q460 990 900 1035V1400H0Z','url(#water)')+ripples(1040);
    if(id==='riverbank') {
      art+=path('M0 1000Q320 990 535 1040Q170 1105 0 1330Z',dark)+path('M900 1010Q550 1000 635 1070Q300 1190 680 1400H900Z',dark);
      art+=tree(820,1150,.85);
    } else if(id==='shore') {
      art+=path('M0 1280Q380 1170 900 1380V1400H0Z',dark);
      art+=path('M575 1130Q675 1230 785 1130L765 1155H598Z','#10242b');
      art+=path('M675 1128V940L754 1118Z',light,'opacity=".44"')+path('M675 940V1158','none','stroke="#192a2e" stroke-width="5"');
    } else if(id==='storm') {
      for(let i=0;i<5;i++) art+=path(`M-20 ${1090+i*63}Q150 ${1020+i*63} 350 ${1100+i*63}T950 ${1080+i*63}`,'none',`stroke="${light}" stroke-width="${2+i}" opacity=".13"`);
    } else { art+=path('M0 1240Q120 1180 250 1280L320 1400H0Z',dark); }
    if(id!=='storm') for(let i=0;i<38;i++) {const x=rnd()*230,y=1300+rnd()*100;art+=path(`M${x} ${y}q${rnd()*30} -75 ${rnd()*25} -${60+rnd()*100}`,'none',`stroke="${dark}" stroke-width="3"`);}
  } else if(id==='mount') {
    art+=path('M-80 1380L100 1050L142 1030L195 855L224 935L267 942L335 1040L432 865L469 871L516 770L541 781L565 690L594 754L620 768L648 850L680 856L741 994L777 982L980 1370Z', 'url(#land)');
    art+=path('M565 690L516 770L469 871L505 853L526 876L550 811L579 899L607 844L648 850L620 768L594 754Z','#c0c4c8','opacity=".65"');
    art+=path('M565 690L554 829L584 983L548 1020L757 1370L980 1370L777 982L741 994L680 856L648 850L620 768L594 754Z',dark,'opacity=".42"');
    art+=terrain(1310,55,dark);
  } else if(id==='desert') {
    for(let i=0;i<5;i++) art+=path(`M-60 ${990+i*95}Q${180+i*80} ${800+i*130} 950 ${1110+i*75}V1400H-60Z`, i%2===0?'url(#land)':dark,`opacity="${.3+i*.13}"`);
    for(let i=0;i<24;i++) art+=path(`M${i*23} ${1230+i*4}q170 -12 360 50`,'none',`stroke="${light}" opacity=".06"`);
  } else if(['garden','grove','olive'].includes(id)) {
    art+=terrain(1230,70,dark);
    art+=path('M390 1400Q580 1270 480 1160Q410 1080 550 1040Q490 1160 590 1220L760 1400Z',horizon,'opacity=".38"');
    for(const [x,y,s] of [[80,1330,1.7],[830,1250,1.3],[245,1130,.6],[700,1100,.65]]) art+=tree(x!,y!,s!,id==='olive');
    if(id==='garden') for(let i=0;i<55;i++) {const x=rnd()*900;art+=`<circle cx="${x}" cy="${1270+rnd()*130}" r="${1+rnd()*3}" fill="${i%2?'#c1a3ad':'#b5bea2'}" opacity=".6"/>`;}
    if(id==='grove') art+=path('M650 450L310 1400H520L720 450Z',light,'opacity=".06"');
  } else if(id==='fields') {
    art+=terrain(1130,60,'url(#land)');
    for(let i=0;i<100;i++) {const x=rnd()*900,y=1240+rnd()*180,h=40+rnd()*100;art+=path(`M${x} ${y}q15 -${h*.5} 9 -${h}`,'none',`stroke="${i%3?dark:light}" stroke-width="2" opacity=".65"`);for(let j=0;j<4;j++)art+=`<ellipse cx="${x+9+(j%2?4:-4)}" cy="${y-h+j*6}" rx="3" ry="6" fill="${i%3?horizon:light}" opacity=".7"/>`;}
  } else if(id==='city'||id==='temple') {
    for(let row=0;row<3;row++) for(let i=0;i<13;i++){
      const x=i*79-50+(row%2)*35,y=1080+row*95+rnd()*65,w=64+rnd()*34,h=70+rnd()*50;
      art+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${row===2?dark:horizon}" opacity="${.48+row*.2}"/>`;
      if(i%4===0)art+=path(`M${x} ${y}Q${x+w/2} ${y-52} ${x+w} ${y}Z`,horizon,`opacity="${.5+row*.2}"`);
      art+=path(`M${x} ${y+3}H${x+w}`,'none',`stroke="${light}" opacity=".18" stroke-width="3"`);
      for(let j=0;j<2;j++){const wx=x+12+j*30;art+=path(`M${wx} ${y+40}V${y+23}q6 -10 12 0v17Z`,light,`opacity="${.08+rnd()*.25}"`);}
    }
    if(id==='temple') {
      art+=path('M190 1400L220 1310H680L710 1400Z',dark)+path('M230 1050H670V1305H230Z','url(#stone)');
      art+=path('M210 1050L450 925L690 1050Z','url(#stone)')+path('M260 1052H640V1080H260Z',dark,'opacity=".55"');
      for(let x=270;x<640;x+=70)art+=`<rect x="${x}" y="1080" width="25" height="215" fill="${light}" opacity=".48"/><rect x="${x+25}" y="1080" width="26" height="215" fill="${dark}" opacity=".8"/>`;
      for(let i=0;i<4;i++)art+=path(`M${210-i*15} ${1310+i*22}H${690+i*15}`,'none',`stroke="${light}" stroke-width="3" opacity=".25"`);
    }
    art+=terrain(1370,30,dark);
  } else if(id==='warcamp') {
    art+=terrain(1170,40,dark);
    for(const [x,y,s] of [[130,1220,.7],[440,1280,1],[780,1220,.6]]) {
      art+=path(`M${x!-90*s!} ${y}L${x} ${y!-100*s!}L${x!+110*s!} ${y}Z`,horizon)+path(`M${x} ${y!-100*s!}L${x!+30*s!} ${y}H${x!-20*s!}Z`,dark);
      art+=path(`M${x} ${y!-100*s!}L${x!+140*s!} ${y!+12}`,'none',`stroke="${light}" opacity=".25"`);
    }
    art+=`<ellipse cx="650" cy="1305" rx="95" ry="22" fill="url(#glow)"/>`+path('M637 1305Q620 1280 650 1257Q671 1286 657 1305Z','#dca46a','opacity=".7"');
  } else if(interior) {
    art+=`<rect y="0" width="900" height="1400" fill="${dark}" opacity=".7"/>`;
    for(let y=60;y<1400;y+=100)for(let x=-80;x<950;x+=170)art+=`<rect x="${x+(y%200?70:0)}" y="${y}" width="164" height="94" rx="3" fill="${horizon}" opacity="${.05+rnd()*.1}"/>`;
    if(id==='prison') {
      art+=path('M630 540V310Q720 200 810 310V540Z','url(#stone)')+path('M635 535L110 1400H720L810 535Z',light,'opacity=".07"');
      for(let x=650;x<810;x+=35) art+=path(`M${x} 290V545`,'none',`stroke="${dark}" stroke-width="10"`);
      art+=path('M625 430H815','none',`stroke="${dark}" stroke-width="9"`);
      art+=path('M0 1300L900 1230V1400H0Z',dark);
    } else {
      if(id==='study') art+=path('M50 500V200H245V500Z','url(#sky)')+path('M148 200V500M50 350H245','none',`stroke="${dark}" stroke-width="12"`);
      art+=path('M0 1170Q400 1120 900 1170V1400H0Z','url(#land)');
      for(let i=0;i<18;i++)art+=path(`M0 ${1170+i*14}Q400 ${1140+i*15} 900 ${1180+i*13}`,'none',`stroke="${light}" opacity=".06"`);
      art+=path('M150 1200Q300 1140 460 1200Q600 1140 740 1200L790 1340Q610 1280 460 1340Q280 1280 100 1340Z','#95876e');
      for(let i=0;i<9;i++)art+=path(`M${162-i*4} ${1210+i*11}Q310 ${1170+i*11} 435 ${1215+i*11}M485 ${1215+i*11}Q620 ${1170+i*11} ${730+i*4} ${1210+i*11}`,'none',`stroke="${dark}" stroke-width="2" opacity=".4"`);
      art+=path('M460 1200V1335','none',`stroke="${dark}" stroke-width="3"`);
      art+=`<ellipse cx="790" cy="1170" rx="110" ry="210" fill="url(#glow)"/><rect x="780" y="1070" width="22" height="153" rx="4" fill="${light}" opacity=".65"/>`+path('M790 1074Q770 1040 793 1010Q813 1050 790 1074Z','#efd6a0');
    }
  }
  // A continuous pigment texture ties sky, land and objects together.
  art+=`<rect width="900" height="1400" fill="transparent" filter="url(#grain)"/><rect width="900" height="1400" fill="url(#shade)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1400" viewBox="0 0 900 1400">${art}</svg>`;
}

export const sceneArtworkUrl = (id: string) => `url("data:image/svg+xml,${encodeURIComponent(sceneArtwork(id))}")`;
