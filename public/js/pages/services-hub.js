// Navbar interactivity: mobile menu and 3D toggle
(function(){
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const nav3d = document.getElementById('nav3dToggle');
  if(navToggle && mobileMenu){
    navToggle.addEventListener('click', ()=>{
      const open = mobileMenu.classList.toggle('open');
      mobileMenu.setAttribute('aria-hidden', (!open).toString());
      navToggle.setAttribute('aria-expanded', open.toString());
    });
  }
  // 3D toggle — uses Site3D if available
  function update3dButton(enabled){
    if(!nav3d) return;
    nav3d.setAttribute('aria-pressed', enabled? 'true':'false');
  }
  if(nav3d){
    const saved = localStorage.getItem('site3d_enabled');
    const enabled = saved === null ? true : saved === '1';
    update3dButton(enabled);
    nav3d.addEventListener('click', ()=>{
      const cur = nav3d.getAttribute('aria-pressed') === 'true';
      const next = !cur;
      update3dButton(next);
      localStorage.setItem('site3d_enabled', next? '1':'0');
      if(window.Site3D){ if(next) window.Site3D.enable(); else window.Site3D.disable(); }
    });
  }
})();
// Navbar scroll trace: update fill based on document scroll progress
(function(){
  const traceFill = document.getElementById('navTraceFill');
  if(!traceFill) return;
  function docHeight(){ return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight); }
  function updateTrace(){
    const scrollY = window.scrollY || window.pageYOffset;
    const max = Math.max(0, docHeight() - window.innerHeight);
    const progress = max > 0 ? Math.min(1, scrollY / max) : 0;
    traceFill.style.transform = `translateY(-50%) scaleX(${progress})`;
  }
  let ticking = false;
  window.addEventListener('scroll', ()=>{ if(!ticking){ requestAnimationFrame(()=>{ updateTrace(); ticking=false; }); ticking=true; } });
  window.addEventListener('resize', updateTrace);
  // init
  updateTrace();
})();
/* ── CURSOR ── */
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove', e => {
  mx=e.clientX; my=e.clientY;
  cursor.style.left=mx+'px'; cursor.style.top=my+'px';
});
function animateRing(){
  rx+=(mx-rx)*0.1; ry+=(my-ry)*0.1;
  ring.style.left=rx+'px'; ring.style.top=ry+'px';
  requestAnimationFrame(animateRing);
}
animateRing();
document.querySelectorAll('a,button,.svc-card').forEach(el=>{
  el.addEventListener('mouseenter',()=>{
    cursor.style.width='20px'; cursor.style.height='20px';
    ring.style.width='54px'; ring.style.height='54px';
    ring.style.borderColor='rgba(0,0,0,0.7)';
  });
  el.addEventListener('mouseleave',()=>{
    cursor.style.width='12px'; cursor.style.height='12px';
    ring.style.width='36px'; ring.style.height='36px';
    ring.style.borderColor='rgba(0,0,0,0.45)';
  });
});

/* ── PARTICLES ── */
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let W,H,particles=[];
function resize(){
  W=canvas.width=window.innerWidth;
  H=canvas.height=window.innerHeight;
}
resize(); window.addEventListener('resize',resize);
class Particle {
  constructor(){this.reset();}
  reset(){
    this.x=Math.random()*W; this.y=Math.random()*H;
    this.vx=(Math.random()-0.5)*0.25; this.vy=(Math.random()-0.5)*0.25;
    this.r=Math.random()*1.5+0.3;
    this.a=Math.random()*0.4+0.05;
    this.c=Math.random()>0.6?'34,211,238':'129,140,248';
  }
  update(){
    this.x+=this.vx; this.y+=this.vy;
    if(this.x<0||this.x>W||this.y<0||this.y>H) this.reset();
  }
  draw(){
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
    ctx.fillStyle=`rgba(${this.c},${this.a})`;
    ctx.fill();
  }
}
for(let i=0;i<120;i++) particles.push(new Particle());

// draw connections
function drawConnections(){
  for(let i=0;i<particles.length;i++){
    for(let j=i+1;j<particles.length;j++){
      const dx=particles[i].x-particles[j].x;
      const dy=particles[i].y-particles[j].y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<100){
        ctx.beginPath();
        ctx.moveTo(particles[i].x,particles[i].y);
        ctx.lineTo(particles[j].x,particles[j].y);
        ctx.strokeStyle=`rgba(34,211,238,${0.04*(1-dist/100)})`;
        ctx.lineWidth=0.5;
        ctx.stroke();
      }
    }
  }
}

function animateParticles(){
  ctx.clearRect(0,0,W,H);
  particles.forEach(p=>{p.update();p.draw();});
  drawConnections();
  requestAnimationFrame(animateParticles);
}
animateParticles();

/* ── NAVBAR SCROLL ── */
window.addEventListener('scroll',()=>{
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY>50);
});

/* ── DEVICE FRAME MOUSE TILT ── */
const df = document.getElementById('deviceFrame');
if(df){
  df.closest('.hero-right').addEventListener('mousemove',e=>{
    const r=df.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const dx=(e.clientX-cx)/r.width*2;
    const dy=(e.clientY-cy)/r.height*2;
    df.style.transform=`rotateY(${dx*-12}deg) rotateX(${dy*8}deg) rotateZ(${dx*1}deg)`;
  });
  df.closest('.hero-right').addEventListener('mouseleave',()=>{
    df.style.transform='rotateY(-18deg) rotateX(8deg) rotateZ(2deg)';
  });
}

/* ── INTERSECTION OBSERVER — SERVICE ITEMS ── */
const items = document.querySelectorAll('.service-item');
const svcObserver = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      svcObserver.unobserve(entry.target);
    }
  });
},{threshold:0.15});
items.forEach(el=>svcObserver.observe(el));

/* ── STATS COUNTER ── */
const statNums = document.querySelectorAll('.stat-num[data-target]');
const statObserver = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const el=entry.target;
      const target=parseInt(el.dataset.target);
      const suffix=target>3?'+':'';
      let current=0;
      const step=Math.max(1,Math.ceil(target/30));
      const timer=setInterval(()=>{
        current=Math.min(current+step,target);
        el.textContent=current+suffix;
        if(current>=target) clearInterval(timer);
      },50);
      statObserver.unobserve(el);
    }
  });
},{threshold:0.5});
statNums.forEach(el=>statObserver.observe(el));