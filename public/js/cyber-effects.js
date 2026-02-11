// ============================================
// CYBERPUNK EFFECTS - ZarOffc
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Initialize all effects
  initParticles();
  initGlitchEffect();
  initScrollReveal();
  initCounterAnimation();
  initTypingEffect();
});

// Particles System
function initParticles() {
  const container = document.querySelector('.particles-container');
  if (!container) return;
  
  const particleCount = 50;
  
  for (let i = 0; i < particleCount; i++) {
    createParticle(container);
  }
}

function createParticle(container) {
  const particle = document.createElement('div');
  particle.className = 'particle';
  
  // Random properties
  const size = Math.random() * 3 + 1;
  const left = Math.random() * 100;
  const delay = Math.random() * 15;
  const duration = Math.random() * 10 + 10;
  
  particle.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    left: ${left}%;
    animation-delay: ${delay}s;
    animation-duration: ${duration}s;
    opacity: ${Math.random() * 0.5 + 0.2};
  `;
  
  container.appendChild(particle);
  
  // Recreate particle after animation
  particle.addEventListener('animationend', () => {
    particle.remove();
    createParticle(container);
  });
}

// Glitch Effect on Hover
function initGlitchEffect() {
  const glitchElements = document.querySelectorAll('.glitch-text');
  
  glitchElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      el.classList.add('glitch-active');
      setTimeout(() => {
        el.classList.remove('glitch-active');
      }, 300);
    });
  });
}

// Scroll Reveal Animation
function initScrollReveal() {
  const reveals = document.querySelectorAll('.feature-card-cyber, .plan-card-cyber, .stat-item-cyber');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, index * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  reveals.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease';
    observer.observe(el);
  });
}

// Counter Animation
function initCounterAnimation() {
  const counters = document.querySelectorAll('.stat-number-cyber');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(counter) {
  const target = parseInt(counter.getAttribute('data-target'));
  const duration = 2000;
  const step = target / (duration / 16);
  let current = 0;
  
  const update = () => {
    current += step;
    if (current < target) {
      counter.textContent = Math.floor(current);
      requestAnimationFrame(update);
    } else {
      counter.textContent = target;
    }
  };
  
  update();
}

// Typing Effect
function initTypingEffect() {
  const typingElements = document.querySelectorAll('.typing-effect');
  
  typingElements.forEach(el => {
    const text = el.textContent;
    el.textContent = '';
    typeWriter(el, text, 0);
  });
}

function typeWriter(element, text, index) {
  if (index < text.length) {
    element.textContent += text.charAt(index);
    setTimeout(() => typeWriter(element, text, index + 1), 50);
  }
}

// Random Glitch Trigger
setInterval(() => {
  const glitches = document.querySelectorAll('.glitch-text');
  const random = glitches[Math.floor(Math.random() * glitches.length)];
  if (random && Math.random() > 0.7) {
    random.classList.add('glitch-active');
    setTimeout(() => random.classList.remove('glitch-active'), 200);
  }
}, 3000);

// Toast Function
function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.querySelector('.toast-cyber');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast-cyber ${type}`;
  
  let icon = 'info-circle';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'exclamation-circle';
  
  toast.innerHTML = `
    <i class="fas fa-${icon}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Matrix Rain Effect (Optional - for special pages)
function initMatrixRain() {
  const canvas = document.getElementById('matrix-canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  
  const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
  const fontSize = 14;
  const columns = canvas.width / fontSize;
  const drops = [];
  
  for (let i = 0; i < columns; i++) {
    drops[i] = 1;
  }
  
  function draw() {
    ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff003c';
    ctx.font = fontSize + 'px monospace';
    
    for (let i = 0; i < drops.length; i++) {
      const text = chars.charAt(Math.floor(Math.random() * chars.length));
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);
      
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }
  
  setInterval(draw, 35);
}

// Export for global use
window.showToast = showToast;
window.initMatrixRain = initMatrixRain;
