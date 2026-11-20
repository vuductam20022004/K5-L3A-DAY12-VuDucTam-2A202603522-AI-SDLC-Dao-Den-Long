import './render/styles.css';
if(new URLSearchParams(location.search).has('benchmark')) { void import('./bench/client'); }
else { void import('./render/game'); }
