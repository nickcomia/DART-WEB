// js/nav.js
document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll('.nav-links a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (currentPath === href || 
            (currentPath === '/' || currentPath === '/index.html') && href === '/index.html') {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});